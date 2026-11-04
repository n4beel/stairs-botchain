"use client";

import { ButtonHTMLAttributes, CSSProperties, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "stair";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantStyles: Record<Variant, CSSProperties> = {
  primary: {
    background: "var(--accent)",
    color: "var(--accent-ink)",
    border: "2px solid #001E24",
    boxShadow: "3px 3px 0px #001E24",
  },
  secondary: {
    background: "var(--bg-surface)",
    color: "var(--text-primary)",
    border: "2px solid #001E24",
    boxShadow: "3px 3px 0px #001E24",
  },
  ghost: {
    background: "transparent",
    color: "var(--text-primary)",
    border: "1px solid var(--border-default)",
  },
  danger: {
    background: "transparent",
    color: "var(--danger)",
    border: "2px solid var(--danger)",
  },
  stair: {
    background: "var(--accent)",
    color: "var(--accent-ink)",
    border: "2px solid var(--text-primary)",
    boxShadow: "4px 4px 0px var(--text-primary)",
    letterSpacing: "0.04em",
  },
};

const sizeStyles: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs font-semibold",
  md: "px-5 py-2.5 text-sm font-semibold",
  lg: "px-6 py-3.5 text-base font-bold",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, disabled, children, className = "", style, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={[
          "inline-flex items-center justify-center gap-2 rounded-none transition-all active:translate-y-0.5",
          "cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none font-condensed uppercase tracking-wider",
          sizeStyles[size],
          className,
        ].join(" ")}
        style={{ ...variantStyles[variant], ...style }}
        {...props}
      >
        {loading ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span>{children}</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
