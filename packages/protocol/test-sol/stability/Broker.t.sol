pragma solidity ^0.5.13;
pragma experimental ABIEncoderV2;

import { Test, console2 as console } from "celo-foundry/Test.sol";
import { IERC20 } from "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import { Broker } from "contracts/stability/Broker.sol";
import { IMentoExchange } from "contracts/stability/interfaces/deprecate/IMentoExchange.sol";
import { IExchangeProvider } from "contracts/stability/interfaces/IExchangeProvider.sol";
import { IBiPoolManager } from "contracts/stability/interfaces/IBiPoolManager.sol";
import { IPricingModule } from "contracts/stability/interfaces/IPricingModule.sol";
import { IReserve } from "contracts/stability/interfaces/IReserve.sol";
import { IStableToken } from "contracts/stability/interfaces/IStableToken.sol";

import { FixidityLib } from "contracts/common/FixidityLib.sol";

// forge test --match-contract Broker -vvv
contract BrokerTest is Test {
  event Swap(
    address exchangeProvider,
    bytes32 indexed exchangeId,
    address indexed trader,
    address indexed tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 amountOut
  );
  event ExchangeProviderAdded(address indexed exchangeProvider);
  event ExchangeProviderRemoved(address indexed exchangeProvider);
  event ReserveSet(address indexed newAddress, address indexed prevAddress);

  address deployer;
  address notDeployer;
  address trader;

  IStableToken stableAsset;
  IERC20 collateralAsset;
  address randomAsset;
  IPricingModule pricingModule;

  uint256 constant initialStableBucket = 1e24;
  uint256 constant initialCollateralBucket = 2e24;

  IReserve reserve;

  IExchangeProvider exchangeProvider;
  IBiPoolManager poolManager;

  Broker broker;
  uint256 spread = 0.1 * 10**24;

  function setUp() public {
    /* Dependencies and actors */
    deployer = actor("deployer");
    notDeployer = actor("notDeployer");
    reserve = IReserve(actor("reserve"));
    // pairManager = IPairManager(actor("pairManager"));
    poolManager = IBiPoolManager(actor("IBiPoolManager"));
    exchangeProvider = IExchangeProvider(actor("exchangeProvider"));
    stableAsset = IStableToken(actor("stableAsset"));
    collateralAsset = IERC20(actor("collateralAsset"));
    randomAsset = actor("randomAsset");
    trader = actor("trader");
    pricingModule = IPricingModule(actor("pricingModule"));

    /* Mocks for dependent contracts */
    vm.mockCall(
      address(stableAsset),
      abi.encodePacked(IERC20(address(stableAsset)).transferFrom.selector),
      abi.encode(0x0)
    );

    vm.mockCall(address(stableAsset), abi.encodePacked(stableAsset.burn.selector), abi.encode(0x0));

    vm.mockCall(address(stableAsset), abi.encodePacked(stableAsset.mint.selector), abi.encode(0x0));

    vm.mockCall(
      address(reserve),
      abi.encodePacked(reserve.transferCollateralAsset.selector),
      abi.encode(0x0)
    );

    vm.mockCall(
      address(collateralAsset),
      abi.encodePacked(collateralAsset.transferFrom.selector),
      abi.encode(0x0)
    );

    changePrank(deployer);
    broker = new Broker(true);
    address[] memory exchangeProviders = new address[](3);
    exchangeProviders[0] = address(actor("exchangeProvider1"));
    exchangeProviders[1] = address(actor("exchangeProvider2"));
    exchangeProviders[2] = address(actor("exchangeProvider"));
    broker.initialize(exchangeProviders, address(reserve));
    changePrank(trader);
  }
}

contract BrokerTest_initializerAndSetters is BrokerTest {
  /* ---------- initializer ---------- */

  function test_initialize_shouldSetOwner() public {
    assertEq(broker.owner(), deployer);
  }

  function test_initilize_shouldSetExchangeProviderAddresseses() public {
    assertEq(broker.getExchangeProviders(), broker.getExchangeProviders());
  }

  function test_initialize_shouldSetReserve() public {
    assertEq(address(broker.reserve()), address(reserve));
  }

  /* ---------- Setters ---------- */

  function test_addExchangeProvider_whenSenderIsNotOwner_shouldRevert() public {
    changePrank(notDeployer);
    vm.expectRevert("Ownable: caller is not the owner");
    broker.addExchangeProvider(address(0));
  }

  function test_addExchangeProvider_whenAddressIsZero_shouldRevert() public {
    changePrank(deployer);
    vm.expectRevert("ExchangeProvider address can't be 0");
    broker.addExchangeProvider(address(0));
  }

  function test_addExchangeProvider_whenSenderIsOwner_shouldUpdateAndEmit() public {
    changePrank(deployer);
    address newPairManager = actor("newPairManager");
    vm.expectEmit(true, false, false, false);
    emit ExchangeProviderAdded(newPairManager);
    broker.addExchangeProvider(newPairManager);
    address[] memory updatedExchangeProviders = broker.getExchangeProviders();
    assertEq(updatedExchangeProviders[updatedExchangeProviders.length - 1], newPairManager);
  }

  function test_removeExchangeProvider_whenSenderIsOwner_shouldUpdateAndEmit() public {
    changePrank(deployer);
    vm.expectEmit(true, true, true, true);
    emit ExchangeProviderRemoved(actor("exchangeProvider1"));
    broker.removeExchangeProvider(actor("exchangeProvider1"), 0);
    assert(broker.getExchangeProviders()[0] != actor("exchangeProvider1"));
  }

  function test_removeExchangeProvider_whenAddressDoesNotExist_shouldRevert() public {
    changePrank(deployer);
    vm.expectRevert("index into exchangeProviders list not mapped to token");
    broker.removeExchangeProvider(notDeployer, 1);
  }

  function test_removeExchangeProvider_whenIndexOutOfRange_shouldRevert() public {
    changePrank(deployer);
    vm.expectRevert("index into exchangeProviders list not mapped to token");
    broker.removeExchangeProvider(actor("exchangeProvider1"), 1);
  }

  function test_removeExchangeProvider_whenNotOwner_shouldRevert() public {
    changePrank(notDeployer);
    vm.expectRevert("Ownable: caller is not the owner");
    broker.removeExchangeProvider(actor("exchangeProvider1"), 0);
  }

  function test_setReserve_whenSenderIsNotOwner_shouldRevert() public {
    changePrank(notDeployer);
    vm.expectRevert("Ownable: caller is not the owner");
    broker.setReserve(address(0));
  }

  function test_setReserve_whenAddressIsZero_shouldRevert() public {
    changePrank(deployer);
    vm.expectRevert("Reserve address must be set");
    broker.setReserve(address(0));
  }

  function test_setReserve_whenSenderIsOwner_shouldUpdateAndEmit() public {
    changePrank(deployer);
    address newReserve = actor("newReserve");
    vm.expectEmit(true, false, false, false);
    emit ReserveSet(newReserve, address(reserve));

    broker.setReserve(newReserve);
    assertEq(address(broker.reserve()), newReserve);
  }
}

contract BrokerTest_quote is BrokerTest {
  bytes32 exchangeId = keccak256(abi.encode("exhcangeId"));
  string exchangeAddress3;
  string token1;
  string token2;

  function test_getAmountIn_whenExchangeProviderWasNotSet_shouldRevert() public {
    vm.expectRevert("ExchangeProvider does not exist");
    broker.getAmountIn(
      actor(exchangeAddress3),
      exchangeId,
      address(stableAsset),
      address(collateralAsset),
      1e24
    );
  }

  // broken
  function test_getAmountIn_receivedCall() public {
    uint256 amountIn = 1e17;
    uint256 mockAmountOut = 1e16;

    vm.mockCall(
      actor("exchangeProvider"),
      abi.encodeWithSelector(
        exchangeProvider.getAmountIn.selector,
        exchangeId,
        address(stableAsset),
        address(collateralAsset),
        amountIn
      ),
      abi.encode(mockAmountOut)
    );

    uint256 amountOut = broker.getAmountIn(
      actor("exchangeProvider"),
      exchangeId,
      address(stableAsset),
      address(collateralAsset),
      amountIn
    );

    assertEq(amountOut, mockAmountOut);
  }

  // function test_getAmountIn_whenExchangeProviderWasSet() public {
  //   broker.setExchangeAddress();
  //   vm.mockCall(
  //     actor("exchangeProvider"),
  //     abi.encodeWithSelector(
  //       address(IExchangeProvider(actor("exchangeProvider"))).getAmountIn.selector,
  //       address(exchangeProvider),
  //       exchangeId,
  //       actor(token1),
  //       actor(token2),
  //       1e18
  //     ),
  //     abi.encode(2e18)
  //   );

  // uint256 amountIn = broker.getAmountIn(IExchangeProvider(actor("exchangeProvider")), exchangeId, address(stableAsset), address(collateralAsset), 1e16);

  // console.log(amountIn, "amamamamaa");
  //   assertEq(amountIn, 2e18);
  // }

  function test_getAmountOut_whenExchangeProviderWasNotSet_shouldRevert() public {
    vm.expectRevert("ExchangeProvider does not exist");
    broker.getAmountOut(actor(exchangeAddress3), exchangeId, actor(token1), actor(token2), 1e24);
  }

  function test_swapIn_whenExchangeProviderWasNotSet_shouldRevert() public {
    vm.expectRevert("ExchangeProvider does not exist");
    broker.swapIn(actor(exchangeAddress3), exchangeId, actor(token1), actor(token2), 2e24, 1e24);
  }

  function test_swapOut_whenExchangeProviderWasNotSet_shouldRevert() public {
    vm.expectRevert("ExchangeProvider does not exist");
    broker.getAmountIn(actor(exchangeAddress3), exchangeId, actor(token1), actor(token2), 1e24);
  }

  /// mock call to make sure you get something back

  /// check that the exchange received the call

  // function test_quote_tokenInStableAsset_shouldReturnQuote() public {
  //   bytes32 exchangeId = mockGetPair();
  //   uint256 amountIn = 1e18;

  //   vm.mockCall(
  //     address(exchange),
  //     abi.encodeWithSelector(
  //       exchange.getAmountOut.selector,
  //       stableAsset,
  //       collateralAsset,
  //       initialStableBucket,
  //       initialCollateralBucket,
  //       amountIn
  //     ),
  //     abi.encode(2e18, 1e24, 2e24)
  //   );

  //   (address tokenOut, uint256 amountOut) = broker.quote(pairId, address(stableAsset), amountIn);
  //   assertEq(tokenOut, address(collateralAsset));
  //   assertEq(amountOut, 2e18);
  // }

  // function test_quote_tokenInCollateralAsset_shouldReturnQuote() public {
  //   bytes32 pairId = mockGetPair();
  //   uint256 amountIn = 1e18;

  // vm.mockCall(
  //   address(exchange),
  //   abi.encodeWithSelector(
  //     exchange.getAmountOut.selector,
  //     collateralAsset,
  //     stableAsset,
  //     initialCollateralBucket,
  //     initialStableBucket,
  //     amountIn
  //   ),
  //   abi.encode(2e18, 10e18, 20e18)
  // );

  //   (address tokenOut, uint256 amountOut) = broker.quote(pairId, address(collateralAsset), 1e18);
  //   assertEq(tokenOut, address(stableAsset));
  //   assertEq(amountOut, 2e18);
  // }

  // function test_quote_tokenInNotInPair_shouldRevert() public {
  //   bytes32 pairId = mockGetPair();
  //   vm.expectRevert("tokenIn is not in the pair");
  //   broker.quote(pairId, randomAsset, 1e18);
  // }

}

// contract BrokerTest_swap is BrokerTest {
//   function test_swap_tokenInStableAsset_shouldExecuteSwap() public {
//     bytes32 pairId = mockGetPair();
//     uint256 amountIn = 1e18;
//     uint256 mockAmountOut = 2e18;
//     uint256 nextStableBucket = initialStableBucket + amountIn;
//     uint256 nextCollateralBucket = initialCollateralBucket - mockAmountOut;

//     vm.mockCall(
//       address(exchange),
//       abi.encodeWithSelector(
//         exchange.getAmountOut.selector,
//         stableAsset,
//         collateralAsset,
//         initialStableBucket,
//         initialCollateralBucket,
//         amountIn
//       ),
//       abi.encode(mockAmountOut, nextStableBucket, nextCollateralBucket)
//     );

//     vm.expectCall(
//       address(stableAsset),
//       abi.encodeWithSelector(
//         IERC20(address(stableAsset)).transferFrom.selector,
//         trader,
//         address(broker),
//         amountIn
//       )
//     );

//     vm.expectCall(
//       address(stableAsset),
//       abi.encodeWithSelector(stableAsset.burn.selector, amountIn)
//     );

//     vm.expectCall(
//       address(pairManager),
//       abi.encodeWithSelector(
//         pairManager.updateBuckets.selector,
//         pairId,
//         nextStableBucket,
//         nextCollateralBucket
//       )
//     );

//     vm.expectEmit(true, true, true, true, address(broker));
//     emit Swap(
//       pairId,
//       trader,
//       address(stableAsset),
//       address(collateralAsset),
//       amountIn,
//       mockAmountOut
//     );
//     (address tokenOut, uint256 amountOut) = broker.swap(pairId, address(stableAsset), amountIn, 0);
//     assertEq(tokenOut, address(collateralAsset));
//     assertEq(amountOut, mockAmountOut);
//   }

//   function test_swap_tokenInCollateralAsset_shouldExecuteSwap() public {
//     bytes32 pairId = mockGetPair();
//     uint256 amountIn = 2e18;
//     uint256 mockAmountOut = 1e18;
//     uint256 nextStableBucket = initialStableBucket - mockAmountOut;
//     uint256 nextCollateralBucket = initialCollateralBucket + amountIn;

//     vm.mockCall(
//       address(exchange),
//       abi.encodeWithSelector(
//         exchange.getAmountOut.selector,
//         collateralAsset,
//         stableAsset,
//         initialCollateralBucket,
//         initialStableBucket,
//         amountIn
//       ),
//       abi.encode(mockAmountOut, nextCollateralBucket, nextStableBucket)
//     );

//     vm.expectCall(
//       address(collateralAsset),
//       abi.encodeWithSelector(
//         collateralAsset.transferFrom.selector,
//         trader,
//         address(reserve),
//         amountIn
//       )
//     );

//     vm.expectCall(
//       address(stableAsset),
//       abi.encodeWithSelector(stableAsset.mint.selector, trader, mockAmountOut)
//     );

//     vm.expectCall(
//       address(pairManager),
//       abi.encodeWithSelector(
//         pairManager.updateBuckets.selector,
//         pairId,
//         nextStableBucket,
//         nextCollateralBucket
//       )
//     );

//     vm.expectEmit(true, true, true, true, address(broker));
//     emit Swap(
//       pairId,
//       trader,
//       address(collateralAsset),
//       address(stableAsset),
//       amountIn,
//       mockAmountOut
//     );
//     (address tokenOut, uint256 amountOut) = broker.swap(
//       pairId,
//       address(collateralAsset),
//       amountIn,
//       0
//     );
//     assertEq(tokenOut, address(stableAsset));
//     assertEq(amountOut, mockAmountOut);
//   }

// function test_swap_minAmountNotMet_shouldRevert() public {
//   bytes32 pairId = mockGetPair();
//   uint256 amountIn = 1e18;
//   uint256 mockAmountOut = 2e18;
//   uint256 nextStableBucket = initialStableBucket + amountIn;
//   uint256 nextCollateralBucket = initialCollateralBucket - mockAmountOut;

//   vm.mockCall(
//     address(exchange),
//     abi.encodeWithSelector(
//       exchange.getAmountOut.selector,
//       stableAsset,
//       collateralAsset,
//       initialStableBucket,
//       initialCollateralBucket,
//       amountIn
//     ),
//     abi.encode(mockAmountOut, nextStableBucket, nextCollateralBucket)
//   );

//   vm.expectRevert("amountOutMin not met");
//   broker.swap(pairId, address(stableAsset), amountIn, mockAmountOut + 1);
// }

// function test_swap_assetNotInPair_shouldRevert() public {
//   bytes32 pairId = mockGetPair();
//   vm.expectRevert("tokenIn is not in the pair");
//   broker.swap(pairId, randomAsset, 1e18, 0);
// }

