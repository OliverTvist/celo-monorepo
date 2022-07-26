// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.5.13;

import { Test } from "celo-foundry/Test.sol";

import { MockReserve } from "contracts/stability/test/MockReserve.sol";
import { FakeBreaker } from "contracts/stability/test/FakeBreaker.sol";

import { WithRegistry } from "../utils/WithRegistry.sol";

import { IBreakerBox } from "contracts/stability/interfaces/IBreakerBox.sol";
import { BreakerBox } from "contracts/stability/BreakerBox.sol";

contract BreakerBoxTest is Test, WithRegistry {
  address deployer;
  address exchangeA;
  address exchangeB;
  address exchangeC;
  address rando;

  FakeBreaker fakeBreakerA;
  FakeBreaker fakeBreakerB;
  FakeBreaker fakeBreakerC;
  FakeBreaker fakeBreakerD;
  MockReserve mockReserve;
  BreakerBox breakerBox;

  event BreakerAdded(address indexed breaker);
  event BreakerRemoved(address indexed breaker);
  event BreakerTripped(address indexed breaker, address indexed exchange);
  event ExchangeAdded(address indexed exchange);
  event ExchangeRemoved(address indexed exchange);
  event TradingModeUpdated(address indexed exchange, uint256 tradingMode);
  event ResetSuccessful(address indexed exchange, address indexed breaker);
  event ResetAttemptCriteriaFail(address indexed exchange, address indexed breaker);
  event ResetAttemptNotCool(address indexed exchange, address indexed breaker);

  function setUp() public {
    deployer = actor("deployer");
    exchangeA = actor("exchangeA");
    exchangeB = actor("exchangeB");
    exchangeC = actor("exchangeC");
    rando = actor("rando");

    address[] memory testExchanges = new address[](2);
    testExchanges[0] = exchangeA;
    testExchanges[1] = exchangeB;

    changePrank(deployer);
    fakeBreakerA = new FakeBreaker(0, false, false);
    fakeBreakerB = new FakeBreaker(0, false, false);
    fakeBreakerC = new FakeBreaker(0, false, false);
    fakeBreakerD = new FakeBreaker(0, false, false);
    mockReserve = new MockReserve();

    mockReserve.setReserveSpender(true);

    registry.setAddressFor("Reserve", address(mockReserve));
    registry.setAddressFor("Exchange", address(exchangeA));

    breakerBox = new BreakerBox(true);
    breakerBox.initilize(testExchanges, address(registry));
    breakerBox.addBreaker(address(fakeBreakerA), 1);
  }

  function isExchange(address exchange) public view returns (bool exchangeFound) {
    address[] memory allExchanges = breakerBox.getExchanges();
    for (uint256 i = 0; i < allExchanges.length; i++) {
      if (allExchanges[i] == exchange) {
        exchangeFound = true;
        break;
      }
    }
  }

  /**
   * @notice  Adds specified breaker to the breakerBox, mocks calls with specified values
   * @param breaker Fake breaker to add
   * @param tradingMode The trading mode for the breaker
   * @param cooldown The cooldown time of the breaker
   * @param reset Bool indicating the result of calling breaker.shouldReset()
   * @param trigger Bool indicating the result of calling breaker.shouldTrigger()
   * @param exchange If exchange is set, switch exchange to the given trading mode
   */
  function setupBreakerAndExchange(
    FakeBreaker breaker,
    uint64 tradingMode,
    uint256 cooldown,
    bool reset,
    bool trigger,
    address exchange
  ) public {
    vm.mockCall(
      address(breaker),
      abi.encodeWithSelector(breaker.getCooldown.selector),
      abi.encode(cooldown)
    );

    vm.mockCall(
      address(breaker),
      abi.encodeWithSelector(breaker.shouldReset.selector),
      abi.encode(reset)
    );

    vm.mockCall(
      address(breaker),
      abi.encodeWithSelector(breaker.shouldTrigger.selector),
      abi.encode(trigger)
    );

    breakerBox.addBreaker(address(breaker), tradingMode);
    assertTrue(breakerBox.isBreaker(address(breaker)));

    if (exchange != address(0)) {
      breakerBox.addExchange(exchange);
      assertTrue(isExchange(exchange));

      breakerBox.setExchangeTradingMode(exchange, tradingMode);
      (uint256 savedTradingMode, , ) = breakerBox.exchangeTradingModes(exchange);
      assertEq(savedTradingMode, tradingMode);
    }
  }
}

contract BreakerBoxTest_constructorAndSetters is BreakerBoxTest {
  /* ---------- Initilizer ---------- */

  function test_initilize_shouldSetOwner() public view {
    assert(breakerBox.owner() == deployer);
  }

  function test_initilize_shouldSetInitialBreaker() public view {
    assert(breakerBox.tradingModeBreaker(1) == address(fakeBreakerA));
    assert(breakerBox.breakerTradingMode(address(fakeBreakerA)) == 1);
    assert(breakerBox.isBreaker(address(fakeBreakerA)));
  }

  function test_initilize_shouldAddExchangesWithDefaultMode() public view {
    (uint256 tradingModeA, uint256 lastUpdatedA, uint256 lastUpdatedBlockA) = breakerBox
      .exchangeTradingModes(exchangeA);
    assert(tradingModeA == 0);
    assert(lastUpdatedA > 0);
    assert(lastUpdatedBlockA > 0);

    (uint256 tradingModeB, uint256 lastUpdatedB, uint256 lastUpdatedBlockB) = breakerBox
      .exchangeTradingModes(exchangeB);
    assert(tradingModeB == 0);
    assert(lastUpdatedB > 0);
    assert(lastUpdatedBlockB > 0);
  }

  /* ---------- Breakers ---------- */

  function test_addBreaker_canOnlyBeCalledByOwner() public {
    vm.expectRevert("Ownable: caller is not the owner");
    changePrank(rando);
    breakerBox.addBreaker(address(fakeBreakerA), 2);
  }

  function test_addBreaker_whenAddingDuplicateBreaker_shouldRevert() public {
    vm.expectRevert("This breaker has already been added");
    breakerBox.addBreaker(address(fakeBreakerA), 2);
  }

  function test_addBreaker_whenAddingBreakerWithDuplicateTradingMode_shouldRevert() public {
    vm.expectRevert("There is already a breaker added with the same trading mode");
    breakerBox.addBreaker(address(fakeBreakerB), 1);
  }

  function test_addBreaker_whenAddingBreakerWithDefaultTradingMode_shouldRevert() public {
    vm.expectRevert("The default trading mode can not have a breaker");
    breakerBox.addBreaker(address(fakeBreakerB), 0);
  }

  function test_addBreaker_shouldUpdateAndEmit() public {
    vm.expectEmit(true, false, false, false);
    emit BreakerAdded(address(fakeBreakerB));

    breakerBox.addBreaker(address(fakeBreakerB), 2);

    assert(breakerBox.tradingModeBreaker(2) == address(fakeBreakerB));
    assert(breakerBox.breakerTradingMode(address(fakeBreakerB)) == 2);
    assert(breakerBox.isBreaker(address(fakeBreakerB)));
  }

  function test_removeBreaker_whenBreakerHasntBeenAdded_shouldRevert() public {
    vm.expectRevert("This breaker has not been added");
    breakerBox.removeBreaker(address(fakeBreakerB));
  }

  function test_removeBreaker_whenBreakerTradingModeInUse_shouldSetDefaultMode() public {
    breakerBox.addBreaker(address(fakeBreakerC), 3);
    breakerBox.addExchange(exchangeC);
    breakerBox.setExchangeTradingMode(exchangeC, 3);

    (uint256 tradingModeBefore, , ) = breakerBox.exchangeTradingModes(exchangeC);
    assertEq(tradingModeBefore, 3);

    breakerBox.removeBreaker(address(fakeBreakerC));

    (uint256 tradingModeAfter, , ) = breakerBox.exchangeTradingModes(exchangeC);
    assertEq(tradingModeAfter, 0);
  }

  function test_removeBreaker_shouldUpdateStorageAndEmit() public {
    vm.expectEmit(true, false, false, false);
    emit BreakerRemoved(address(fakeBreakerA));

    assert(breakerBox.tradingModeBreaker(1) == address(fakeBreakerA));
    assert(breakerBox.breakerTradingMode(address(fakeBreakerA)) == 1);
    assert(breakerBox.isBreaker(address(fakeBreakerA)));

    breakerBox.removeBreaker(address(fakeBreakerA));

    assert(breakerBox.tradingModeBreaker(1) == address(0));
    assert(breakerBox.breakerTradingMode(address(fakeBreakerA)) == 0);
    assert(!breakerBox.isBreaker(address(fakeBreakerA)));
  }

  function test_insertBreaker_whenBreakerHasAlreadyBeenAdded_shouldRevert() public {
    vm.expectRevert("This breaker has already been added");
    breakerBox.insertBreaker(address(fakeBreakerA), 1, address(0), address(0));
  }

  function test_insertBreaker_whenAddingBreakerWithDuplicateTradingMode_shouldRevert() public {
    vm.expectRevert("There is already a breaker added with the same trading mode");
    breakerBox.insertBreaker(address(fakeBreakerB), 1, address(0), address(0));
  }

  function test_insertBreaker_shouldInsertBreakerAtCorrectPositionAndEmit() public {
    assert(breakerBox.getBreakers().length == 1);

    breakerBox.addBreaker(address(fakeBreakerB), 2);
    breakerBox.addBreaker(address(fakeBreakerC), 3);

    address[] memory breakersBefore = breakerBox.getBreakers();
    assert(breakersBefore.length == 3);
    assert(breakersBefore[0] == address(fakeBreakerA));
    assert(breakersBefore[1] == address(fakeBreakerB));
    assert(breakersBefore[2] == address(fakeBreakerC));

    vm.expectEmit(true, false, false, false);
    emit BreakerAdded(address(fakeBreakerD));

    breakerBox.insertBreaker(
      address(fakeBreakerD),
      4,
      address(fakeBreakerB),
      address(fakeBreakerA)
    );

    address[] memory breakersAfter = breakerBox.getBreakers();
    assert(breakersAfter.length == 4);
    assert(breakersAfter[0] == address(fakeBreakerA));
    assert(breakersAfter[1] == address(fakeBreakerD));
    assert(breakersAfter[2] == address(fakeBreakerB));
    assert(breakersAfter[3] == address(fakeBreakerC));

    assert(breakerBox.tradingModeBreaker(4) == address(fakeBreakerD));
    assert(breakerBox.tradingModeBreaker(3) == address(fakeBreakerC));
    assert(breakerBox.tradingModeBreaker(2) == address(fakeBreakerB));
    assert(breakerBox.tradingModeBreaker(1) == address(fakeBreakerA));

    assert(breakerBox.breakerTradingMode(address(fakeBreakerD)) == 4);
  }

  /* ---------- Exchanges ---------- */

  function test_addExchange_whenExchangeHasAlreadyBeenAdded_shouldRevert() public {
    vm.expectRevert("Exchange has already been added");
    breakerBox.addExchange(exchangeA);
  }

  function test_addExchange_whenExchangeIsNotReserveSpender_shouldRevert() public {
    mockReserve.setReserveSpender(false);

    vm.expectRevert("Exchange is not a reserve spender");
    breakerBox.addExchange(exchangeC);
  }

  function test_addExchange_whenExchangeIsReserveSpender_shouldSetDefaultModeAndEmit() public {
    mockReserve.setReserveSpender(true);
    vm.expectEmit(true, false, false, false);
    emit ExchangeAdded(exchangeC);

    (uint256 tradingModeBefore, uint256 lastUpdatedTimeBefore, uint256 lastUpdatedBlockBefore) = breakerBox
      .exchangeTradingModes(exchangeC);

    assert(tradingModeBefore == 0);
    assert(lastUpdatedTimeBefore == 0);
    assert(lastUpdatedBlockBefore == 0);

    skip(5);
    vm.roll(block.number + 1);
    breakerBox.addExchange(exchangeC);

    (uint256 tradingModeAfter, uint256 lastUpdatedTimeAfter, uint256 lastUpdatedBlockAfter) = breakerBox
      .exchangeTradingModes(exchangeC);

    assert(tradingModeAfter == 0);
    assert(lastUpdatedTimeAfter > lastUpdatedTimeBefore);
    assert(lastUpdatedBlockAfter > lastUpdatedBlockBefore);
  }

  function test_removeExchange_whenExchangeHasNotBeenAdded_shouldRevert() public {
    vm.expectRevert("Exchange has not been added");
    breakerBox.removeExchange(exchangeC);
  }

  function test_removeExchange_shouldRemoveExchangeFromArray() public {
    assertTrue(isExchange(exchangeA));
    breakerBox.removeExchange(exchangeA);
    assertFalse(isExchange(exchangeA));
  }

  function test_removeExchange_shouldResetTradingModeInfoAndEmit() public {
    breakerBox.setExchangeTradingMode(exchangeA, 1);
    vm.expectEmit(true, false, false, false);
    emit ExchangeRemoved(exchangeA);

    (uint256 tradingModeBefore, uint256 lastUpdatedTimeBefore, uint256 lastUpdatedBlockBefore) = breakerBox
      .exchangeTradingModes(exchangeA);
    assert(tradingModeBefore == 1);
    assert(lastUpdatedTimeBefore > 0);
    assert(lastUpdatedBlockBefore > 0);

    breakerBox.removeExchange(exchangeA);

    (uint256 tradingModeAfter, uint256 lastUpdatedTimeAfter, uint256 lastUpdatedBlockAfter) = breakerBox
      .exchangeTradingModes(exchangeA);
    assert(tradingModeAfter == 0);
    assert(lastUpdatedTimeAfter == 0);
    assert(lastUpdatedBlockAfter == 0);
  }

  function test_setExchangeTradingMode_whenExchangeHasNotBeenAdded_ShouldRevert() public {
    vm.expectRevert("Exchange has not been added");
    breakerBox.setExchangeTradingMode(exchangeC, 1);
  }

  function test_setExchangeTradingMode_whenSpecifiedTradingModeHasNoBreaker_ShouldRevert() public {
    vm.expectRevert("Trading mode must be default or have a breaker set");
    breakerBox.setExchangeTradingMode(exchangeA, 9);
  }

  function test_setExchangeTradingMode_whenUsingDefaultTradingMode_ShouldUpdateAndEmit() public {
    (uint256 tradingModeBefore, uint256 lastUpdatedTimeBefore, uint256 lastUpdatedBlockBefore) = breakerBox
      .exchangeTradingModes(exchangeA);
    assert(tradingModeBefore == 0);
    assert(lastUpdatedTimeBefore > 0);
    assert(lastUpdatedBlockBefore > 0);

    //Fake time skip
    skip(5 * 60);
    vm.roll(5);
    vm.expectEmit(true, false, false, true);
    emit TradingModeUpdated(exchangeA, 1);

    breakerBox.setExchangeTradingMode(exchangeA, 1);
    (uint256 tradingModeAfter, uint256 lastUpdatedTimeAfter, uint256 lastUpdatedBlockAfter) = breakerBox
      .exchangeTradingModes(exchangeA);
    assert(tradingModeAfter == 1);
    assert(lastUpdatedTimeAfter > lastUpdatedTimeBefore);
    assert(lastUpdatedBlockAfter > lastUpdatedBlockBefore);
  }
}

contract BreakerBoxTest_checkBreakers is BreakerBoxTest {
  function test_checkBreakers_whenExchangeIsNotAdded_shouldRevert() public {
    vm.expectRevert("This exchange has not been added");
    breakerBox.checkBreakers(exchangeC);
  }

  function test_checkBreakers_whenExchangeIsNotInDefaultModeAndCooldownNotPassed_shouldEmitNotCool()
    public
  {
    setupBreakerAndExchange(fakeBreakerC, 6, 3600, false, false, exchangeC);

    skip(3599);

    vm.expectCall(address(fakeBreakerC), abi.encodeWithSelector(fakeBreakerC.getCooldown.selector));
    vm.expectEmit(true, true, false, false);
    emit ResetAttemptNotCool(exchangeC, address(fakeBreakerC));

    assertEq(breakerBox.checkBreakers(exchangeC), 6);
  }

  function test_checkBreakers_whenExchangeIsNotInDefaultModeAndCantReset_shouldEmitCriteriaFail()
    public
  {
    setupBreakerAndExchange(fakeBreakerC, 6, 3600, false, false, exchangeC);

    skip(3600);
    vm.expectCall(address(fakeBreakerC), abi.encodeWithSelector(fakeBreakerC.getCooldown.selector));
    vm.expectCall(
      address(fakeBreakerC),
      abi.encodeWithSelector(fakeBreakerC.shouldReset.selector, exchangeC)
    );
    vm.expectEmit(true, true, false, false);
    emit ResetAttemptCriteriaFail(exchangeC, address(fakeBreakerC));

    assertEq(breakerBox.checkBreakers(exchangeC), 6);
  }

  function test_checkBreakers_whenExchangeIsNotInDefaultModeAndCanReset_shouldResetMode() public {
    setupBreakerAndExchange(fakeBreakerC, 6, 3600, true, false, exchangeC);
    skip(3600);

    vm.expectCall(address(fakeBreakerC), abi.encodeWithSelector(fakeBreakerC.getCooldown.selector));
    vm.expectCall(
      address(fakeBreakerC),
      abi.encodeWithSelector(fakeBreakerC.shouldReset.selector, exchangeC)
    );
    vm.expectEmit(true, true, false, false);
    emit ResetSuccessful(exchangeC, address(fakeBreakerC));

    assertEq(breakerBox.checkBreakers(exchangeC), 0);
  }

  function test_checkBreakers_whenExchangeIsNotInDefaultModeAndNoBreakerCooldown_shouldReturnCorrectModeAndEmit()
    public
  {
    setupBreakerAndExchange(fakeBreakerC, 6, 0, true, false, exchangeC);
    skip(3600);

    vm.expectCall(address(fakeBreakerC), abi.encodeWithSelector(fakeBreakerC.getCooldown.selector));
    vm.expectEmit(true, true, false, false);
    emit ResetAttemptNotCool(exchangeC, address(fakeBreakerC));

    assertEq(breakerBox.checkBreakers(exchangeC), 6);
  }

  function test_checkBreakers_whenNoBreakersAreTripped_shouldReturnDefaultMode() public {
    setupBreakerAndExchange(fakeBreakerC, 6, 3600, true, false, address(0));
    breakerBox.addExchange(exchangeC);
    assertTrue(isExchange(exchangeC));

    (uint256 tradingMode, , ) = breakerBox.exchangeTradingModes(exchangeC);
    assertEq(tradingMode, 0);

    vm.expectCall(
      address(fakeBreakerC),
      abi.encodeWithSelector(fakeBreakerC.shouldTrigger.selector, address(exchangeC))
    );
    vm.expectCall(
      address(fakeBreakerA),
      abi.encodeWithSelector(fakeBreakerA.shouldTrigger.selector, address(exchangeC))
    );

    assertEq(breakerBox.checkBreakers(exchangeC), 0);
  }

  function test_checkBreakers_whenABreakerIsTripped_shouldSetModeAndEmit() public {
    setupBreakerAndExchange(fakeBreakerC, 6, 3600, true, true, address(0));

    breakerBox.addExchange(exchangeC);
    assertTrue(isExchange(exchangeC));

    (uint256 tradingMode, , ) = breakerBox.exchangeTradingModes(exchangeC);
    assertEq(tradingMode, 0);

    vm.expectCall(
      address(fakeBreakerA),
      abi.encodeWithSelector(fakeBreakerA.shouldTrigger.selector, address(exchangeC))
    );

    vm.expectCall(
      address(fakeBreakerC),
      abi.encodeWithSelector(fakeBreakerC.shouldTrigger.selector, address(exchangeC))
    );

    vm.expectEmit(true, true, false, false);
    emit BreakerTripped(address(fakeBreakerC), exchangeC);

    skip(3600);
    vm.roll(5);

    assertEq(breakerBox.checkBreakers(exchangeC), 6);

    (, uint256 lastUpdatedTime, uint256 lastUpdatedBlock) = breakerBox.exchangeTradingModes(
      exchangeC
    );
    assertEq(lastUpdatedTime, 3601);
    assertEq(lastUpdatedBlock, 5);
  }
}
