import { describe, it, expect } from "vitest";
import {
  priceAt,
  fee,
  reserveShare,
  quoteBuy,
  quoteSell,
  reserveAt,
  MIN_BASE,
  MAX_PRICE,
  MIN_CAP,
  MAX_CAP,
  MAX_QTY,
  MAX_CREATOR_BPS,
} from "../stairs";

describe("Stairs Pure Lib", () => {
  const base = 100_000_000_000_000_000n; // 0.1 ETH
  const step = 10_000_000_000_000_000n; // 0.01 ETH
  const bps = 1000; // 10%

  it("calculates step prices correctly", () => {
    expect(priceAt(base, step, 0)).toBe(base);
    expect(priceAt(base, step, 1)).toBe(base + step);
    expect(priceAt(base, step, 10)).toBe(base + step * 10n);
  });

  it("calculates fee and reserveShare correctly", () => {
    const p = 100_000_000_000_000_000n;
    expect(fee(p, bps)).toBe(10_000_000_000_000_000n);
    expect(reserveShare(p, bps)).toBe(90_000_000_000_000_000n);
  });

  it("quoteBuy accurately sums step prices", () => {
    // Buy 3 copies at supply 0: step 0, 1, 2
    const p0 = priceAt(base, step, 0);
    const p1 = priceAt(base, step, 1);
    const p2 = priceAt(base, step, 2);
    expect(quoteBuy(base, step, 0, 3)).toBe(p0 + p1 + p2);

    // Buy 2 copies at supply 3: step 3, 4
    const p3 = priceAt(base, step, 3);
    const p4 = priceAt(base, step, 4);
    expect(quoteBuy(base, step, 3, 2)).toBe(p3 + p4);
  });

  it("quoteSell accurately sums reserve shares in reverse", () => {
    // Sell 2 copies at supply 5: step 4 and step 3
    const p4 = priceAt(base, step, 4);
    const p3 = priceAt(base, step, 3);
    const r4 = reserveShare(p4, bps);
    const r3 = reserveShare(p3, bps);
    expect(quoteSell(base, step, bps, 5, 2)).toBe(r4 + r3);
  });

  it("reserveAt equals accumulated reserve", () => {
    const supply = 5;
    let expected = 0n;
    for (let i = 0; i < supply; i++) {
      expected += reserveShare(priceAt(base, step, i), bps);
    }
    expect(reserveAt(base, step, bps, supply)).toBe(expected);
  });

  it("matches contract boundary constants", () => {
    expect(MIN_BASE).toBe(1_000_000_000_000_000n);
    expect(MAX_PRICE).toBe(1_000_000_000_000_000_000_000_000n);
    expect(MIN_CAP).toBe(2);
    expect(MAX_CAP).toBe(1000);
    expect(MAX_QTY).toBe(10);
    expect(MAX_CREATOR_BPS).toBe(2000);
  });
});
