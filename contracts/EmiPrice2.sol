// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.2;

import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./uniswapv2/interfaces/IUniswapV2Factory.sol";
import "./uniswapv2/interfaces/IUniswapV2Pair.sol";
import "./libraries/Priviledgeable.sol";
import "./EmiFactory.sol";
import "./interfaces/IEmiRouter.sol";
import "./Emiswap.sol";
import "./interfaces/IOneSplit.sol";

contract EmiPrice2 is Initializable, Priviledgeable {
    using SafeMath for uint256;
    using SafeMath for uint256;
    address[3] public market;
    address public emiRouter;
    uint256 constant MARKET_OUR = 0;
    uint256 constant MARKET_UNISWAP = 1;
    uint256 constant MARKET_1INCH = 2;
    uint256 constant MAX_PATH_LENGTH = 5;

    string public codeVersion = "EmiPrice2 v1.0-137-gf94b488";

    /**
     * @dev Upgradeable proxy constructor replacement
     */
    function initialize(
        address _market1,
        address _market2,
        address _market3,
        address _router
    ) public initializer {
        require(_market1 != address(0), "Market1 address cannot be 0");
        require(_market2 != address(0), "Market2 address cannot be 0");
        require(_market3 != address(0), "Market3 address cannot be 0");
        require(_router != address(0), "Router address cannot be 0");

        market[0] = _market1;
        market[1] = _market2;
        market[2] = _market3;
        emiRouter = _router;
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

    /**
     * @dev Upgradeable proxy constructor replacement
     */
    function changeMarket(uint8 idx, address _market) external onlyAdmin {
        require(_market != address(0), "Token address cannot be 0");
        require(idx < 3, "Wrong market index");

        market[idx] = _market;
    }

    // internal methods
    function _getUniswapPrice(
        address[] calldata _coins,
        address _base,
        uint256[] memory _prices
    ) internal view {
        IUniswapV2Factory _factory = IUniswapV2Factory(market[MARKET_UNISWAP]);
        IUniswapV2Pair _p;

        if (address(_factory) == address(0)) {
            return;
        }

        uint256 base_decimal = ERC20(_base).decimals();

        for (uint256 i = 0; i < _coins.length; i++) {
            uint256 target_decimal = ERC20(_coins[i]).decimals();

            if (_coins[i] == _base) {
                _prices[i] = 10**18; // special case: 1 for base token
                break;
            }

            (address t0, address t1) = (_coins[i] < _base)?(_coins[i], _base):(_base, _coins[i]);
            _p = IUniswapV2Pair(_factory.getPair(t0, t1));
            if (address(_p) == address(0)) {
                _prices[i] = 0;
            } else {
                (uint256 reserv0, uint256 reserv1, ) = _p.getReserves();
                if (reserv1 == 0 || reserv0 == 0) {
                    _prices[i] = 0; // special case
                } else {
                    _prices[i] = (address(_coins[i]) < address(_base))
                        ? reserv0.mul(10**(18 - base_decimal + target_decimal)).div(reserv1)
                        : reserv1.mul(10**(18 - target_decimal + base_decimal)).div(reserv0);
                }
            }
        }
    }

    /**
     * @dev Get price from our router
     */
    function _getOurPrice(
        address[] calldata _coins,
        address[] calldata _base,
        uint256[] memory _prices
    ) internal view {
        EmiFactory _factory = EmiFactory(market[MARKET_OUR]);
        Emiswap _p;

        if (address(_factory) == address(0)) {
            return;
        }

        for (uint256 i = 0; i < _coins.length; i++) {
            // test each base token -- whether we can use it for price calc
            for (uint256 m = 0; m < _base.length; m++) {
                if (_coins[i] == _base[m]) {
                    _prices[i] = 10**18; // special case: 1 for base token
                    break;
                }

                (address t0, address t1) = (_coins[i] < _base[m])?(_coins[i], _base[m]):(_base[m], _coins[i]);
                _p = Emiswap(
                    _factory.pools(IERC20(t0), IERC20(t1))
                ); // do we have straigt pair?
                if (address(_p) == address(0)) {
                    // we have to calc route
                    address[] memory _route =
                        _calculateRoute(_coins[i], _base[m]);
                    if (_route.length == 0) {
                        continue; // try next base token
                    } else {
                        uint256 _in = 10**uint256(ERC20(_base[m]).decimals());
                        uint256[] memory _amts =
                            IEmiRouter(emiRouter).getAmountsOut(_in, _route);
                        if (_amts.length>0) {
                          _prices[i] = _amts[_amts.length - 1];
                        } else {
                          _prices[i] = 0;
                        }
                        break;
                    }
                } else {
                    // yes, calc straight price
                    (_prices[i], ) = _p.getReturn(
                        IERC20(_coins[i]),
                        IERC20(_base[m]),
                        10**uint256(ERC20(_coins[i]).decimals())
                    );
                    break;
                }
            }
        }
    }

    /**
     * @dev Get price from 1inch integrator
     */
    function _get1inchPrice(
        address[] calldata _coins,
        address _base,
        uint256[] memory _prices
    ) internal view {
        IOneSplit _factory = IOneSplit(market[MARKET_1INCH]);

        if (address(_factory) == address(0)) {
            return;
        }
        for (uint256 i = 0; i < _coins.length; i++) {
            uint256 d = uint256(ERC20(_coins[i]).decimals());
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
     * @dev Calculates route from _target token to _base, using adopted Li algorithm
     * https://ru.wikipedia.org/wiki/%D0%90%D0%BB%D0%B3%D0%BE%D1%80%D0%B8%D1%82%D0%BC_%D0%9B%D0%B8
     */
    function _calculateRoute(address _target, address _base)
        internal
        view
        returns (address[] memory path)
    {
        Emiswap[] memory pools = EmiFactory(market[0]).getAllPools(); // gets all pairs
        uint8[] memory pairIdx = new uint8[](pools.length); // vector for storing path step indexes

        // Phase 1. Mark pairs starting from target token
        _calcNextLink(pools, pairIdx, 1, _target); // start from 1 step
        address[] memory _curStep = new address[](1);
        _curStep[0] = _target; // store target address as first current step
        address[] memory _prevStep;

        for (uint8 i = 2; i < MAX_PATH_LENGTH; i++) {
            // pass the wave
            _copySteps(_prevStep, _curStep);
            delete _curStep;
            _curStep = new address[](pools.length);

            for (uint256 j = 0; j < pools.length; j++) {
                if (pairIdx[j] == i - 1) { // found previous step, store second token
                    address _a = _getAddressFromPrevStep(pools[j], _prevStep);
                    _calcNextLink(pools, pairIdx, i, _a);
                    _addToCurrentStep(pools[j], _curStep, _a);
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
                    baseIdx = i;
                }
            }
        }

        if (baseIdx == 0) {
            // no route found
            return new address[](0);
        } else {
            // get back to target from base
            address _a = _base;

            path = new address[](baseIdx);

            for (uint8 i = baseIdx; i > 0; i--) {
                // take pair from last level
                for (uint256 j = 0; j < pools.length; j++) {
                    if (
                        pairIdx[j] == i &&
                        (address(pools[j].tokens(1)) == _a ||
                            address(pools[j].tokens(0)) == _a)
                    ) {
                        // push path chain
                        path[i - 1] = address(pools[j]);
                        _a = (address(pools[j].tokens(0)) == _a)
                            ? address(pools[j].tokens(1))
                            : address(pools[j].tokens(0));
                        break;
                    }
                }
            }
        }
    }

    /**
     * @dev Marks next path level from _token
     */
    function _calcNextLink(
        Emiswap[] memory _pools,
        uint8[] memory _idx,
        uint8 lvl,
        address _token
    ) internal view {
        for (uint256 j = 0; j < _pools.length; j++) {
            if (_idx[j] == 0) { // empty indexx cell
                if (
                    address(_pools[j].tokens(1)) == _token ||
                    address(_pools[j].tokens(0)) == _token
                ) {
                    // found match
                    _idx[j] = lvl;
                }
            }
        }
    }

    /**
     * @dev Marks next level from _token
     */
    function _getAddressFromPrevStep(Emiswap pool, address[] memory prevStep)
        internal
        view
        returns (address r)
    {
        for (uint256 i = 0; i < prevStep.length; i++) {
            if (
                address(pool.tokens(0)) == prevStep[i] ||
                address(pool.tokens(1)) == prevStep[i]
            ) {
                return
                    (address(pool.tokens(0)) == prevStep[i])
                        ? address(pool.tokens(1))
                        : address(pool.tokens(0));
            }
        }
    }

    /**
     * @dev Copies one array to another striping empty entries
     */
    function _copySteps(address[] memory _to, address[] memory _from)
        internal
        pure
    {
        delete _to;
        uint256 l = 0;

        for (uint256 i = 0; i < _from.length; i++) {
            if (_from[i] == address(0)) {
                break;
            } else {
                l++;
            }
        }
        _to = new address[](l);

        for (uint256 i = 0; i < _to.length; i++) {
            _to[i] = _from[i];
        }
    }

    /**
     * @dev Adds pairs second token address to current step array
     * @param p pool
     * @param _step Array for storing next step addresses
     * @param _token First token pair address
     */
    function _addToCurrentStep(
        Emiswap p,
        address[] memory _step,
        address _token
    ) internal view {
        uint256 l = 0;
        address _secondToken =
            (address(p.tokens(0)) == _token)
                ? address(p.tokens(1))
                : address(p.tokens(0));

        for (uint256 i = 0; i < _step.length; i++) {
            if (_step[i] == _secondToken) { // token already exists in a list
                return;
            } else {
                if (_step[i] == address(0)) { // first free cell found
                    break;
                } else {
                    l++;
                }
            }
        }
        _step[l] = _secondToken;
    }
}
