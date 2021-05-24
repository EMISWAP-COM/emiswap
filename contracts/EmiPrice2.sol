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
    function getCoinPrices(address[] calldata _coins, address[] calldata _basictokens, uint8 _market)
        external
        view
        returns (uint256[] memory prices)
    {
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

        for (uint256 i = 0; i < _coins.length; i++) {
            _p = IUniswapV2Pair(_factory.getPair(_coins[i], _base));
            uint256 decimal = ERC20(_coins[i]).decimals();
            if (address(_p) == address(0)) { // calculate using routes

                _prices[i] = 0;
            } else {
                (uint256 reserv0, uint256 reserv1, ) = _p.getReserves();
                if (reserv1 == 0 || reserv0 == 0) {
                    _prices[i] = 0; // special case
                } else {
                    _prices[i] = address(_coins[i]) < address(_base)
                        ? reserv1.mul(10**(18 - decimal)).div(reserv0)
                        : reserv0.mul(10**(18 - decimal)).div(reserv1);
                }
            }
        }
    }

    /**
     * @dev Get price from our router
     */
    function _getOurPrice(address[] calldata _coins, address[] calldata _base, uint256[] memory _prices)
        internal
        view
    {
        EmiFactory _factory = EmiFactory(market[MARKET_OUR]);
        Emiswap _p;

        if (address(_factory) == address(0)) {
            return;
        }

        for (uint256 i = 0; i < _coins.length; i++) {
            // test each base token -- whether we can use it for price calc
            for (uint m = 0; m < _base.length; m++) {

              if (_coins[i]==_base[m]) {
                _prices[i] = 10**18;
                break;
              }

              _p = Emiswap(_factory.pools(IERC20(_coins[i]), IERC20(_base[m]))); // do we have straigt pair?
              if (address(_p) == address(0)) { // we have to calc route
                address [] memory _route = _calculateRoute(_coins[i], _base[m]);
                if (_route.length == 0) {
                  continue; // try next base token
                } else {
                  uint256 _in = 10**uint256(ERC20(_base[m]).decimals());
                  uint256[] memory _amts = IEmiRouter(emiRouter).getAmountsOut(_in, _route);
                  _prices[i] = _amts[_amts.length-1];
                  break;
                }
              } else { // yes, calc straight price
                (_prices[i], ) = _p.getReturn(
                    IERC20(_coins[i]),
                    IERC20(_base[m]),
                    10**uint256(ERC20(_coins[i]).decimals())
                );
                _prices[i] = _prices[i].div(10**18);
                break;
              }
            }
       }
    }

    /**
     * @dev Get price from 1inch integrator
     */
    function _get1inchPrice(address[] calldata _coins, address _base, uint256[] memory _prices)
        internal
        view
    {
        IOneSplit _factory = IOneSplit(market[MARKET_1INCH]);

        if (address(_factory) == address(0)) {
            return;
        }
        for (uint256 i = 0; i < _coins.length; i++) {
            (_prices[i], ) = _factory.getExpectedReturn(
                IERC20(_coins[i]),
                IERC20(_base),
                10**uint256(ERC20(_coins[i]).decimals()),
                1,
                0
            );
            _prices[i] = _prices[i].div(10**18); // 18 decimal places
        }
    }

    /**
     * @dev Calculates route from _target token to _base
     */
    function _calculateRoute(address _target, address _base)
        internal
        view
        returns(address[] memory path)
    {
      Emiswap [] memory pools = EmiFactory(market[0]).getAllPools();

      for (uint256 i = 0; i < pools.length; i++) { // look for the final part of path
        delete path;

        if (address(pools[i].tokens(1)) == _base || address(pools[i].tokens(0)) == _base) { // found match
          path[i++] = address(pools[i]);
          address _from = _base;
          address _next = _getNextLink(pools, _target, _from);
        }
      }
    }

    /**
     * @dev Calculates next chain link from _from token to _to
     */
    function _getNextLink(Emiswap [] memory _pools, address _to, address _from) internal view returns (address _pair)
    {
      (address t0, address t1) = (_to > _from)?(_to, _from):(_from, _to);

      for (uint256 i = 0; i < _pools.length; i++) { // look for the final part of path
        if (address(_pools[i].tokens(0)) == t0 && address(_pools[i].tokens(1)) == t1) { // found match
          return address(_pools[i]);
        }
      }
    }
}
