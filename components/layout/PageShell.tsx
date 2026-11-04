"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ConnectButton from "@/components/ui/ConnectButton";
import NetworkBadge from "@/components/botchain/NetworkBadge";
import { footerLinks } from "@/lib/botchain/chain";
import BuiltOnBotChain from "@/components/botchain/BuiltOnBotChain";
import { app } from "@/lib/app-config";

export interface StairsNavItem {
  to: string;
  name: string;
}

interface PageShellProps {
  children: React.ReactNode;
  routes?: StairsNavItem[];
  heading?: string;
  subheading?: string;
}

/**
 * Architectural frame for Stairs (Archetype AS · Staircase).
 * High-contrast cyan horizon, solid black risers, bold condensed typography.
 */
export default function PageShell({ children, routes = [], heading, subheading }: PageShellProps) {
  const { site, explorer, contract } = footerLinks();
  const currentPath = usePathname();

  return (
    <div className="min-h-screen flex flex-col font-sans bg-[var(--bg-base)] text-[var(--text-primary)]">
      {/* Heavy-line Staircase Masthead */}
      <nav className="w-full bg-white border-b-4 border-[#001E24] sticky top-0 z-40 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="flex items-end h-6 gap-1 bg-[#3DDCF0] p-1 border-2 border-[#001E24]">
                <div className="w-1.5 h-2 bg-[#001E24]" />
                <div className="w-1.5 h-3.5 bg-[#7209B7]" />
                <div className="w-1.5 h-5 bg-[#001E24]" />
              </div>
              <span className="font-condensed font-black text-2xl uppercase tracking-tighter text-[#001E24]">
                {app.name}
              </span>
            </Link>

            {routes.length > 0 && (
              <div className="hidden sm:flex items-center gap-2 font-condensed font-bold text-sm tracking-wide uppercase">
                {routes.map((r) => {
                  const isCur = currentPath === r.to;
                  return (
                    <Link
                      key={r.to}
                      href={r.to}
                      className={[
                        "px-3 py-1 border-2 transition-all",
                        isCur
                          ? "bg-[#001E24] text-white border-[#001E24]"
                          : "bg-transparent text-[#145B65] border-transparent hover:border-[#001E24] hover:text-[#001E24]",
                      ].join(" ")}
                    >
                      {r.name}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <NetworkBadge />
            <ConnectButton />
          </div>
        </div>

        {/* Mobile Navigation bar */}
        {routes.length > 0 && (
          <div className="sm:hidden flex items-center gap-2 px-4 py-2 border-t-2 border-[#001E24] bg-[#F4FDFE] font-condensed font-bold text-xs uppercase overflow-x-auto">
            {routes.map((r) => {
              const isCur = currentPath === r.to;
              return (
                <Link
                  key={r.to}
                  href={r.to}
                  className={[
                    "px-2.5 py-1 whitespace-nowrap",
                    isCur ? "bg-[#001E24] text-white" : "text-[#145B65]",
                  ].join(" ")}
                >
                  {r.name}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8">
        {(heading || subheading) && (
          <header className="mb-8 border-b-4 border-[#001E24] pb-4 bg-white/40 p-4 border-2">
            {heading && (
              <h1 className="font-condensed font-black text-3xl sm:text-4xl text-[#001E24] uppercase tracking-tight">
                {heading}
              </h1>
            )}
            {subheading && (
              <p className="mt-1 text-sm sm:text-base font-semibold text-[#145B65]">
                {subheading}
              </p>
            )}
          </header>
        )}

        {children}
      </main>

      {/* 3-Link Shared Footer */}
      <footer className="mt-auto bg-white border-t-4 border-[#001E24] py-6 text-xs text-[#145B65] font-semibold">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BuiltOnBotChain />
            <span className="text-[#001E24]">•</span>
            <span className="font-condensed uppercase tracking-wider">{app.tagline}</span>
          </div>

          <div className="flex items-center gap-5 font-condensed uppercase tracking-wider text-sm">
            {contract && (
              <a
                href={contract}
                target="_blank"
                rel="noreferrer"
                className="hover:text-[#7209B7] hover:underline"
              >
                Contract
              </a>
            )}
            <a
              href={site}
              target="_blank"
              rel="noreferrer"
              className="hover:text-[#7209B7] hover:underline"
            >
              BOT Chain
            </a>
            <a
              href={explorer}
              target="_blank"
              rel="noreferrer"
              className="hover:text-[#7209B7] hover:underline"
            >
              Explorer
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
