"use client";

interface ProgressBarProps {
  current: number; // 1-based index of the active step
  total: number;
}

export default function ProgressBar({ current, total }: ProgressBarProps) {
  const safeTotal = Math.max(total, 1);
  const pct = Math.min(Math.max((current / safeTotal) * 100, 0), 100);

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-wider text-surface/60">
        <span>
          Step {Math.min(current, safeTotal)} of {safeTotal}
        </span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-600">
        <div
          className="h-full rounded-full bg-amber transition-all duration-300 ease-out"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}
