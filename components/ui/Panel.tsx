import { HTMLAttributes, ReactNode } from "react";

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  noPadding?: boolean;
  stepped?: boolean;
  children?: ReactNode;
}

/**
 * Stairs panel with bold architectural border styling matching Archetype AS.
 */
export default function Panel({
  elevated,
  noPadding,
  stepped = false,
  children,
  className = "",
  style,
  ...props
}: PanelProps) {
  return (
    <div
      className={[
        "relative transition-shadow duration-150 rounded-none",
        noPadding ? "" : "p-5 sm:p-6",
        stepped ? "border-2 border-[#001E24] shadow-[4px_4px_0px_#001E24]" : "border border-[var(--border-default)]",
        className,
      ].join(" ")}
      style={{
        background: elevated ? "var(--bg-elevated)" : "var(--bg-surface)",
        color: "var(--text-primary)",
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
