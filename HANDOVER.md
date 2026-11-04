# Handover: 59 — Stairs (`stairs-botchain`)

## 1. Overview & Verification

- **Status**: Completed and fully verified.
- **Verification Gates**:
  - `forge test`: 19 unit/fuzz tests + 1 stateful invariant test (256 runs, 128,000 calls, 0 reverts) pass.
  - `npm test`: 10 vitest suites (48 tests) pass.
  - `npm run test:integration`: 2 test suites (5 tests) pass against local Anvil (port 8659).
  - `npm run typecheck`: clean pass.
  - `npm run build`: optimized production Next.js build succeeds with static and dynamic routes.
  - `python3 scripts/mutation-check.py stairs`: 22/25 mutants killed (3 benign/equivalent documented in `contracts/DECISIONS.md`).
  - `python3 scripts/check-distinct.py stairs`: clean pass (0 pair/file problems).
  - `python3 scripts/check-tokens.py stairs`: clean pass (0 undefined tokens).
  - `python3 scripts/check-ui-contract.py stairs`: clean pass (active chain asserts, step="any", footers, wallet menus all valid).

## 2. Palette & WCAG Compliance

- **Ground**: `#3DDCF0`
- **Ink**: `#001E24`
- **Accent**: `#7209B7` (Accent-ink `#FFFFFF`)
- **Contrast Ratios**:
  - Ink on ground: 10.48:1 (AAA)
  - Ink on surface: 17.34:1 (AAA)
  - Muted on surface: 7.74:1 (AAA)
  - Accent-ink on accent: 8.61:1 (AAA)
  - Menu text on menu-bg: 17.34:1 (AAA)
  - Menu muted on menu-bg: 4.62:1 (AA)

## 3. Key Components & Routes

- `/`: Editions gallery, newest first, showing mini staircase curves and next step pricing.
- `/new`: Create edition form with live staircase preview and last copy price calculator.
- `/edition/[id]`: Interactive staircase curve (with accessible table fallback), buy panel with quote, sell back panel with proceeds, and education on exit mechanics.
- `/me`: Portfolio of holdings across editions, accrued creator cut tally, and one-click withdrawal.
- `components/staircase/StaircaseChart.tsx`: SVG staircase with sold/next/future steps, user copy markers, and accessible table toggle.
- `components/staircase/Stepper.tsx`: Keyboard-operable quantity stepper.
