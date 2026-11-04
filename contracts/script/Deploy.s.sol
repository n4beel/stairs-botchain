// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import "forge-std/Script.sol";
import {Stairs} from "../src/Stairs.sol";

contract DeployScript is Script {
  function run() external returns (Stairs stairs) {
    vm.startBroadcast();
    stairs = new Stairs();
    vm.stopBroadcast();
  }
}
