"use client";

import { InputHTMLAttributes, forwardRef } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
}

const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  function TextField({ label, hint, id, className, ...rest }, ref) {
    const inputId = id ?? rest.name ?? label.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="w-full">
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-700/80"
        >
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          className={[
            "w-full rounded-xl border-2 border-surface-line bg-white px-4 py-3 text-ink outline-none transition-colors placeholder:text-ink-600/40 focus:border-amber",
            className ?? "",
          ].join(" ")}
          {...rest}
        />
        {hint ? (
          <p className="mt-1 text-xs text-ink-600/60">{hint}</p>
        ) : null}
      </div>
    );
  }
);

export default TextField;
