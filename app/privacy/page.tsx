import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — SA Auto Match",
  robots: { index: false, follow: false },
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-[100dvh] max-w-2xl bg-ink px-5 py-10 text-surface">
      <h1 className="text-2xl font-extrabold text-amber">Privacy Policy</h1>
      <p className="mt-4 text-sm leading-relaxed text-surface/80">
        SA Auto Match (&quot;we&quot;) connects vehicle shoppers with
        participating dealerships. This page explains what we collect and how we
        use it. We are not a lender or financing company and we do not make
        credit decisions.
      </p>

      <h2 className="mt-8 text-lg font-bold">What we collect</h2>
      <p className="mt-2 text-sm leading-relaxed text-surface/80">
        Information you provide in our form — your name, phone number, optional
        email, vehicle preferences, trade-in details, self-reported budget and
        credit range, and shopping timeframe. We also capture basic marketing
        attribution (UTM parameters) so we know which ad brought you here.
      </p>

      <h2 className="mt-8 text-lg font-bold">How we use it</h2>
      <p className="mt-2 text-sm leading-relaxed text-surface/80">
        We share your details with the participating dealership and its sales
        representative so they can contact you about matching vehicles. With
        your consent, they may contact you by phone call or text message,
        including via automated or prerecorded means. Consent is not a condition
        of any purchase. Message and data rates may apply. You can opt out at
        any time by replying STOP to a text or asking us to remove your
        information.
      </p>

      <h2 className="mt-8 text-lg font-bold">Contact</h2>
      <p className="mt-2 text-sm leading-relaxed text-surface/80">
        To access, correct, or delete your information, contact us at the email
        address published on our website.
      </p>

      <Link
        href="/"
        className="mt-8 inline-block text-sm font-semibold text-amber underline underline-offset-2"
      >
        ← Back to SA Auto Match
      </Link>
    </main>
  );
}
