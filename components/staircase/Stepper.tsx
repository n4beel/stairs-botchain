"use client";

import React from "react";

interface StepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (val: number) => void;
  disabled?: boolean;
}

export function Stepper({
  value,
  min = 1,
  max = 10,
  onChange,
  disabled = false,
}: StepperProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (value < max) onChange(value + 1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (value > min) onChange(value - 1);
    }
  };

  return (
    <div className="flex items-center space-x-1" role="group" aria-label="Quantity stepper">
      <button
        type="button"
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-8 h-8 flex items-center justify-center border border-[var(--border-default)] rounded bg-[var(--bg-surface)] text-[var(--text-primary)] font-bold hover:bg-[var(--bg-elevated)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition select-none"
        aria-label="Decrease quantity"
      >
        −
      </button>

      <input
        type="number"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          if (!isNaN(v)) {
            onChange(Math.min(max, Math.max(min, v)));
          }
        }}
        onKeyDown={handleKeyDown}
        className="w-14 h-8 text-center border border-[var(--border-default)] rounded bg-[var(--bg-surface)] text-[var(--text-primary)] font-mono text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        aria-label="Quantity"
      />

      <button
        type="button"
        disabled={disabled || value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="w-8 h-8 flex items-center justify-center border border-[var(--border-default)] rounded bg-[var(--bg-surface)] text-[var(--text-primary)] font-bold hover:bg-[var(--bg-elevated)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition select-none"
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
