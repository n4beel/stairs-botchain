# Stairs (`stairs-botchain`)

**Each copy costs more than the last. Sell back any time.**

Stairs is a bonding-curve edition publisher on BOT Chain. Creators publish limited editions of up to 1,000 copies with a custom base price, step increment, and creator cut (0–20%). Every copy costs `base + step * i`. Buyers pay into a reserve (minus creator cut), and anyone holding a copy can sell it back at any time for the reserve share of the highest step, lowering the price again. The reserve is mathematically guaranteed to remain solvent under all conditions.

---

## Technical Snapshot

- **Archetype**: AS · Staircase
- **Palette**: `#3DDCF0` ground, `#001E24` ink, `#7209B7` accent
- **Fonts**: Barlow Condensed (headings, numbers) · Barlow (body)
- **Ports**: Integration test `8659`, local stack `8759`
- **Contract**: `contracts/src/Stairs.sol`
  - Invariants:
    - `edition.reserve == sum_{i < edition.supply} reserveShare(i)`
    - `address(this).balance == sum(editions.reserve) + sum(pending[creator])`
    - `edition.supply == sum(held[user]) <= cap`
    - Sells never revert for lack of reserve.

---

## Contrast & Accessibility (WCAG 2.1)

- **Ink on ground (`#001E24` on `#3DDCF0`)**: 10.48:1 (AAA)
- **Ink on surface (`#001E24` on `#FFFFFF`)**: 17.34:1 (AAA)
- **Muted text on surface (`#145B65` on `#FFFFFF`)**: 7.74:1 (AAA)
- **Accent ink on accent (`#FFFFFF` on `#7209B7`)**: 8.61:1 (AAA)
- **Menu text on menu background (`#001E24` on `#FFFFFF`)**: 17.34:1 (AAA)
- **Menu muted on menu background (`#66787C` on `#FFFFFF`)**: 4.62:1 (AA)

All visual staircase graphics provide an accessible text/table view fallback toggle, and quantity steppers support full keyboard navigation (Up/Down arrows).

---

## Verification & Testing

- `forge test`: 19 unit & fuzz tests + 1 stateful invariant suite (256 runs, 128,000 calls, 0 reverts).
- `vitest run lib test/lint`: 10 suites passing (48 unit tests).
- `npm run test:integration`: Anvil integration test covering end-to-end lifecycle and exact contract quote parity.
- `python3 scripts/mutation-check.py stairs`: 22/25 mutants killed (3 benign/equivalent documented in `contracts/DECISIONS.md`).
- `python3 scripts/check-distinct.py stairs`: OK.
- `python3 scripts/check-tokens.py stairs`: OK.
- `python3 scripts/check-ui-contract.py stairs`: OK.
- `npm run build`: Production Next.js build succeeds with zero errors.
