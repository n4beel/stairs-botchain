import { formatEther } from "viem";

// Constants matching contract
export const MAX_NAME_BYTES = 48;
export const MIN_CAP = 2;
export const MAX_CAP = 1000;
export const MAX_QTY = 10;
export const MAX_CREATOR_BPS = 2000; // 20%
export const MIN_BASE = 1_000_000_000_000_000n; // 0.001 ether
export const MAX_PRICE = 1_000_000_000_000_000_000_000_000n; // 1,000,000 ether
export const MAX_PAGE = 50;

export interface Edition {
  creator: `0x${string}`;
  supply: number;
  cap: number;
  creatorBps: number;
  base: bigint;
  step: bigint;
  reserve: bigint;
  name: string;
}

export interface EditionData extends Edition {
  id: bigint;
}

/**
 * Calculates price of copy index `i` (0-indexed)
 */
export function priceAt(base: bigint, step: bigint, index: number | bigint): bigint {
  return base + step * BigInt(index);
}

/**
 * Calculates creator fee for a given step price
 */
export function fee(price: bigint, creatorBps: number): bigint {
  return (price * BigInt(creatorBps)) / 10000n;
}

/**
 * Calculates reserve share for a given step price
 */
export function reserveShare(price: bigint, creatorBps: number): bigint {
  return price - fee(price, creatorBps);
}

/**
 * Pure mirror of quoteBuy
 */
export function quoteBuy(
  base: bigint,
  step: bigint,
  supply: number,
  qty: number
): bigint {
  let total = 0n;
  for (let k = 0; k < qty; k++) {
    total += priceAt(base, step, supply + k);
  }
  return total;
}

/**
 * Pure mirror of quoteSell
 */
export function quoteSell(
  base: bigint,
  step: bigint,
  creatorBps: number,
  supply: number,
  qty: number
): bigint {
  let proceeds = 0n;
  for (let k = 0; k < qty; k++) {
    const idx = supply - k - 1;
    const p = priceAt(base, step, idx);
    proceeds += reserveShare(p, creatorBps);
  }
  return proceeds;
}

/**
 * Calculates total reserve accumulated for an edition at `supply`
 */
export function reserveAt(
  base: bigint,
  step: bigint,
  creatorBps: number,
  supply: number
): bigint {
  let res = 0n;
  for (let i = 0; i < supply; i++) {
    const p = priceAt(base, step, i);
    res += reserveShare(p, creatorBps);
  }
  return res;
}

export function formatBOT(wei: bigint): string {
  return `${formatEther(wei)} BOT`;
}
