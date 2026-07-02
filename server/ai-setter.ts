// AI Appointment Setter
// Converses with a captured lead and books a test-drive appointment.
//
// Design rules:
// 1. Booking never depends on the LLM — the UI's slot buttons hit /api/appointments
//    directly. The AI is a conversion layer on top, not a dependency.
// 2. The bot is disclosed as an AI assistant (UI label + it says so if asked).
// 3. Hard guardrails: it never negotiates price, never invents vehicle facts,
//    never promises financing terms. Those route to a human at the dealership.
//
// Requires ANTHROPIC_API_KEY in the environment. Without it, a scripted
// fallback still moves the lead toward the slot buttons.

import { storage } from "./storage";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";

export interface SetterDealContext {
  listingId: number | null;
  vehicle: string;
  price: number | null;
  marketValueEst: number | null;
  savingsAmount: number | null;
  mileage: number | null;
  dealerName: string | null;
}

export interface SlotOption {
  iso: string;
  label: string;
}

// Next 5 days of hourly slots, 10:00–18:00 local, minus already-booked times.
export async function getAvailableSlots(dealerName: string | null): Promise<SlotOption[]> {
  const now = new Date();
  const from = new Date(now);
  const to = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);
  const booked = await storage.getBookedSlotTimes(dealerName, from, to);
  const bookedSet = new Set(booked.map((d) => new Date(d).getTime()));

  const slots: SlotOption[] = [];
  for (let day = 0; day < 6 && slots.length < 24; day++) {
    const d = new Date(now);
    d.setDate(d.getDate() + day);
    for (let hour = 10; hour <= 18; hour++) {
      const slot = new Date(d);
      slot.setHours(hour, 0, 0, 0);
      if (slot.getTime() <= now.getTime() + 60 * 60 * 1000) continue; // 1h lead time
      if (bookedSet.has(slot.getTime())) continue;
      slots.push({
        iso: slot.toISOString(),
        label: slot.toLocaleString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZone: "America/Chicago",
        }),
      });
      if (slots.length >= 24) break;
    }
  }
  return slots;
}

function buildSystemPrompt(deal: SetterDealContext | null, slots: SlotOption[], leadName: string): string {
  const dealBlock = deal
    ? `THE VEHICLE THE CUSTOMER ASKED ABOUT:
- ${deal.vehicle}
- Listed price: ${deal.price ? `$${deal.price.toLocaleString()}` : "on request"}
- Verified market value: ${deal.marketValueEst ? `$${Math.round(deal.marketValueEst).toLocaleString()}` : "n/a"}
- Verified savings: ${deal.savingsAmount ? `$${deal.savingsAmount.toLocaleString()} below market` : "n/a"}
- Mileage: ${deal.mileage ? `${deal.mileage.toLocaleString()} mi` : "n/a"}
- Located at: ${deal.dealerName ?? "our partner dealership in San Antonio"}`
    : `The customer signed up for the weekly deal list and hasn't picked a specific vehicle yet. Help them describe what they want, then offer to book a visit to see current matching deals in person.`;

  return `You are the appointment assistant for DealIntel SA, a San Antonio car-deal verification service. You are an AI assistant and you say so plainly if asked. Your ONLY job is to warmly and efficiently book ${leadName} a visit at the dealership to see the vehicle. You are talking to a real customer by chat.

${dealBlock}

AVAILABLE APPOINTMENT SLOTS (Central Time):
${slots.slice(0, 12).map((s) => `- ${s.label} (${s.iso})`).join("\n")}

HOW TO BEHAVE:
- Be brief: 1-3 sentences per reply. Friendly Texas-casual, zero pressure tactics.
- Steer every exchange toward picking a time. Offer 2-3 specific slots, not the whole list.
- When the customer agrees to a specific time, call the book_appointment tool with that slot's exact ISO string. Confirm what you booked afterward.
- Create honest urgency only from real facts given above (verified savings, deals sell fast). Never invent scarcity.

HARD RULES — never break these:
- NEVER negotiate, discount, or hint the price is flexible. Price questions beyond the listed price: "The team at the dealership handles pricing — that's a great question to bring to your visit."
- NEVER state vehicle facts not listed above (features, condition, history, colors). Say you don't have that detail and the dealership can confirm it.
- NEVER discuss financing terms, rates, or approval odds. Offer to note their interest for the dealership's finance team instead.
- NEVER collect payment info, SSN, or any sensitive data. If offered, decline and say the dealership handles all of that in person.
- If the customer is clearly not interested, thank them and let them go gracefully. No repeat pushes.`;
}

const BOOK_TOOL = {
  name: "book_appointment",
  description: "Book the dealership visit once the customer has clearly agreed to a specific time slot. Use the exact ISO timestamp of the chosen slot.",
  input_schema: {
    type: "object" as const,
    properties: {
      slot_iso: { type: "string", description: "Exact ISO timestamp of the agreed slot, copied from the available slots list" },
      notes: { type: "string", description: "Anything the customer mentioned that the dealership should know (trade-in, financing interest, questions)" },
    },
    required: ["slot_iso"],
  },
};

async function callAnthropic(system: string, messages: any[]): Promise<any> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 500,
      system,
      messages,
      tools: [BOOK_TOOL],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

export interface SetterResult {
  reply: string;
  booked: boolean;
  appointmentId?: number;
  scheduledAt?: string;
}

export async function runSetterTurn(params: {
  buyerLeadId: number;
  deal: SetterDealContext | null;
  history: { role: "user" | "assistant"; content: string }[];
  userMessage: string;
}): Promise<SetterResult> {
  const lead = await storage.getBuyerLeadById(params.buyerLeadId);
  if (!lead) throw new Error("Lead not found");

  const slots = await getAvailableSlots(params.deal?.dealerName ?? null);

  // Fallback path: no API key → scripted nudge toward the slot buttons.
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      reply: `Thanks ${lead.name.split(" ")[0]}! Our team will text you shortly to answer that. In the meantime, the fastest way to lock in ${params.deal ? "the " + params.deal.vehicle : "a visit"} is to grab one of the open times above — appointments take priority when a deal has multiple interested buyers.`,
      booked: false,
    };
  }

  const system = buildSystemPrompt(params.deal, slots, lead.name);
  const messages: any[] = [
    ...params.history.slice(-12).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: params.userMessage },
  ];

  let response = await callAnthropic(system, messages);

  // Handle a booking tool call, then let the model confirm in words.
  const toolUse = (response.content ?? []).find((b: any) => b.type === "tool_use" && b.name === "book_appointment");
  let booked = false;
  let appointmentId: number | undefined;
  let scheduledAt: string | undefined;

  if (toolUse) {
    const slotIso = String(toolUse.input?.slot_iso ?? "");
    const valid = slots.find((s) => s.iso === slotIso);
    let toolResultText: string;

    if (!valid) {
      toolResultText = "That slot is not in the available list. Offer the customer 2-3 slots from the list and ask again.";
    } else {
      const scoreAtBooking = params.deal?.listingId
        ? await storage.getDealScoreForListing(params.deal.listingId)
        : undefined;
      const appt = await storage.insertAppointment({
        buyerLeadId: params.buyerLeadId,
        listingId: params.deal?.listingId ?? null,
        dealerName: params.deal?.dealerName ?? null,
        scheduledAt: new Date(slotIso),
        setBy: "ai_setter",
        notes: toolUse.input?.notes ?? null,
        dealScoreAtBooking: scoreAtBooking?.dealScore ?? null,
        scoreBreakdownAtBooking: scoreAtBooking?.scoreBreakdown ?? null,
        urgencyAtBooking: scoreAtBooking?.urgency ?? null,
      });
      booked = true;
      appointmentId = appt.id;
      scheduledAt = slotIso;
      toolResultText = `Appointment booked successfully for ${valid.label} Central Time. Confirm this to the customer and tell them the dealership will follow up to confirm.`;
    }

    messages.push({ role: "assistant", content: response.content });
    messages.push({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: toolUse.id, content: toolResultText }],
    });
    response = await callAnthropic(system, messages);
  }

  const reply = (response.content ?? [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n")
    .trim();

  return {
    reply: reply || (booked ? "You're all set — the dealership will follow up to confirm your visit!" : "Happy to help — which of the open times works best for you?"),
    booked,
    appointmentId,
    scheduledAt,
  };
}
