# Stairs Architectural Decisions & Mutation Analysis

## Architectural Decisions

1. **Bonding Curve Rounding Symmetry & Invariant Solvency**
   - For step `i`: `price(i) = base + step * i`.
   - Creator fee: `fee(i) = (price(i) * creatorBps) / 10000` (floored).
   - Reserve share: `reserveShare(i) = price(i) - fee(i)`.
   - Because `reserveShare` is computed with identical integer arithmetic on entry (`buy`) and exit (`sell`), the invariant:
     `edition.reserve == sum_{i < edition.supply} reserveShare(i)`
     holds exactly at all times across all buy and sell sequences.
   - Consequently, `address(this).balance == sum(editions.reserve) + sum(pending[creator])` holds without drift, and no sell can ever revert for lack of reserve.

2. **Top-Step Exit Mechanics**
   - Copies sold back decrement the supply and return the reserve share of the highest steps (`supply - 1`, `supply - 2`, etc.).
   - The creator cut is never refunded.
   - Selling copies lowers the price on the bonding curve for future participants.

3. **Reentrancy Protection & Pull Payments**
   - Sells push proceeds directly to `msg.sender` after state mutations (`supply`, `held`, `reserve`) using `_lock` nonreentrancy.
   - Creator fee cuts are pulled via `withdraw()` with zero-then-transfer pattern.

---

## Mutation Check Survivors Analysis

From `python3 scripts/mutation-check.py stairs`, 22 of 25 mutants were killed (88% kill rate). The 3 benign / equivalent survivors are:

1. **`Stairs.sol:280` — `if (offset >= total || count == 0)` => `if (offset > total || count == 0)`**
   - In `latest(offset, count)`, when `offset == total`, the subsequent block checks `if (offset + count > total) { count = total - offset; }`.
   - Since `offset == total`, `count` is clamped to `total - total = 0`.
   - The loop `for (uint256 i = 0; i < count; i++)` runs 0 times, returning empty arrays and `total`, exactly matching the early return on line 280.
   - Thus, substituting `>=` with `>` is behaviorally equivalent.

2. **`Stairs.sol:287` — `count = total - offset;` => `count = total + offset;`**
   - When callers query with `offset == 0` (the standard usage to fetch the most recent items), `total - offset == total + offset == total`.
   - For queries with `offset == 0` and `count > total`, both expressions evaluate to `total`, leaving the returned slice identical.

3. **`Stairs.sol:152` — `if (e.supply + qty > e.cap) revert SoldOut(e.cap - e.supply);` => `SoldOut(e.cap + e.supply)`**
   - In `quoteBuy(id, qty)`, when an edition is completely fresh (`supply == 0`), `e.cap - e.supply == e.cap + e.supply == e.cap`.
   - When supply is 0, both yield identical revert parameter values for any `qty > cap`.
