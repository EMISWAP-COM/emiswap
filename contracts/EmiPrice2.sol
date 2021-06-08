// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.2;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./uniswapv2/interfaces/IUniswapV2Factory.sol";
import "./uniswapv2/interfaces/IUniswapV2Pair.sol";
import "./uniswapv2/interfaces/IUniswapV2Router02.sol";
import "./libraries/Priviledgeable.sol";
import "./interfaces/IEmiERC20.sol";
import "./interfaces/IEmiRouter.sol";
import "./interfaces/IEmiswap.sol";
import "./interfaces/IOneSplit.sol";

contract EmiPrice2 is Initializable, Priviledgeable {
    using SafeMath for uint256;
    using SafeMath for uint256;
    address[3] public market;
    address public emiRouter;
    address public uniRouter;
    uint256 constant MARKET_OUR = 0;
    uint256 constant MARKET_UNISWAP = 1;
    uint256 constant MARKET_1INCH = 2;
    uint256 constant MAX_PATH_LENGTH = 5;

 string public codeVersion = "EmiPrice2 v1.0-200-g8d0b0fa";

    /**
     * @dev Upgradeable proxy constructor replacement
     */
    function initialize(
        address _market1,
        address _market2,
        address _market3,
        address _emirouter,
        address _unirouter
    ) public initializer {
        require(_market1 != address(0), "Market1 address cannot be 0");
        require(_market2 != address(0), "Market2 address cannot be 0");
        require(_market3 != address(0), "Market3 address cannot be 0");
        require(_emirouter != address(0), "EmiRouter address cannot be 0");
        require(_unirouter != address(0), "UniRouter address cannot be 0");

        market[0] = _market1;
        market[1] = _market2;
        market[2] = _market3;
        emiRouter = _emirouter;
        uniRouter = _unirouter;
        _addAdmin(msg.sender);
    }

    /**
     * @dev Return coin prices with 18-digit precision
     * @param _coins Array of token addresses for price determination
     * @param _basictokens Array of basic tokens to determine price against
     * @param _market Market index [0..2] to get prices from
     */
    function getCoinPrices(
        address[] calldata _coins,
        address[] calldata _basictokens,
        uint8 _market
    ) external view returns (uint256[] memory prices) {
        require(_market < market.length, "Wrong market index");
        uint256[] memory _prices;

        _prices = new uint256[](_coins.length);

        if (_market == MARKET_UNISWAP) {
            _getUniswapPrice(_coins, _basictokens[0], _prices);
        } else if (_market == MARKET_OUR) {
            _getOurPrice(_coins, _basictokens, _prices);
        } else {
            _get1inchPrice(_coins, _basictokens[0], _prices);
        }

        return _prices;
    }

    function calcRoute(address _target, address _base)
        external
        view
        returns (address[] memory path)
    {
        return _calculateRoute(_target, _base);
    }

    /**
     * @dev Changes market factory address
     */
    function changeMarket(uint8 idx, address _market) external onlyAdmin {
        require(_market != address(0), "Token address cannot be 0");
        require(idx < 3, "Wrong market index");

        market[idx] = _market;
    }

    /**
     * @dev Changes unirouter factory address
     */
    function changeUniRouter(address _router) external onlyAdmin {
        require(_router != address(0), "Router address cannot be 0");

        uniRouter = _router;
    }

    /**
     * @dev Changes market factory address
     */
    function changeEmiRouter(address _router) external onlyAdmin {
        require(_router != address(0), "Router address cannot be 0");

        emiRouter = _router;
    }

    // internal methods
    function _getUniswapPrice(
        address[] memory _coins,
        address _base,
        uint256[] memory _prices
    ) internal view {
        uint256 base_decimal = IEmiERC20(_base).decimals();

        for (uint256 i = 0; i < _coins.length; i++) {
            uint256 target_decimal = IEmiERC20(_coins[i]).decimals();

            if (_coins[i] == _base) {
                _prices[i] = 10**18; // special case: 1 for base token
                continue;
            }

            uint256 _in = 10**target_decimal;

            address[] memory _path = new address[](2);
            _path[0] = _coins[i];
            _path[1] = _base;
            uint256[] memory _amts =
                IUniswapV2Router02(uniRouter).getAmountsOut(_in, _path);
            if (_amts.length > 0) {
                _prices[i] = _amts[_amts.length - 1].mul(
                    10**(18 - base_decimal)
                );
            } else {
                _prices[i] = 0;
            }
        }
    }

    /**
     * @dev Get price from our router
     */
    function _getOurPrice(
        address[] memory _coins,
        address[] memory _base,
        uint256[] memory _prices
    ) internal view {
        IEmiswapRegistry _factory = IEmiswapRegistry(market[MARKET_OUR]);
        IEmiswap _p;

        if (address(_factory) == address(0)) {
            return;
        }

        for (uint256 i = 0; i < _coins.length; i++) {
            // test each base token -- whether we can use it for price calc
            uint256 target_decimal = IEmiERC20(_coins[i]).decimals();

            for (uint256 m = 0; m < _base.length; m++) {
                if (_coins[i] == _base[m]) {
                    _prices[i] = 10**18; // special case: 1 for base token
                    break;
                }
                uint256 base_decimal = IEmiERC20(_base[m]).decimals();

                (address t0, address t1) =
                    (_coins[i] < _base[m])
                        ? (_coins[i], _base[m])
                        : (_base[m], _coins[i]);
                _p = IEmiswap(_factory.pools(IERC20(t0), IERC20(t1))); // do we have direct pair?
                address[] memory _route;

                if (address(_p) == address(0)) {
                    // we have to calc route
                    _route = _calculateRoute(_coins[i], _base[m]);
                } else { // just take direct pair
                    _route = new address[](2);
                    _route[0] = _coins[i];
                    _route[1] = _base[m];
                }
                if (_route.length == 0) {
                    continue; // try next base token
                } else {
                    uint256 _in = 10**target_decimal;
                    uint256[] memory _amts =
                        IEmiRouter(emiRouter).getAmountsOut(_in, _route);
                    if (_amts.length > 0) {
                        _prices[i] = _amts[_amts.length - 1].mul(
                            10**(18 - base_decimal)
                        );
                    } else {
                        _prices[i] = 0;
                    }
                    break;
                }
            }
        }
    }

    /**
     * @dev Get price from 1inch integrator
     */
    function _get1inchPrice(
        address[] memory _coins,
        address _base,
        uint256[] memory _prices
    ) internal view {
        IOneSplit _factory = IOneSplit(market[MARKET_1INCH]);

        if (address(_factory) == address(0)) {
            return;
        }
        for (uint256 i = 0; i < _coins.length; i++) {
            uint256 d = uint256(IEmiERC20(_coins[i]).decimals());
            (_prices[i], ) = _factory.getExpectedReturn(
                IERC20(_coins[i]),
                IERC20(_base),
                10**d,
                1,
                0
            );
        }
    }

    /**
     * @dev Calculates route from _target token to _base, using adapted Li algorithm
     * https://ru.wikipedia.org/wiki/%D0%90%D0%BB%D0%B3%D0%BE%D1%80%D0%B8%D1%82%D0%BC_%D0%9B%D0%B8
     */
    function _calculateRoute(address _target, address _base)
        internal
        view
        returns (address[] memory path)
    {
        IEmiswap[] memory pools =
            IEmiswapRegistry(market[MARKET_OUR]).getAllPools(); // gets all pairs
        uint8[] memory pairIdx = new uint8[](pools.length); // vector for storing path step indexes

        // Phase 1. Mark pairs starting from target token
        _markPathStep(pools, pairIdx, 1, _target); // start from 1 step
        address[] memory _curStep = new address[](pools.length);
        _curStep[0] = _target; // store target address as first current step
        address[] memory _prevStep = new address[](pools.length);

        for (uint8 i = 2; i < MAX_PATH_LENGTH; i++) {
            // pass the wave
            _moveSteps(_prevStep, _curStep);

            for (uint256 j = 0; j < pools.length; j++) {
                if (pairIdx[j] == i - 1) {
                    // found previous step, store second token
                    address _a = _getAddressFromPrevStep(pools[j], _prevStep);
                    _markPathStep(pools, pairIdx, i, _a);
                    _addToCurrentStep(_curStep, _a);
                }
            }
        }

        // matrix marked -- start creating route from base token back to target
        uint8 baseIdx = 0;

        for (uint8 i = 0; i < pools.length; i++) {
            if (
                address(pools[i].tokens(1)) == _base ||
                address(pools[i].tokens(0)) == _base
            ) {
                if (baseIdx == 0 || baseIdx > pairIdx[i]) {
                    // look for shortest available path
                    baseIdx = pairIdx[i];
                }
            }
        }

        if (baseIdx == 0) {
            // no route found
            return new address[](0);
        } else {
            // get back to target from base
            address _a = _base;

            path = new address[](baseIdx + 1);
            path[baseIdx] = _base;

            for (uint8 i = baseIdx; i > 0; i--) {
                // take pair from last level
                for (uint256 j = 0; j < pools.length; j++) {
                    if (
                        pairIdx[j] == i &&
                        (address(pools[j].tokens(1)) == _a ||
                            address(pools[j].tokens(0)) == _a)
                    ) {
                        // push path chain
                        _a = (address(pools[j].tokens(0)) == _a) // get next token from pair
                            ? address(pools[j].tokens(1))
                            : address(pools[j].tokens(0));
                        path[i - 1] = _a;
                        break;
                    }
                }
            }
            return path;
        }
    }

    /**
     * @dev Marks next path level from _token
     */
    function _markPathStep(
        IEmiswap[] memory _pools,
        uint8[] memory _idx,
        uint8 lvl,
        address _token
    ) internal view {
        for (uint256 j = 0; j < _pools.length; j++) {
            if (
                _idx[j] == 0 &&
                (address(_pools[j].tokens(1)) == _token ||
                    address(_pools[j].tokens(0)) == _token)
            ) {
                // found match
                _idx[j] = lvl;
            }
        }
    }

    /**
     * @dev Get address of the second token from previous level pair
     */
    function _getAddressFromPrevStep(IEmiswap pair, address[] memory prevStep)
        internal
        view
        returns (address r)
    {
        for (uint256 i = 0; i < prevStep.length; i++) {
            if (
                prevStep[i] != address(0) &&
                (address(pair.tokens(0)) == prevStep[i] ||
                    address(pair.tokens(1)) == prevStep[i])
            ) {
                return
                    (address(pair.tokens(0)) == prevStep[i])
                        ? address(pair.tokens(1))
                        : address(pair.tokens(0));
            }
        }
        return address(0);
    }

    /**
     * @dev Moves one array to another striping empty entries
     */
    function _moveSteps(address[] memory _to, address[] memory _from)
        internal
        pure
    {
        for (uint256 i = 0; i < _from.length; i++) {
            _to[i] = _from[i];
            _from[i] = address(0);
        }
    }

    /**
     * @dev Adds pairs second token address to current step array
     * @param _step Array for storing current step addresses
     * @param _token First token pair address
     */
    function _addToCurrentStep(address[] memory _step, address _token)
        internal
        pure
    {
        uint256 l = 0;

        for (uint256 i = 0; i < _step.length; i++) {
            if (_step[i] == _token) {
                // token already exists in a list
                return;
            } else {
                if (_step[i] == address(0)) {
                    // first free cell found
                    break;
                } else {
                    l++;
                }
            }
        }
        _step[l] = _token;
    }
}
