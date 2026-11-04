import { describe, it, expect } from "vitest";
import {
  MAX_NAME_BYTES,
  MIN_CAP,
  MAX_CAP,
  MAX_QTY,
  MAX_CREATOR_BPS,
  MIN_BASE,
  MAX_PRICE,
  MAX_PAGE,
} from "../stairs";
import { BOTCHAIN_ABI } from "../botchain/abi";

describe("Contract Limits and Constants parity", () => {
  it("exports match spec constants", () => {
    expect(MAX_NAME_BYTES).toBe(48);
    expect(MIN_CAP).toBe(2);
    expect(MAX_CAP).toBe(1000);
    expect(MAX_QTY).toBe(10);
    expect(MAX_CREATOR_BPS).toBe(2000);
    expect(MIN_BASE).toBe(1000000000000000n);
    expect(MAX_PRICE).toBe(1000000000000000000000000n);
    expect(MAX_PAGE).toBe(50);
  });

  it("ABI contains all spec functions and events", () => {
    const fnNames = BOTCHAIN_ABI.filter((x) => x.type === "function").map((x) => x.name);
    expect(fnNames).toContain("create");
    expect(fnNames).toContain("buy");
    expect(fnNames).toContain("sell");
    expect(fnNames).toContain("withdraw");
    expect(fnNames).toContain("editionOf");
    expect(fnNames).toContain("priceAt");
    expect(fnNames).toContain("quoteBuy");
    expect(fnNames).toContain("quoteSell");
    expect(fnNames).toContain("heldBy");
    expect(fnNames).toContain("latest");
    expect(fnNames).toContain("editionCount");
    expect(fnNames).toContain("pending");
  });
});
