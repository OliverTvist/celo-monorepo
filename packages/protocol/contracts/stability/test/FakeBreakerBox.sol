// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.5.13;

import { IBreakerBox } from "contracts/stability/interfaces/IBreakerBox.sol";

contract FakeBreakerBox is IBreakerBox {
  uint256 public tradingMode;

  function setTradingMode(uint256 _tradingMode) external {
    tradingMode = _tradingMode;
  }

  function checkBreakers(address exchange) external returns (uint256 currentTradingMode) {
    return tradingMode;
  }

  function getBreakers() external view returns (address[] memory) {
    return new address[](0);
  }

  function isBreaker(address breaker) external view returns (bool) {
    return true;
  }

  function getTradingMode(address exchange) external returns (uint256) {
    return 0;
  }

  function checkBreakers(bytes32 exchangeRegistryId) external {}
}
