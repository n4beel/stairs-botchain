// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import "forge-std/Test.sol";
import {Stairs} from "../src/Stairs.sol";

contract MaliciousRecipient {
  Stairs public stairs;
  uint256 public editionId;

  constructor(Stairs _stairs) {
    stairs = _stairs;
  }

  function setEdition(uint256 id) external {
    editionId = id;
  }

  receive() external payable {
    // Attempt reentrant sell
    if (address(stairs).balance > 0) {
      stairs.sell(editionId, 1, 0);
    }
  }
}

contract StairsTest is Test {
  Stairs public stairs;

  address public creator = address(0x1111);
  address public alice = address(0x2222);
  address public bob = address(0x3333);
  address public charlie = address(0x4444);

  uint128 public constant BASE = 0.1 ether;
  uint128 public constant STEP = 0.01 ether;
  uint32 public constant CAP = 100;
  uint16 public constant BPS = 1000; // 10%

  function setUp() public {
    stairs = new Stairs();
    vm.deal(creator, 100 ether);
    vm.deal(alice, 100 ether);
    vm.deal(bob, 100 ether);
    vm.deal(charlie, 100 ether);
  }

  function test_CreateAndBuyFirstCopy() public {
    vm.prank(creator);
    uint256 id = stairs.create("Genesis Pass", CAP, BASE, STEP, BPS);
    assertEq(id, 1);

    uint128 q = stairs.quoteBuy(id, 1);
    assertEq(q, BASE);

    vm.prank(alice);
    stairs.buy{value: BASE}(id, 1, BASE);

    Stairs.Edition memory e = stairs.editionOf(id);
    assertEq(e.supply, 1);
    assertEq(stairs.heldBy(id, alice), 1);

    uint128 expectedFee = stairs.fee(BASE, BPS);
    uint128 expectedReserve = BASE - expectedFee;
    assertEq(e.reserve, expectedReserve);
    assertEq(stairs.pending(creator), expectedFee);
  }

  function test_PriceRisesByStep() public {
    vm.prank(creator);
    uint256 id = stairs.create("Step Pass", CAP, BASE, STEP, BPS);

    assertEq(stairs.priceAt(id, 0), BASE);
    assertEq(stairs.priceAt(id, 1), BASE + STEP);
    assertEq(stairs.priceAt(id, 2), BASE + STEP * 2);

    vm.prank(alice);
    stairs.buy{value: BASE}(id, 1, BASE);

    uint128 nextPrice = stairs.quoteBuy(id, 1);
    assertEq(nextPrice, BASE + STEP);
  }

  function test_BuyManyChargesEachStep() public {
    vm.prank(creator);
    uint256 id = stairs.create("Multi Pass", CAP, BASE, STEP, BPS);

    // Buy 3 at once: price(0) + price(1) + price(2)
    uint128 expectedTotal = BASE + (BASE + STEP) + (BASE + STEP * 2);
    uint128 q = stairs.quoteBuy(id, 3);
    assertEq(q, expectedTotal);

    vm.prank(alice);
    stairs.buy{value: expectedTotal}(id, 3, expectedTotal);

    Stairs.Edition memory e = stairs.editionOf(id);
    assertEq(e.supply, 3);
    assertEq(stairs.heldBy(id, alice), 3);
  }

  function test_CreatorCutGoesToPending() public {
    vm.prank(creator);
    uint256 id = stairs.create("Fee Pass", CAP, BASE, STEP, BPS);

    vm.prank(alice);
    stairs.buy{value: BASE}(id, 1, BASE);

    uint256 cut = stairs.pending(creator);
    assertEq(cut, (BASE * BPS) / 10000);

    vm.prank(creator);
    stairs.withdraw();
    assertEq(stairs.pending(creator), 0);
  }

  function test_ReserveGrowsByShare() public {
    vm.prank(creator);
    uint256 id = stairs.create("Reserve Pass", CAP, BASE, STEP, BPS);

    uint128 q1 = stairs.quoteBuy(id, 1);
    vm.prank(alice);
    stairs.buy{value: q1}(id, 1, q1);

    uint128 q2 = stairs.quoteBuy(id, 1);
    vm.prank(bob);
    stairs.buy{value: q2}(id, 1, q2);

    Stairs.Edition memory e = stairs.editionOf(id);
    uint128 expectedReserve = stairs.reserveShare(q1, BPS) + stairs.reserveShare(q2, BPS);
    assertEq(e.reserve, expectedReserve);
  }

  function test_SellReturnsTopStepShare() public {
    vm.prank(creator);
    uint256 id = stairs.create("Sell Pass", CAP, BASE, STEP, BPS);

    // Alice buys 1
    uint128 q1 = stairs.quoteBuy(id, 1);
    vm.prank(alice);
    stairs.buy{value: q1}(id, 1, q1);

    // Bob buys 1
    uint128 q2 = stairs.quoteBuy(id, 1);
    vm.prank(bob);
    stairs.buy{value: q2}(id, 1, q2);

    // Top step is step 1 (Bob's price q2). Alice sells 1. She gets reserveShare(q2).
    uint128 expectedProceeds = stairs.reserveShare(q2, BPS);
    uint128 sellQuote = stairs.quoteSell(id, 1);
    assertEq(sellQuote, expectedProceeds);

    uint256 balBefore = alice.balance;
    vm.prank(alice);
    stairs.sell(id, 1, expectedProceeds);

    assertEq(alice.balance, balBefore + expectedProceeds);
    assertEq(stairs.heldBy(id, alice), 0);
    assertEq(stairs.editionOf(id).supply, 1);
  }

  function test_SellAfterOthersSoldOutPaysLess() public {
    vm.prank(creator);
    uint256 id = stairs.create("Exit Pass", 3, BASE, STEP, BPS);

    // 3 buyers fill the cap
    uint128 q1 = stairs.quoteBuy(id, 1);
    vm.prank(alice);
    stairs.buy{value: q1}(id, 1, type(uint128).max);

    uint128 q2 = stairs.quoteBuy(id, 1);
    vm.prank(bob);
    stairs.buy{value: q2}(id, 1, type(uint128).max);

    uint128 q3 = stairs.quoteBuy(id, 1);
    vm.prank(charlie);
    stairs.buy{value: q3}(id, 1, type(uint128).max);

    // Charlie sells first, gets top step (index 2)
    uint128 cProceeds = stairs.quoteSell(id, 1);
    vm.prank(charlie);
    stairs.sell(id, 1, cProceeds);

    // Bob sells next, gets lower step (index 1)
    uint128 bProceeds = stairs.quoteSell(id, 1);
    assertTrue(bProceeds < cProceeds);
    vm.prank(bob);
    stairs.sell(id, 1, bProceeds);
  }

  function test_RoundTripLosesOnlyTheCut() public {
    vm.prank(creator);
    uint256 id = stairs.create("RoundTrip", CAP, BASE, STEP, BPS);

    uint256 balBefore = alice.balance;
    uint128 cost = stairs.quoteBuy(id, 1);
    vm.prank(alice);
    stairs.buy{value: cost}(id, 1, cost);

    uint128 proceeds = stairs.quoteSell(id, 1);
    vm.prank(alice);
    stairs.sell(id, 1, proceeds);

    uint256 feePaid = cost - proceeds;
    assertEq(alice.balance, balBefore - feePaid);
    assertEq(stairs.fee(cost, BPS), feePaid);
  }

  function test_SoldOutRevertsWithLeft() public {
    vm.prank(creator);
    uint256 id = stairs.create("Tiny", 2, BASE, STEP, BPS);

    vm.prank(alice);
    stairs.buy{value: stairs.quoteBuy(id, 2)}(id, 2, type(uint128).max);

    vm.expectRevert(abi.encodeWithSelector(Stairs.SoldOut.selector, 0));
    vm.prank(bob);
    stairs.buy{value: 1 ether}(id, 1, type(uint128).max);
  }

  function test_MaxTotalGuard_ArgsTotal() public {
    vm.prank(creator);
    uint256 id = stairs.create("Guard", CAP, BASE, STEP, BPS);

    uint128 cost = stairs.quoteBuy(id, 1);
    vm.expectRevert(abi.encodeWithSelector(Stairs.PriceMoved.selector, cost));
    vm.prank(alice);
    stairs.buy{value: cost}(id, 1, cost - 1);
  }

  function test_MinProceedsGuard_ArgsProceeds() public {
    vm.prank(creator);
    uint256 id = stairs.create("MinGuard", CAP, BASE, STEP, BPS);

    uint128 cost = stairs.quoteBuy(id, 1);
    vm.prank(alice);
    stairs.buy{value: cost}(id, 1, cost);

    uint128 proceeds = stairs.quoteSell(id, 1);
    vm.expectRevert(abi.encodeWithSelector(Stairs.PriceMoved.selector, proceeds));
    vm.prank(alice);
    stairs.sell(id, 1, proceeds + 1);
  }

  function test_NotEnoughRevertsWithHeld() public {
    vm.prank(creator);
    uint256 id = stairs.create("NotEnough", CAP, BASE, STEP, BPS);

    vm.expectRevert(abi.encodeWithSelector(Stairs.NotEnough.selector, 0));
    vm.prank(alice);
    stairs.sell(id, 1, 0);
  }

  function test_ZeroCutKeepsFullReserve() public {
    vm.prank(creator);
    uint256 id = stairs.create("ZeroCut", CAP, BASE, STEP, 0);

    uint128 cost = stairs.quoteBuy(id, 2);
    vm.prank(alice);
    stairs.buy{value: cost}(id, 2, cost);

    Stairs.Edition memory e = stairs.editionOf(id);
    assertEq(e.reserve, cost);
    assertEq(stairs.pending(creator), 0);

    uint256 balBefore = alice.balance;
    uint128 proceeds = stairs.quoteSell(id, 2);
    assertEq(proceeds, cost);

    vm.prank(alice);
    stairs.sell(id, 2, proceeds);
    assertEq(alice.balance, balBefore + cost);
  }

  function test_RoundingIdenticalInAndOut() public {
    // Odd base and 1-wei step to stress test rounding
    uint128 oddBase = 1000000000000003; // ~0.001 ETH with 3 wei
    uint128 oneWeiStep = 1;
    uint16 oddBps = 333; // 3.33%

    vm.prank(creator);
    uint256 id = stairs.create("OddStairs", 50, oddBase, oneWeiStep, oddBps);

    // Buy 5 copies one by one
    uint128 totalReserveAccrued = 0;
    for (uint32 i = 0; i < 5; i++) {
      uint128 p = oddBase + oneWeiStep * i;
      uint128 f = (p * oddBps) / 10000;
      uint128 r = p - f;
      totalReserveAccrued += r;

      vm.prank(alice);
      stairs.buy{value: p}(id, 1, p);
    }

    assertEq(stairs.editionOf(id).reserve, totalReserveAccrued);

    // Sell 5 copies in reverse: should yield exact same total reserve
    uint128 totalProceeds = 0;
    for (uint32 i = 0; i < 5; i++) {
      uint128 proceeds = stairs.quoteSell(id, 1);
      totalProceeds += proceeds;
      vm.prank(alice);
      stairs.sell(id, 1, proceeds);
    }

    assertEq(totalProceeds, totalReserveAccrued);
    assertEq(stairs.editionOf(id).reserve, 0);
  }

  function test_ReentrantSellBlocked() public {
    MaliciousRecipient attacker = new MaliciousRecipient(stairs);
    vm.deal(address(attacker), 10 ether);

    vm.prank(creator);
    uint256 id = stairs.create("Malicious", CAP, BASE, STEP, BPS);
    attacker.setEdition(id);

    // Attacker buys 2 copies
    uint128 cost = stairs.quoteBuy(id, 2);
    vm.prank(address(attacker));
    stairs.buy{value: cost}(id, 2, cost);

    // Attacker attempts to sell 1; receive() will try to sell second copy during payout
    vm.expectRevert(Stairs.TransferFailed.selector);
    vm.prank(address(attacker));
    stairs.sell(id, 1, 0);
  }

  function test_BoundaryMutantKillers() public {
    // 1. Cap boundary (MIN_CAP=2, MAX_CAP=1000)
    vm.prank(creator);
    uint256 idMinCap = stairs.create("MinCap", stairs.MIN_CAP(), BASE, STEP, BPS);
    assertEq(idMinCap, 1);

    vm.prank(creator);
    uint256 idMaxCap = stairs.create("MaxCap", stairs.MAX_CAP(), BASE, STEP, BPS);
    assertEq(idMaxCap, 2);

    // 2. Base boundary (MIN_BASE=0.001 ETH)
    vm.prank(creator);
    uint256 idMinBase = stairs.create("MinBase", 10, stairs.MIN_BASE(), STEP, BPS);
    assertEq(idMinBase, 3);

    // 3. Creator cut boundary (MAX_CREATOR_BPS=2000)
    vm.prank(creator);
    uint256 idMaxCut = stairs.create("MaxCut", 10, BASE, STEP, stairs.MAX_CREATOR_BPS());
    assertEq(idMaxCut, 4);

    // 4. Qty boundary (MAX_QTY=10)
    uint128 cost10 = stairs.quoteBuy(idMaxCap, stairs.MAX_QTY());
    vm.prank(alice);
    stairs.buy{value: cost10}(idMaxCap, 10, cost10);
    assertEq(stairs.heldBy(idMaxCap, alice), 10);

    // 5. Pagination boundary (MAX_PAGE=50)
    (uint256[] memory ids,, uint256 total) = stairs.latest(0, 50);
    assertEq(ids.length, 4);
    assertEq(total, 4);
  }

  function testFuzz_ReserveAlwaysEqualsFormula(uint8 buyQtyRaw, uint8 sellQtyRaw) public {
    uint8 bQty = uint8(bound(buyQtyRaw, 2, 10));
    uint8 sQty = uint8(bound(sellQtyRaw, 1, bQty));

    vm.prank(creator);
    uint256 id = stairs.create("FuzzFormula", 100, 0.05 ether, 0.005 ether, 1500);

    uint128 bCost = stairs.quoteBuy(id, bQty);
    vm.prank(alice);
    stairs.buy{value: bCost}(id, bQty, bCost);

    vm.prank(alice);
    stairs.sell(id, sQty, 0);

    // Check reserve equals sum of remaining supply
    Stairs.Edition memory e = stairs.editionOf(id);
    uint128 expectedReserve = 0;
    for (uint32 i = 0; i < e.supply; i++) {
      uint128 p = e.base + e.step * i;
      expectedReserve += stairs.reserveShare(p, e.creatorBps);
    }
    assertEq(e.reserve, expectedReserve);
  }

  function testFuzz_AlwaysSolvent(uint8 nActions) public {
    uint8 actions = uint8(bound(nActions, 5, 20));

    vm.prank(creator);
    uint256 id = stairs.create("SolventStairs", 200, 0.01 ether, 0.001 ether, 500);

    for (uint8 i = 0; i < actions; i++) {
      Stairs.Edition memory e = stairs.editionOf(id);
      if (e.supply < 190 && (i % 2 == 0 || e.supply == 0)) {
        uint8 qty = uint8((i % 4) + 1);
        uint128 cost = stairs.quoteBuy(id, qty);
        vm.prank(alice);
        stairs.buy{value: cost}(id, qty, cost);
      } else if (stairs.heldBy(id, alice) > 0) {
        uint8 held = uint8(stairs.heldBy(id, alice));
        uint8 qty = held > 3 ? 3 : held;
        vm.prank(alice);
        stairs.sell(id, qty, 0);
      }
    }

    // Sell quote for all remaining held copies must not revert and be <= reserve
    uint32 totalHeld = stairs.heldBy(id, alice);
    if (totalHeld > 0) {
      uint8 toSell = totalHeld > 10 ? 10 : uint8(totalHeld);
      uint128 proceeds = stairs.quoteSell(id, toSell);
      assertTrue(proceeds <= stairs.editionOf(id).reserve);
    }
  }

  function test_MutationKillersSpecific() public {
    // 1. Kill mutant at line 97: nameBytes.length == 48 (MAX_NAME_BYTES boundary)
    string memory exact48 = "123456789012345678901234567890123456789012345678"; // 48 chars
    assertEq(bytes(exact48).length, 48);
    vm.prank(creator);
    uint256 id48 = stairs.create(exact48, 10, BASE, STEP, BPS);
    assertEq(stairs.editionOf(id48).name, exact48);

    // 2. Kill mutant at line 280: offset == total (offset >= total vs offset > total)
    // When offset == total, latest(total, count) should return empty array
    (uint256[] memory idsEmpty, Stairs.Edition[] memory editionsEmpty, uint256 totalEmpty) = stairs.latest(stairs.editionCount(), 10);
    assertEq(idsEmpty.length, 0);
    assertEq(editionsEmpty.length, 0);
    assertEq(totalEmpty, stairs.editionCount());

    // 3. Kill mutant at line 287: offset + count > total clamp (count = total - offset vs count = total + offset)
    // If offset = 0, total = 1, and count = 5, offset + count > total (5 > 1).
    // Clamped count must be 1 - 0 = 1.
    (uint256[] memory idsClamped, Stairs.Edition[] memory editionsClamped,) = stairs.latest(0, 5);
    assertEq(idsClamped.length, 1);
    assertEq(editionsClamped.length, 1);

    // 4. Kill mutant at line 103: uint256 lastStep = uint256(cap) - 1 vs + 1
    // Let cap = 2, base = 1 ether, step = 999_999 ether.
    // cap - 1 = 1, so price(1) = 1 + 999_999 = 1_000_000 ether <= MAX_PRICE (valid).
    // If mutant cap + 1 = 3: price(3) = 1 + 3 * 999_999 = 2_999_998 ether > MAX_PRICE, which would revert BadCurve!
    vm.prank(creator);
    uint256 idBoundary = stairs.create("BoundaryCurve", 2, 1 ether, 999_999 ether, 0);
    assertTrue(idBoundary > 0);

    // 5. Kill mutant at line 152: SoldOut(e.cap - e.supply vs e.cap + e.supply)
    // Buy until supply = 1, cap = 2. Then try to buy 2. e.cap - e.supply is 2 - 1 = 1.
    vm.deal(alice, 10_000_000 ether);
    vm.prank(alice);
    stairs.buy{value: 1 ether}(idBoundary, 1, 1 ether);
    vm.prank(alice);
    vm.expectRevert(abi.encodeWithSelector(Stairs.SoldOut.selector, 1));
    stairs.buy{value: 1000000 ether}(idBoundary, 2, 1000000 ether);
  }
}
