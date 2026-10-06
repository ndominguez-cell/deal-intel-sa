import { BRAND_LOGO_PATHS } from "@/lib/brand-logos";

// Makes without a logo in BRAND_LOGO_PATHS (GMC, Mercedes-Benz, Dodge, Lexus, Porsche, …)
// get a monogram badge instead. Regenerate logos with script/generate-brand-logos.mjs.
const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
const BY_NAME = new Map(Object.entries(BRAND_LOGO_PATHS).map(([title, path]) => [normalize(title), path]));

/** "GMC" → "GMC", "Mercedes-Benz" → "MB", "Land Rover" → "LR", "Dodge" → "D". */
export function monogram(make: string): string {
  const words = make.split(/[\s-]+/).filter(Boolean);
  if (words.length > 1) return words.slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
  return make.length <= 3 ? make.toUpperCase() : make[0]!.toUpperCase();
}

/** SVG path (24×24 viewBox) for a make as MarketCheck spells it ("RAM", "KIA", "INFINITI"), if known. */
export function brandLogoPath(make: string): string | undefined {
  return BY_NAME.get(normalize(make));
}

export function BrandMark({ make, color, background }: { make: string; color: string; background: string }) {
  const path = brandLogoPath(make);
  return (
    <span
      className="grid h-8 w-8 shrink-0 place-items-center rounded-md"
      style={{ background, color }}
      role="img"
      aria-label={`${make} logo`}
      title={make}
    >
      {path ? (
        <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" aria-hidden>
          <path d={path} fill="currentColor" />
        </svg>
      ) : (
        <span className="text-[10px] font-extrabold tracking-tight" aria-hidden>{monogram(make)}</span>
      )}
    </span>
  );
}
