"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseEther, formatEther } from "viem";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import PageShell from "@/components/layout/PageShell";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { StaircaseChart } from "@/components/staircase/StaircaseChart";
import { BOTCHAIN_ABI } from "@/lib/botchain/abi";
import { activeBotChain } from "@/lib/botchain/chain";
import { getDeployment } from "@/lib/botchain/deployment";
import { assertActiveChain, checkedWrite, waitSuccess } from "@/lib/useChainWrite";
import { priceAt } from "@/lib/stairs";

export default function NewEditionPage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient({ chainId: activeBotChain.id });
  const deployment = getDeployment(activeBotChain.id);

  const [name, setName] = useState("");
  const [cap, setCap] = useState("50");
  const [base, setBase] = useState("0.01");
  const [step, setStep] = useState("0.002");
  const [creatorBps, setCreatorBps] = useState("500"); // 5%
  const [submitting, setSubmitting] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  // Parse values safely
  const parsedCap = parseInt(cap, 10) || 0;
  const parsedBps = parseInt(creatorBps, 10) || 0;
  let parsedBase = 0n;
  let parsedStep = 0n;
  let parseError: string | null = null;

  try {
    if (base && !isNaN(Number(base))) {
      parsedBase = parseEther(base);
    }
  } catch {
    parseError = "Invalid base price";
  }

  try {
    if (step && !isNaN(Number(step))) {
      parsedStep = parseEther(step);
    }
  } catch {
    parseError = "Invalid step amount";
  }

  // Contract validation checks
  const nameBytes = new TextEncoder().encode(name).length;
  let validationError: string | null = null;

  if (!name.trim()) {
    validationError = "Name cannot be empty.";
  } else if (nameBytes > 48) {
    validationError = `Name must be ≤ 48 bytes (currently ${nameBytes}).`;
  } else if (parsedCap < 2 || parsedCap > 1000) {
    validationError = "Cap must be between 2 and 1,000.";
  } else if (parsedBase < parseEther("0.001")) {
    validationError = "Base price must be at least 0.001 BOT.";
  } else if (parsedStep <= 0n) {
    validationError = "Step price must be greater than 0.";
  } else if (parsedBps < 0 || parsedBps > 2000) {
    validationError = "Creator cut must be between 0% and 20% (0–2000 bps).";
  } else {
    // Check max price
    const maxP = priceAt(parsedBase, parsedStep, parsedCap - 1);
    if (maxP > parseEther("1000000")) {
      validationError = "Last copy price exceeds maximum allowed (1,000,000 BOT).";
    }
  }

  const finalCopyPrice =
    parsedCap >= 2 && parsedBase > 0n && parsedStep > 0n
      ? priceAt(parsedBase, parsedStep, parsedCap - 1)
      : 0n;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validationError || !walletClient || !publicClient || !deployment?.address || !isConnected) return;

    try {
      setSubmitting(true);
      setTxError(null);
      await assertActiveChain(walletClient);

      const hash = await checkedWrite(walletClient, publicClient, {
        address: deployment.address,
        abi: BOTCHAIN_ABI,
        functionName: "create",
        args: [name.trim(), parsedCap, parsedBase, parsedStep, parsedBps],
      });

      await waitSuccess(publicClient, hash);
      router.push("/");
    } catch (err: any) {
      console.error("Create failed:", err);
      setTxError(err?.shortMessage || err?.message || "Failed to create edition");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-condensed tracking-tight text-[var(--text-primary)]">
            Create Edition
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Publish a staircase edition with a custom supply cap and bonding curve.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Panel className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider mb-1">
                Edition Name
              </label>
              <Input
                type="text"
                placeholder="e.g. Genesis Print, VIP Pass"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={48}
                required
              />
              <span className="text-[11px] text-[var(--text-muted)]">Max 48 bytes</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider mb-1">
                  Supply Cap (2–1,000)
                </label>
                <Input
                  type="number"
                  min="2"
                  max="1000"
                  value={cap}
                  onChange={(e) => setCap(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider mb-1">
                  Creator Cut (0–20%)
                </label>
                <div className="flex items-center space-x-2">
                  <Input
                    type="number"
                    min="0"
                    max="2000"
                    step="any"
                    value={creatorBps}
                    onChange={(e) => setCreatorBps(e.target.value)}
                    required
                  />
                  <span className="text-xs font-mono text-[var(--text-muted)] whitespace-nowrap">
                    bps ({(parsedBps / 100).toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider mb-1">
                  Base Price (BOT)
                </label>
                <Input
                  type="number"
                  step="any"
                  min="0.001"
                  value={base}
                  onChange={(e) => setBase(e.target.value)}
                  required
                />
                <span className="text-[11px] text-[var(--text-muted)]">Min 0.001 BOT</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider mb-1">
                  Step Increment (BOT)
                </label>
                <Input
                  type="number"
                  step="any"
                  min="0.000000000000000001"
                  value={step}
                  onChange={(e) => setStep(e.target.value)}
                  required
                />
                <span className="text-[11px] text-[var(--text-muted)]">Must be &gt; 0</span>
              </div>
            </div>
          </Panel>

          {/* Curve Preview */}
          <Panel className="p-5 space-y-3">
            <h2 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
              Bonding Curve Preview
            </h2>
            {parsedCap >= 2 && parsedBase > 0n && parsedStep > 0n ? (
              <div>
                <StaircaseChart
                  cap={parsedCap}
                  supply={0}
                  base={parsedBase}
                  step={parsedStep}
                />
                <div className="mt-3 flex items-center justify-between text-xs border-t border-[var(--border-subtle)] pt-2 font-mono">
                  <span>First copy: {formatEther(parsedBase)} BOT</span>
                  <span>Final copy: {formatEther(finalCopyPrice)} BOT</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">
                Enter valid parameters above to preview the staircase curve.
              </p>
            )}
          </Panel>

          {(validationError || parseError || txError) && (
            <Panel className="p-3 border-[var(--danger)] text-xs text-[var(--danger)]">
              {validationError || parseError || txError}
            </Panel>
          )}

          <div className="flex justify-end space-x-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push("/")}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting || Boolean(validationError) || !isConnected}
            >
              {submitting ? "Publishing..." : "Publish Edition"}
            </Button>
          </div>
        </form>
      </div>
    </PageShell>
  );
}
