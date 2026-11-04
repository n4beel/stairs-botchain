import { formatEther } from "viem";

export function formatStairsError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);

  if (msg.includes("BadCap")) {
    return "Edition cap must be between 2 and 1000 copies.";
  }
  if (msg.includes("BadCurve")) {
    return "Invalid pricing curve: base must be >= 0.001 BOT, step > 0, and final copy <= 1,000,000 BOT.";
  }
  if (msg.includes("BadCut")) {
    return "Creator cut must be between 0% and 20% (0 to 2000 bps).";
  }
  if (msg.includes("BadQty")) {
    return "Quantity must be between 1 and 10 copies.";
  }
  const soldOutMatch = msg.match(/SoldOut\((\d+)\)/);
  if (soldOutMatch) {
    return `Only ${soldOutMatch[1]} left.`;
  }
  if (msg.includes("SoldOut")) {
    return "This edition is sold out.";
  }
  const priceMovedMatch = msg.match(/PriceMoved\((\d+)\)/);
  if (priceMovedMatch) {
    const expected = formatEther(BigInt(priceMovedMatch[1]));
    return `The price moved to ${expected} BOT. Review and try again.`;
  }
  if (msg.includes("PriceMoved")) {
    return "The price moved. Review and try again.";
  }
  const notEnoughMatch = msg.match(/NotEnough\((\d+)\)/);
  if (notEnoughMatch) {
    return `You hold ${notEnoughMatch[1]} copies.`;
  }
  if (msg.includes("NotEnough")) {
    return "You do not hold enough copies to sell.";
  }
  if (msg.includes("NothingToWithdraw")) {
    return "No creator cuts available to withdraw.";
  }
  if (msg.includes("TransferFailed")) {
    return "Transfer failed.";
  }
  if (msg.includes("User rejected") || msg.includes("User denied")) {
    return "Transaction was rejected in wallet.";
  }

  return msg.length > 120 ? `${msg.slice(0, 117)}...` : msg;
}
