"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatEther } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import PageShell from "@/components/layout/PageShell";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { BOTCHAIN_ABI } from "@/lib/botchain/abi";
import { activeBotChain } from "@/lib/botchain/chain";
import { getDeployment } from "@/lib/botchain/deployment";
import { assertActiveChain, checkedWrite, waitSuccess } from "@/lib/useChainWrite";

interface UserHolding {
  id: bigint;
  name: string;
  held: number;
  supply: number;
  cap: number;
}

export default function MePage() {
  const publicClient = usePublicClient({ chainId: activeBotChain.id });
  const deployment = getDeployment(activeBotChain.id);
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [holdings, setHoldings] = useState<UserHolding[]>([]);
  const [pendingCut, setPendingCut] = useState<bigint>(0n);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawMsg, setWithdrawMsg] = useState<string | null>(null);

  async function loadUserData() {
    if (!publicClient || !deployment?.address || !address) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Pending creator cut
      const cut = (await publicClient.readContract({
        address: deployment.address,
        abi: BOTCHAIN_ABI,
        functionName: "pending",
        args: [address],
      })) as bigint;
      setPendingCut(cut);

      // Edition count
      const count = (await publicClient.readContract({
        address: deployment.address,
        abi: BOTCHAIN_ABI,
        functionName: "editionCount",
      })) as bigint;

      const userHoldingsList: UserHolding[] = [];

      // Check held for each edition
      for (let i = 1n; i <= count; i++) {
        const held = (await publicClient.readContract({
          address: deployment.address,
          abi: BOTCHAIN_ABI,
          functionName: "heldBy",
          args: [i, address],
        })) as number;

        if (held > 0) {
          const ed = (await publicClient.readContract({
            address: deployment.address,
            abi: BOTCHAIN_ABI,
            functionName: "editionOf",
            args: [i],
          })) as { name: string; supply: number; cap: number };

          userHoldingsList.push({
            id: i,
            name: ed.name,
            held,
            supply: ed.supply,
            cap: ed.cap,
          });
        }
      }

      setHoldings(userHoldingsList);
    } catch (err) {
      console.error("Failed to load user data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUserData();
  }, [deployment?.address, address]);

  async function handleWithdraw() {
    if (!walletClient || !publicClient || !deployment?.address || !isConnected || pendingCut <= 0n) return;
    try {
      setWithdrawing(true);
      setWithdrawMsg(null);
      await assertActiveChain(walletClient);

      const hash = await checkedWrite(walletClient, publicClient, {
        address: deployment.address,
        abi: BOTCHAIN_ABI,
        functionName: "withdraw",
      });

      await waitSuccess(publicClient, hash);
      setWithdrawMsg("Creator cuts successfully withdrawn to your wallet!");
      await loadUserData();
    } catch (err: any) {
      console.error("Withdraw failed:", err);
      setWithdrawMsg(err?.shortMessage || err?.message || "Failed to withdraw");
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <PageShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-condensed tracking-tight text-[var(--text-primary)]">
            My Portfolio
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Track your edition holdings and claim creator cuts.
          </p>
        </div>

        {/* Creator Cuts Section */}
        <Panel className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xs uppercase font-condensed tracking-wider font-semibold text-[var(--text-muted)]">
                Earned Creator Cuts
              </h2>
              <div className="text-2xl font-bold font-mono text-[var(--text-primary)] mt-1">
                {formatEther(pendingCut)} BOT
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Accumulated cuts from copies sold across your editions.
              </p>
            </div>

            <div>
              <Button
                variant="primary"
                onClick={handleWithdraw}
                disabled={withdrawing || pendingCut <= 0n || !isConnected}
              >
                {withdrawing ? "Withdrawing..." : "Withdraw Cuts"}
              </Button>
            </div>
          </div>

          {withdrawMsg && (
            <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] text-xs text-[var(--text-primary)]">
              {withdrawMsg}
            </div>
          )}
        </Panel>

        {/* Holdings Section */}
        <div>
          <h2 className="text-xs uppercase font-condensed tracking-wider font-semibold text-[var(--text-muted)] mb-3">
            Your Edition Holdings
          </h2>

          {!isConnected ? (
            <Panel className="p-6 text-center text-sm text-[var(--text-muted)]">
              Connect your wallet to view your copies.
            </Panel>
          ) : loading ? (
            <div className="py-12 flex justify-center">
              <Spinner />
            </div>
          ) : holdings.length === 0 ? (
            <Panel className="p-6 text-center text-sm text-[var(--text-muted)]">
              You do not hold any copies in any active editions.
            </Panel>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {holdings.map((h) => (
                <Panel key={h.id.toString()} className="p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Link
                        href={`/edition/${h.id.toString()}`}
                        className="font-bold text-lg font-condensed hover:underline text-[var(--text-primary)]"
                      >
                        #{h.id.toString()} {h.name}
                      </Link>
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-[var(--accent)] text-[var(--accent-ink)] font-semibold">
                        {h.held} held
                      </span>
                    </div>

                    <div className="text-xs text-[var(--text-muted)] mb-3">
                      Total edition supply: {h.supply} of {h.cap}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[var(--border-subtle)] flex justify-end">
                    <Link href={`/edition/${h.id.toString()}`}>
                      <Button variant="ghost" className="text-xs py-1 px-3">
                        View / Sell Back →
                      </Button>
                    </Link>
                  </div>
                </Panel>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
