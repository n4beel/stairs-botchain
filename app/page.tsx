"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatEther } from "viem";
import { usePublicClient } from "wagmi";
import PageShell from "@/components/layout/PageShell";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { StaircaseChart } from "@/components/staircase/StaircaseChart";
import { BOTCHAIN_ABI } from "@/lib/botchain/abi";
import { activeBotChain } from "@/lib/botchain/chain";
import { getDeployment } from "@/lib/botchain/deployment";
import { priceAt } from "@/lib/stairs";

interface EditionSummary {
  id: bigint;
  name: string;
  creator: `0x${string}`;
  supply: number;
  cap: number;
  base: bigint;
  step: bigint;
  creatorBps: number;
  nextPrice: bigint;
}

export default function HomePage() {
  const publicClient = usePublicClient({ chainId: activeBotChain.id });
  const deployment = getDeployment(activeBotChain.id);
  const [editions, setEditions] = useState<EditionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadEditions() {
      if (!publicClient || !deployment?.address) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);

        // Fetch editionCount
        const count = (await publicClient.readContract({
          address: deployment.address,
          abi: BOTCHAIN_ABI,
          functionName: "editionCount",
        })) as bigint;

        if (count === 0n) {
          if (!cancelled) {
            setEditions([]);
            setLoading(false);
          }
          return;
        }

        // Fetch latest editions (newest first)
        const fetchCount = count > 50n ? 50n : count;
        const offset = count > 50n ? count - 50n : 0n;

        const result = (await publicClient.readContract({
          address: deployment.address,
          abi: BOTCHAIN_ABI,
          functionName: "latest",
          args: [offset, fetchCount],
        })) as [
          readonly bigint[],
          readonly {
            creator: `0x${string}`;
            supply: number;
            cap: number;
            creatorBps: number;
            base: bigint;
            step: bigint;
            reserve: bigint;
            name: string;
          }[],
          bigint
        ];

        const [ids, latestRaw] = result;
        const list: EditionSummary[] = [];
        for (let i = latestRaw.length - 1; i >= 0; i--) {
          const item = latestRaw[i];
          const editionId = ids[i];
          const nextPrice = priceAt(item.base, item.step, item.supply);
          list.push({
            id: editionId,
            name: item.name,
            creator: item.creator,
            supply: item.supply,
            cap: item.cap,
            base: item.base,
            step: item.step,
            creatorBps: item.creatorBps,
            nextPrice,
          });
        }

        if (!cancelled) {
          setEditions(list);
          setLoading(false);
        }
      } catch (err: any) {
        console.error("Failed to load editions:", err);
        if (!cancelled) {
          setError(err?.message || "Failed to load editions");
          setLoading(false);
        }
      }
    }

    loadEditions();
    return () => {
      cancelled = true;
    };
  }, [deployment?.address]);

  return (
    <PageShell>
      <div className="space-y-6">
        {/* Banner with tagline & limitations */}
        <Panel className="p-5 border-l-4 border-l-[var(--accent)]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold font-condensed tracking-tight text-[var(--text-primary)]">
                Stairs
              </h1>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                Each copy costs more than the last. Sell back any time.
              </p>
            </div>
            <Link href="/new">
              <Button variant="primary">Create Edition</Button>
            </Link>
          </div>

          <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] text-xs text-[var(--text-muted)] space-y-1">
            <div className="font-semibold text-[var(--text-primary)] font-condensed uppercase tracking-wider">
              What selling back means
            </div>
            <ul className="list-disc list-inside space-y-0.5">
              <li>You sell at the top step&apos;s price, which can be less than you paid.</li>
              <li>The creator&apos;s cut is never returned.</li>
              <li>A copy is a count here, not a token. It can&apos;t be moved.</li>
            </ul>
          </div>
        </Panel>

        {/* Editions list */}
        {loading ? (
          <div className="py-12 flex justify-center items-center">
            <Spinner />
          </div>
        ) : error ? (
          <Panel className="p-4 border-[var(--danger)] text-sm text-[var(--danger)]">
            {error}
          </Panel>
        ) : editions.length === 0 ? (
          <Panel className="p-8 text-center">
            <p className="text-sm text-[var(--text-muted)] mb-3">No editions created yet.</p>
            <Link href="/new">
              <Button variant="primary">Create the first edition</Button>
            </Link>
          </Panel>
        ) : (
          <div>
            <h2 className="text-xs uppercase font-condensed tracking-wider font-semibold text-[var(--text-muted)] mb-3">
              All Editions (Newest First)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {editions.map((ed) => (
                <Panel key={ed.id.toString()} className="p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <Link
                        href={`/edition/${ed.id.toString()}`}
                        className="hover:underline font-bold text-lg font-condensed text-[var(--text-primary)]"
                      >
                        #{ed.id.toString()} {ed.name}
                      </Link>
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                        {ed.supply}/{ed.cap} sold
                      </span>
                    </div>

                    <div className="my-3">
                      <StaircaseChart
                        cap={ed.cap}
                        supply={ed.supply}
                        base={ed.base}
                        step={ed.step}
                        compact={true}
                      />
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[var(--text-muted)]">Next step: </span>
                      <span className="font-mono font-bold text-[var(--text-primary)]">
                        {ed.supply >= ed.cap ? "Sold Out" : `${formatEther(ed.nextPrice)} BOT`}
                      </span>
                    </div>
                    <Link href={`/edition/${ed.id.toString()}`}>
                      <Button variant="ghost" className="text-xs py-1 px-3">
                        View Edition →
                      </Button>
                    </Link>
                  </div>
                </Panel>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
