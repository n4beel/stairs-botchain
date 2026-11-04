"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { formatEther } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import PageShell from "@/components/layout/PageShell";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { StaircaseChart } from "@/components/staircase/StaircaseChart";
import { Stepper } from "@/components/staircase/Stepper";
import { BOTCHAIN_ABI } from "@/lib/botchain/abi";
import { activeBotChain } from "@/lib/botchain/chain";
import { getDeployment } from "@/lib/botchain/deployment";
import { assertActiveChain, checkedWrite, waitSuccess } from "@/lib/useChainWrite";
import { quoteBuy, quoteSell } from "@/lib/stairs";

interface EditionDetail {
  id: bigint;
  name: string;
  creator: `0x${string}`;
  supply: number;
  cap: number;
  creatorBps: number;
  base: bigint;
  step: bigint;
  reserve: bigint;
}

export default function EditionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const editionId = BigInt(resolvedParams.id);

  const publicClient = usePublicClient({ chainId: activeBotChain.id });
  const deployment = getDeployment(activeBotChain.id);
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [edition, setEdition] = useState<EditionDetail | null>(null);
  const [userHeld, setUserHeld] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Buy & Sell state
  const [buyQty, setBuyQty] = useState(1);
  const [sellQty, setSellQty] = useState(1);
  const [isBuying, setIsBuying] = useState(false);
  const [isSelling, setIsSelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);

  async function loadData() {
    if (!publicClient || !deployment?.address) return;
    try {
      setLoadError(null);

      const [edData, held] = await Promise.all([
        publicClient.readContract({
          address: deployment.address,
          abi: BOTCHAIN_ABI,
          functionName: "editionOf",
          args: [editionId],
        }) as Promise<{
          creator: `0x${string}`;
          supply: number;
          cap: number;
          creatorBps: number;
          base: bigint;
          step: bigint;
          reserve: bigint;
          name: string;
        }>,
        address
          ? (publicClient.readContract({
              address: deployment.address,
              abi: BOTCHAIN_ABI,
              functionName: "heldBy",
              args: [editionId, address],
            }) as Promise<number>)
          : Promise.resolve(0),
      ]);

      setEdition({
        id: editionId,
        name: edData.name,
        creator: edData.creator,
        supply: edData.supply,
        cap: edData.cap,
        creatorBps: edData.creatorBps,
        base: edData.base,
        step: edData.step,
        reserve: edData.reserve,
      });
      setUserHeld(Number(held));
    } catch (err: any) {
      console.error("Failed to load edition:", err);
      setLoadError(err?.message || "Edition not found");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [deployment?.address, address, editionId]);

  if (loading) {
    return (
      <PageShell>
        <div className="py-20 flex justify-center">
          <Spinner />
        </div>
      </PageShell>
    );
  }

  if (loadError || !edition) {
    return (
      <PageShell>
        <Panel className="p-6 text-center border-[var(--danger)]">
          <h2 className="text-lg font-bold text-[var(--danger)] mb-2">Error</h2>
          <p className="text-sm text-[var(--text-muted)] mb-4">
            {loadError || "Edition not found"}
          </p>
          <Link href="/">
            <Button variant="ghost">Back to Editions</Button>
          </Link>
        </Panel>
      </PageShell>
    );
  }

  // Quotes
  const availableToBuy = Math.max(0, edition.cap - edition.supply);
  const effectiveBuyQty = Math.min(buyQty, Math.max(1, availableToBuy));
  const buyCost =
    availableToBuy > 0
      ? quoteBuy(edition.base, edition.step, edition.supply, effectiveBuyQty)
      : 0n;

  const effectiveSellQty = Math.min(sellQty, Math.max(1, userHeld));
  const sellProceeds =
    userHeld > 0 && edition.supply > 0
      ? quoteSell(
          edition.base,
          edition.step,
          edition.creatorBps,
          edition.supply,
          effectiveSellQty
        )
      : 0n;

  // Buy handler
  async function handleBuy() {
    if (!walletClient || !publicClient || !deployment?.address || !isConnected) return;
    try {
      setIsBuying(true);
      setActionError(null);
      setTxSuccess(null);
      await assertActiveChain(walletClient);

      // Slippage check: quote directly from contract first
      const currentQuote = (await publicClient.readContract({
        address: deployment.address,
        abi: BOTCHAIN_ABI,
        functionName: "quoteBuy",
        args: [editionId, effectiveBuyQty],
      })) as bigint;

      const hash = await checkedWrite(walletClient, publicClient, {
        address: deployment.address,
        abi: BOTCHAIN_ABI,
        functionName: "buy",
        args: [editionId, effectiveBuyQty, currentQuote],
        value: currentQuote,
      });

      await waitSuccess(publicClient, hash);
      setTxSuccess(`Successfully bought ${effectiveBuyQty} cop${effectiveBuyQty > 1 ? "ies" : "y"}!`);
      await loadData();
    } catch (err: any) {
      console.error("Buy failed:", err);
      const msg = err?.shortMessage || err?.message || "Failed to buy";
      if (msg.includes("PriceMoved")) {
        setActionError("The price moved while confirming. Review updated quote and try again.");
      } else if (msg.includes("SoldOut")) {
        setActionError("Edition is sold out or not enough copies remain.");
      } else {
        setActionError(msg);
      }
      await loadData();
    } finally {
      setIsBuying(false);
    }
  }

  // Sell handler
  async function handleSell() {
    if (!walletClient || !publicClient || !deployment?.address || !isConnected || userHeld <= 0) return;
    try {
      setIsSelling(true);
      setActionError(null);
      setTxSuccess(null);
      await assertActiveChain(walletClient);

      // Slippage check: quote directly from contract first
      const currentQuote = (await publicClient.readContract({
        address: deployment.address,
        abi: BOTCHAIN_ABI,
        functionName: "quoteSell",
        args: [editionId, effectiveSellQty],
      })) as bigint;

      const hash = await checkedWrite(walletClient, publicClient, {
        address: deployment.address,
        abi: BOTCHAIN_ABI,
        functionName: "sell",
        args: [editionId, effectiveSellQty, currentQuote],
      });

      await waitSuccess(publicClient, hash);
      setTxSuccess(`Successfully sold ${effectiveSellQty} cop${effectiveSellQty > 1 ? "ies" : "y"}!`);
      await loadData();
    } catch (err: any) {
      console.error("Sell failed:", err);
      const msg = err?.shortMessage || err?.message || "Failed to sell";
      if (msg.includes("PriceMoved")) {
        setActionError("The price moved while confirming. Review updated quote and try again.");
      } else if (msg.includes("NotEnough")) {
        setActionError(`You do not hold ${effectiveSellQty} copies.`);
      } else {
        setActionError(msg);
      }
      await loadData();
    } finally {
      setIsSelling(false);
    }
  }

  return (
    <PageShell>
      <div className="space-y-6">
        {/* Navigation & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <Link
              href="/"
              className="text-xs text-[var(--text-muted)] hover:underline flex items-center gap-1 mb-1"
            >
              ← Back to all editions
            </Link>
            <h1 className="text-3xl font-bold font-condensed tracking-tight text-[var(--text-primary)]">
              #{edition.id.toString()} {edition.name}
            </h1>
            <p className="text-xs font-mono text-[var(--text-muted)]">
              Creator: {edition.creator} • Cut: {(edition.creatorBps / 100).toFixed(1)}%
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-sm font-mono px-3 py-1 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded font-semibold text-[var(--text-primary)]">
              Supply: {edition.supply}/{edition.cap}
            </span>
            {userHeld > 0 && (
              <span className="text-sm font-mono px-3 py-1 bg-[var(--accent)] text-[var(--accent-ink)] rounded font-semibold">
                You hold: {userHeld}
              </span>
            )}
          </div>
        </div>

        {/* Staircase Visual */}
        <Panel className="p-5">
          <StaircaseChart
            cap={edition.cap}
            supply={edition.supply}
            base={edition.base}
            step={edition.step}
            userHeld={userHeld}
          />
        </Panel>

        {/* Feedback messages */}
        {actionError && (
          <Panel className="p-3 border-[var(--danger)] text-sm text-[var(--danger)]">
            {actionError}
          </Panel>
        )}
        {txSuccess && (
          <Panel className="p-3 border-[var(--success)] text-sm text-[var(--success)]">
            {txSuccess}
          </Panel>
        )}

        {/* Buy & Sell Panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Buy Panel */}
          <Panel className="p-5 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
                <h2 className="text-sm font-bold uppercase tracking-wider font-condensed text-[var(--text-primary)]">
                  Buy Copies
                </h2>
                <span className="text-xs font-mono text-[var(--text-muted)]">
                  {availableToBuy} available
                </span>
              </div>

              {availableToBuy > 0 ? (
                <>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-xs text-[var(--text-muted)]">Quantity (1–10)</span>
                    <Stepper
                      value={buyQty}
                      min={1}
                      max={Math.min(10, availableToBuy)}
                      onChange={setBuyQty}
                      disabled={isBuying}
                    />
                  </div>

                  <div className="p-3 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-[var(--text-muted)]">Total cost:</span>
                      <span className="font-mono font-bold text-sm text-[var(--text-primary)]">
                        {formatEther(buyCost)} BOT
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      Covers steps {edition.supply + 1} to {edition.supply + effectiveBuyQty}
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-6 text-center text-sm text-[var(--text-muted)]">
                  This edition is completely sold out.
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-[var(--border-subtle)]">
              <Button
                variant="primary"
                onClick={handleBuy}
                disabled={isBuying || availableToBuy === 0 || !isConnected}
                className="w-full justify-center"
              >
                {isBuying
                  ? "Confirming..."
                  : availableToBuy === 0
                  ? "Sold Out"
                  : `Buy ${effectiveBuyQty}: ${formatEther(buyCost)} BOT`}
              </Button>
            </div>
          </Panel>

          {/* Sell Panel */}
          <Panel className="p-5 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
                <h2 className="text-sm font-bold uppercase tracking-wider font-condensed text-[var(--text-primary)]">
                  Sell Back Copies
                </h2>
                <span className="text-xs font-mono text-[var(--text-muted)]">
                  You hold: {userHeld}
                </span>
              </div>

              {userHeld > 0 ? (
                <>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-xs text-[var(--text-muted)]">Quantity (1–{userHeld})</span>
                    <Stepper
                      value={sellQty}
                      min={1}
                      max={Math.min(10, userHeld)}
                      onChange={setSellQty}
                      disabled={isSelling}
                    />
                  </div>

                  <div className="p-3 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-[var(--text-muted)]">Proceeds:</span>
                      <span className="font-mono font-bold text-sm text-[var(--text-primary)]">
                        {formatEther(sellProceeds)} BOT
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      Returns reserve share from top {effectiveSellQty} step{effectiveSellQty > 1 ? "s" : ""}
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-6 text-center text-sm text-[var(--text-muted)]">
                  You hold no copies in this edition to sell back.
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-[var(--border-subtle)]">
              <Button
                variant="danger"
                onClick={handleSell}
                disabled={isSelling || userHeld === 0 || !isConnected}
                className="w-full justify-center"
              >
                {isSelling
                  ? "Confirming..."
                  : userHeld === 0
                  ? "No Copies to Sell"
                  : `Sell ${effectiveSellQty}: ${formatEther(sellProceeds)} BOT`}
              </Button>
            </div>
          </Panel>
        </div>

        {/* Educational copy on selling back */}
        <Panel className="p-4 text-xs text-[var(--text-muted)] space-y-1">
          <div className="font-semibold text-[var(--text-primary)] font-condensed uppercase tracking-wider">
            What selling back means
          </div>
          <ul className="list-disc list-inside space-y-0.5">
            <li>You sell at the top step&apos;s price, which can be less than you paid.</li>
            <li>The creator&apos;s cut is never returned.</li>
            <li>A copy is a count here, not a token. It can&apos;t be moved.</li>
          </ul>
        </Panel>
      </div>
    </PageShell>
  );
}
