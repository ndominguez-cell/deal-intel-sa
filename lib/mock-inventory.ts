export type VehicleCategory = "Truck" | "SUV" | "Sedan" | "Van";

export type InventoryVehicle = {
  id: string;
  stock: string;
  dealer: "Ancira";
  year: number;
  make: string;
  model: string;
  trim: string;
  category: VehicleCategory;
  condition: "New" | "Used";
  price: number;
  msrp?: number;
  mileage: number;
  color: string;
  headline: string;
  reason: string;
  daysInInventory: number;
  priceDrop?: number;
  imageUrl: string;
};

/**
 * Temporary fixtures only. These are intentionally labeled MOCK so they cannot
 * be mistaken for live Ancira inventory while the approved feed is pending.
 */
export const MOCK_ANCIRA_INVENTORY: InventoryVehicle[] = [
  {
    id: "mock-ancira-tacoma-001",
    stock: "MOCK-TACOMA-001",
    dealer: "Ancira",
    year: 2023,
    make: "Toyota",
    model: "Tacoma",
    trim: "SR5 Double Cab",
    category: "Truck",
    condition: "Used",
    price: 32990,
    mileage: 28410,
    color: "Ice Cap",
    headline: "A proven midsize truck with everyday flexibility.",
    reason: "Strong truck demand, practical mileage, and a clean value story.",
    daysInInventory: 18,
    priceDrop: 1500,
    imageUrl: "https://images.unsplash.com/photo-1551830820-330a71b99659?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "mock-ancira-tahoe-002",
    stock: "MOCK-TAHOE-002",
    dealer: "Ancira",
    year: 2022,
    make: "Chevrolet",
    model: "Tahoe",
    trim: "LT",
    category: "SUV",
    condition: "Used",
    price: 48990,
    mileage: 36120,
    color: "Summit White",
    headline: "Three-row space for road trips, teams, and daily life.",
    reason: "High-demand three-row SUV with a recent price movement.",
    daysInInventory: 24,
    priceDrop: 2200,
    imageUrl: "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "mock-ancira-seltos-003",
    stock: "MOCK-SELTOS-003",
    dealer: "Ancira",
    year: 2024,
    make: "Kia",
    model: "Seltos",
    trim: "S",
    category: "SUV",
    condition: "New",
    price: 26990,
    msrp: 28190,
    mileage: 12,
    color: "Gravity Gray",
    headline: "Compact SUV convenience without the oversized footprint.",
    reason: "New inventory, low miles, and a simple value-forward price.",
    daysInInventory: 9,
    priceDrop: 1200,
    imageUrl: "https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "mock-ancira-altima-004",
    stock: "MOCK-ALTIMA-004",
    dealer: "Ancira",
    year: 2023,
    make: "Nissan",
    model: "Altima",
    trim: "SV",
    category: "Sedan",
    condition: "Used",
    price: 23990,
    mileage: 22880,
    color: "Super Black",
    headline: "A comfortable commuter with modern daily-driver appeal.",
    reason: "Efficient sedan profile, manageable mileage, and a recent reduction.",
    daysInInventory: 31,
    priceDrop: 1800,
    imageUrl: "https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "mock-ancira-sienna-005",
    stock: "MOCK-SIENNA-005",
    dealer: "Ancira",
    year: 2021,
    make: "Toyota",
    model: "Sienna",
    trim: "XLE",
    category: "Van",
    condition: "Used",
    price: 39990,
    mileage: 44750,
    color: "Celestial Silver",
    headline: "Flexible seating and family-ready practicality.",
    reason: "Family-friendly format with a strong used-market use case.",
    daysInInventory: 27,
    priceDrop: 2500,
    imageUrl: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "mock-ancira-f150-006",
    stock: "MOCK-F150-006",
    dealer: "Ancira",
    year: 2022,
    make: "Ford",
    model: "F-150",
    trim: "XLT SuperCrew",
    category: "Truck",
    condition: "Used",
    price: 41990,
    mileage: 33200,
    color: "Oxford White",
    headline: "Full-size capability for workdays and weekends.",
    reason: "Popular full-size truck with broad local buyer appeal.",
    daysInInventory: 15,
    priceDrop: 1700,
    imageUrl: "https://images.unsplash.com/photo-1605893477799-b99e3b8b93fe?auto=format&fit=crop&w=1200&q=80",
  },
];

export function scoreVehicle(vehicle: InventoryVehicle): number {
  const priceMovement = Math.min(vehicle.priceDrop ?? 0, 3000) / 30;
  const freshness = Math.max(0, 35 - vehicle.daysInInventory) * 1.5;
  const mileageSignal = Math.max(0, 60000 - vehicle.mileage) / 3000;
  const newSignal = vehicle.condition === "New" ? 8 : 0;
  return Math.round(priceMovement + freshness + mileageSignal + newSignal);
}

export function getRankedMockInventory(): (InventoryVehicle & { score: number })[] {
  return MOCK_ANCIRA_INVENTORY
    .map((vehicle) => ({ ...vehicle, score: scoreVehicle(vehicle) }))
    .sort((a, b) => b.score - a.score);
}

export function getMockVehicle(id: string): InventoryVehicle | undefined {
  return MOCK_ANCIRA_INVENTORY.find((vehicle) => vehicle.id === id);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
