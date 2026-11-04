// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import "forge-std/Test.sol";
import {Stairs} from "../src/Stairs.sol";

contract StairsHandler is Test {
  Stairs public stairs;
  address[] public actors;
  uint256 public editionId;

  constructor(Stairs _stairs) {
    stairs = _stairs;
    actors.push(address(0xA1));
    actors.push(address(0xB2));
    actors.push(address(0xC3));

    for (uint256 i = 0; i < actors.length; i++) {
      vm.deal(actors[i], 1000 ether);
    }

    vm.prank(actors[0]);
    editionId = stairs.create("Invariant Edition", 500, 0.01 ether, 0.001 ether, 1000);
  }

  function buyStep(uint8 actorIndex, uint8 qty) external {
    address actor = actors[actorIndex % actors.length];
    uint8 q = uint8(bound(qty, 1, 10));

    Stairs.Edition memory e = stairs.editionOf(editionId);
    if (e.supply + q > e.cap) return;

    uint128 cost = stairs.quoteBuy(editionId, q);
    vm.prank(actor);
    stairs.buy{value: cost}(editionId, q, cost);
  }

  function sellStep(uint8 actorIndex, uint8 qty) external {
    address actor = actors[actorIndex % actors.length];
    uint32 held = stairs.heldBy(editionId, actor);
    if (held == 0) return;

    uint8 maxQ = held > 10 ? 10 : uint8(held);
    uint8 q = uint8(bound(qty, 1, maxQ));

    vm.prank(actor);
    stairs.sell(editionId, q, 0);
  }

  function withdrawCut(uint8 actorIndex) external {
    address actor = actors[actorIndex % actors.length];
    if (stairs.pending(actor) == 0) return;

    vm.prank(actor);
    stairs.withdraw();
  }
}

contract StairsInvariantTest is Test {
  Stairs public stairs;
  StairsHandler public handler;

  function setUp() public {
    stairs = new Stairs();
    handler = new StairsHandler(stairs);

    bytes4[] memory selectors = new bytes4[](3);
    selectors[0] = handler.buyStep.selector;
    selectors[1] = handler.sellStep.selector;
    selectors[2] = handler.withdrawCut.selector;

    targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    targetContract(address(handler));
  }

  function invariant_BalanceEqualsReservePlusPending() public view {
    uint256 count = stairs.editionCount();
    uint256 totalReserve = 0;
    for (uint256 i = 1; i <= count; i++) {
      Stairs.Edition memory e = stairs.editionOf(i);
      totalReserve += e.reserve;
    }

    uint256 totalPending = 0;
    totalPending += stairs.pending(handler.actors(0));
    totalPending += stairs.pending(handler.actors(1));
    totalPending += stairs.pending(handler.actors(2));

    assertEq(address(stairs).balance, totalReserve + totalPending);
  }
}
