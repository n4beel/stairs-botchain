// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title Stairs
 * @notice Limited editions with deterministic staircase pricing and solvent exits.
 * Each copy costs more than the last (price(i) = base + step * i).
 * Buyers can sell back at any time for the reserve share of the most recent step.
 */
contract Stairs {
  // Custom Errors matching spec
  error BadCap();
  error BadCurve();
  error BadCut();
  error BadQty();
  error SoldOut(uint32 left);
  error PriceMoved(uint128 expected);
  error WrongPayment(uint128 expected);
  error NotEnough(uint32 held);
  error TransferFailed();
  error NothingToWithdraw();
  error EditionNotFound();
  error Reentrancy();

  // Constants
  uint256 public constant MAX_NAME_BYTES = 48;
  uint32 public constant MIN_CAP = 2;
  uint32 public constant MAX_CAP = 1000;
  uint8 public constant MAX_QTY = 10;
  uint16 public constant MAX_CREATOR_BPS = 2000; // 20%
  uint128 public constant MIN_BASE = 0.001 ether;
  uint128 public constant MAX_PRICE = 1_000_000 ether;
  uint256 public constant MAX_PAGE = 50;

  struct Edition {
    address creator;
    uint32 supply;
    uint32 cap;
    uint16 creatorBps;
    uint128 base;
    uint128 step;
    uint128 reserve;
    string name;
  }

  mapping(uint256 => Edition) private _editions;
  mapping(uint256 => mapping(address => uint32)) private _held;
  mapping(address => uint256) public pending;
  uint256 public editionCount;

  bool private _locked;

  modifier nonReentrant() {
    if (_locked) revert Reentrancy();
    _locked = true;
    _;
    _locked = false;
  }

  // Events
  event Created(
    uint256 indexed id,
    address indexed creator,
    string name,
    uint32 cap,
    uint128 base,
    uint128 step,
    uint16 creatorBps
  );
  event Bought(
    uint256 indexed id,
    address indexed buyer,
    uint8 qty,
    uint128 paid,
    uint32 supplyAfter
  );
  event Sold(
    uint256 indexed id,
    address indexed seller,
    uint8 qty,
    uint128 received,
    uint32 supplyAfter
  );
  event Withdrawn(address indexed to, uint256 amount);

  /**
   * @notice Create a new staircase edition
   */
  function create(
    string calldata name,
    uint32 cap,
    uint128 base,
    uint128 step,
    uint16 creatorBps
  ) external returns (uint256 id) {
    bytes memory nameBytes = bytes(name);
    if (nameBytes.length == 0 || nameBytes.length > MAX_NAME_BYTES) revert BadCurve();
    if (cap < MIN_CAP || cap > MAX_CAP) revert BadCap();
    if (base < MIN_BASE || step == 0) revert BadCurve();
    if (creatorBps > MAX_CREATOR_BPS) revert BadCut();

    // Check last step price: price(cap - 1) <= MAX_PRICE
    uint256 lastStep = uint256(cap) - 1;
    uint256 maxPriceCheck = uint256(base) + uint256(step) * lastStep;
    if (maxPriceCheck > MAX_PRICE) revert BadCurve();

    id = ++editionCount;
    _editions[id] = Edition({
      creator: msg.sender,
      supply: 0,
      cap: cap,
      creatorBps: creatorBps,
      base: base,
      step: step,
      reserve: 0,
      name: name
    });

    emit Created(id, msg.sender, name, cap, base, step, creatorBps);
  }

  /**
   * @notice Calculate price of copy index i
   */
  function priceAt(uint256 id, uint32 index) public view returns (uint128) {
    if (id == 0 || id > editionCount) revert EditionNotFound();
    Edition storage e = _editions[id];
    return uint128(uint256(e.base) + uint256(e.step) * uint256(index));
  }

  /**
   * @notice Calculate creator fee for a given price
   */
  function fee(uint128 price, uint16 creatorBps) public pure returns (uint128) {
    return uint128((uint256(price) * uint256(creatorBps)) / 10_000);
  }

  /**
   * @notice Calculate reserve share for a given price
   */
  function reserveShare(uint128 price, uint16 creatorBps) public pure returns (uint128) {
    return price - fee(price, creatorBps);
  }

  /**
   * @notice Quote the total cost to buy `qty` copies at current supply
   */
  function quoteBuy(uint256 id, uint8 qty) public view returns (uint128 total) {
    if (id == 0 || id > editionCount) revert EditionNotFound();
    if (qty == 0 || qty > MAX_QTY) revert BadQty();
    Edition storage e = _editions[id];
    if (e.supply + qty > e.cap) revert SoldOut(e.cap - e.supply);

    uint256 sum = 0;
    for (uint32 k = 0; k < qty; k++) {
      sum += uint256(e.base) + uint256(e.step) * (uint256(e.supply) + k);
    }
    return uint128(sum);
  }

  /**
   * @notice Quote the proceeds from selling `qty` copies at current supply
   */
  function quoteSell(uint256 id, uint8 qty) public view returns (uint128 proceeds) {
    if (id == 0 || id > editionCount) revert EditionNotFound();
    if (qty == 0 || qty > MAX_QTY) revert BadQty();
    Edition storage e = _editions[id];
    if (qty > e.supply) revert NotEnough(e.supply);

    uint256 sum = 0;
    for (uint32 k = 0; k < qty; k++) {
      uint32 idx = e.supply - k - 1;
      uint128 stepPrice = uint128(uint256(e.base) + uint256(e.step) * uint256(idx));
      sum += uint256(reserveShare(stepPrice, e.creatorBps));
    }
    return uint128(sum);
  }

  /**
   * @notice Buy `qty` copies of an edition with slippage protection
   */
  function buy(uint256 id, uint8 qty, uint128 maxTotal) external payable {
    if (id == 0 || id > editionCount) revert EditionNotFound();
    if (qty < 1 || qty > MAX_QTY) revert BadQty();
    Edition storage e = _editions[id];
    if (e.supply + qty > e.cap) revert SoldOut(e.cap - e.supply);

    uint256 total = 0;
    uint256 totalFee = 0;
    uint256 totalReserve = 0;

    for (uint32 k = 0; k < qty; k++) {
      uint32 idx = e.supply + k;
      uint128 p = uint128(uint256(e.base) + uint256(e.step) * uint256(idx));
      uint128 f = fee(p, e.creatorBps);
      uint128 r = p - f;

      total += p;
      totalFee += f;
      totalReserve += r;
    }

    uint128 requiredTotal = uint128(total);
    if (requiredTotal > maxTotal) revert PriceMoved(requiredTotal);
    if (msg.value != requiredTotal) revert WrongPayment(requiredTotal);

    pending[e.creator] += totalFee;
    e.reserve += uint128(totalReserve);
    e.supply += qty;
    _held[id][msg.sender] += qty;

    emit Bought(id, msg.sender, qty, requiredTotal, e.supply);
  }

  /**
   * @notice Sell `qty` copies back to the reserve with slippage protection
   */
  function sell(uint256 id, uint8 qty, uint128 minProceeds) external nonReentrant {
    if (id == 0 || id > editionCount) revert EditionNotFound();
    if (qty < 1 || qty > MAX_QTY) revert BadQty();
    uint32 userHeld = _held[id][msg.sender];
    if (userHeld < qty) revert NotEnough(userHeld);

    Edition storage e = _editions[id];
    uint256 sumProceeds = 0;

    for (uint32 k = 0; k < qty; k++) {
      uint32 idx = e.supply - k - 1;
      uint128 p = uint128(uint256(e.base) + uint256(e.step) * uint256(idx));
      uint128 r = reserveShare(p, e.creatorBps);
      sumProceeds += r;
    }

    uint128 totalProceeds = uint128(sumProceeds);
    if (totalProceeds < minProceeds) revert PriceMoved(totalProceeds);

    // State changes first (checks-effects)
    e.supply -= qty;
    _held[id][msg.sender] -= qty;
    e.reserve -= totalProceeds;

    // Push proceeds to seller
    (bool ok, ) = msg.sender.call{value: totalProceeds}("");
    if (!ok) revert TransferFailed();

    emit Sold(id, msg.sender, qty, totalProceeds, e.supply);
  }

  /**
   * @notice Pull payment of creator cuts
   */
  function withdraw() external nonReentrant {
    uint256 amount = pending[msg.sender];
    if (amount == 0) revert NothingToWithdraw();

    pending[msg.sender] = 0;
    (bool ok, ) = msg.sender.call{value: amount}("");
    if (!ok) revert TransferFailed();

    emit Withdrawn(msg.sender, amount);
  }

  // Views

  function editionOf(uint256 id) external view returns (Edition memory) {
    if (id == 0 || id > editionCount) revert EditionNotFound();
    return _editions[id];
  }

  function heldBy(uint256 id, address who) external view returns (uint32) {
    return _held[id][who];
  }

  function latest(uint256 offset, uint256 count)
    external
    view
    returns (uint256[] memory ids, Edition[] memory editions, uint256 total)
  {
    total = editionCount;
    if (offset >= total || count == 0) {
      return (new uint256[](0), new Edition[](0), total);
    }
    if (count > MAX_PAGE) {
      count = MAX_PAGE;
    }
    if (offset + count > total) {
      count = total - offset;
    }

    ids = new uint256[](count);
    editions = new Edition[](count);

    for (uint256 i = 0; i < count; i++) {
      uint256 id = total - (offset + i);
      ids[i] = id;
      editions[i] = _editions[id];
    }
  }
}
