// SPDX-License-Identifier: MIT
pragma solidity ^0.6.2;

import "@openzeppelin/contracts/proxy/Initializable.sol";
import "./uniswapv2/interfaces/IUniswapV2Pair.sol";
import "./uniswapv2/interfaces/IUniswapV2Factory.sol";
import "./libraries/Priviledgeable.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./interfaces/IEmiRouter.sol";
import "./interfaces/IEmiVoting.sol";
import "./interfaces/IMooniswap.sol";
import "./libraries/TransferHelper.sol";

/**
 * @dev Contract to convert liquidity from other market makers (Uniswap/Mooniswap) to our pairs.
 */
contract EmiVamp is Initializable, Priviledgeable {
    using SafeERC20 for IERC20;

    struct LPTokenInfo {
        address lpToken;
        uint16 tokenType; // Token type: 0 - uniswap (default), 1 - mooniswap
    }

    IERC20[] public allowedTokens; // List of tokens that we accept

    // Info of each third-party lp-token.
    LPTokenInfo[] public lpTokensInfo;

    string public codeVersion = "EmiVamp v1.0-137-gf94b488";
    IEmiRouter public ourRouter;

    event Deposit(address indexed user, address indexed token, uint256 amount);

    address public defRef;
    address private _voting;

    // !!!In updates to contracts set new variables strictly below this line!!!
    //-----------------------------------------------------------------------------------

    /**
     * @dev Implementation of {UpgradeableProxy} type of constructors
     */
    function initialize(
        address[] memory _lptokens,
        uint8[] memory _types,
        address _ourrouter,
        address _ourvoting
    ) public initializer {
        require(_lptokens.length > 0, "EmiVamp: length>0!");
        require(_lptokens.length == _types.length, "EmiVamp: lengths!");
        require(_ourrouter != address(0), "EmiVamp: router!");
        require(_ourvoting != address(0), "EmiVamp: voting!");

        for (uint256 i = 0; i < _lptokens.length; i++) {
            lpTokensInfo.push(
                LPTokenInfo({lpToken: _lptokens[i], tokenType: _types[i]})
            );
        }
        ourRouter = IEmiRouter(_ourrouter);
        defRef = address(0xdF3242dE305d033Bb87334169faBBf3b7d3D96c2);
        _addAdmin(msg.sender);
    }

    /**
     * @dev Returns length of allowed tokens private array
     */
    function getAllowedTokensLength() external view returns (uint256) {
        return allowedTokens.length;
    }

    function lpTokensInfoLength() external view returns (uint256) {
        return lpTokensInfo.length;
    }

    /**
     *  @dev Returns pair base tokens
     */
    function lpTokenDetailedInfo(uint256 _pid)
        external
        view
        returns (address, address)
    {
        require(_pid < lpTokensInfo.length);
        if (lpTokensInfo[_pid].tokenType == 0) {
            // this is uniswap
            IUniswapV2Pair lpToken = IUniswapV2Pair(lpTokensInfo[_pid].lpToken);
            return (lpToken.token0(), lpToken.token1());
        } else {
            // this is mooniswap
            IMooniswap lpToken = IMooniswap(lpTokensInfo[_pid].lpToken);
            IERC20[] memory t = lpToken.getTokens();
            return (address(t[0]), address(t[1]));
        }
    }

    /**
     * @dev Adds new entry to the list of allowed tokens (if it is not exist yet)
     */
    function addAllowedToken(address _token) external onlyAdmin {
        require(_token != address(0));

        for (uint256 i = 0; i < allowedTokens.length; i++) {
            if (address(allowedTokens[i]) == _token) {
                return;
            }
        }
        allowedTokens.push(IERC20(_token));
    }

    /**
     * @dev Remove entry from the list of allowed tokens
     */
    function removeAllowedToken(uint _idx) external onlyAdmin {
        require(_idx < allowedTokens.length, "EmiVamp: wrong idx");

	delete allowedTokens[_idx];
    }

    /**
     * @dev Adds new entry to the list of convertible LP-tokens
     */
    function addLPToken(address _token, uint16 _tokenType)
        external
        onlyAdmin
        returns (uint256)
    {
        require(_token != address(0));
        require(_tokenType < 2);

        for (uint256 i = 0; i < lpTokensInfo.length; i++) {
            if (lpTokensInfo[i].lpToken == _token) {
                return i;
            }
        }
        lpTokensInfo.push(
            LPTokenInfo({lpToken: _token, tokenType: _tokenType})
        );
        return lpTokensInfo.length;
    }

    /**
     * @dev Remove entry from the list of convertible LP-tokens
     */
    function removeLPToken(uint _idx) external onlyAdmin {
        require(_idx < lpTokensInfo.length, "EmiVamp: wrong idx");

	delete lpTokensInfo[_idx];
    }

    /**
     * @dev Remove entry from the list of convertible LP-tokens
     */
    function changeLPToken(uint _idx, address _token, uint16 _tokenType) external onlyAdmin {
        require(_idx < lpTokensInfo.length, "EmiVamp: wrong idx");
        require(_token != address(0), "EmiVamp: token=0!");
        require(_tokenType < 2, "EmiVamp: wrong tokenType");

        lpTokensInfo[_idx].lpToken = _token;
        lpTokensInfo[_idx].tokenType = _tokenType;
    }

    /**
     * @dev Change emirouter address
     */
    function changeRouter(uint256 _proposalId) external onlyAdmin {
        address _newRouter;

        _newRouter = IEmiVoting(_voting).getVotingResult(_proposalId);
        require(_newRouter != address(0), "New Router address is wrong");

        ourRouter = IEmiRouter(_newRouter);
    }

    /**
     * @dev Change default referrer address
     */
    function changeReferral(address _ref) external onlyAdmin {
        defRef = _ref;
    }

    // Deposit LP tokens to us
    /**
     * @dev Main function that converts third-party liquidity (represented by LP-tokens) to our own LP-tokens
     */
    function deposit(uint256 _pid, uint256 _amount) public {
        require(_pid < lpTokensInfo.length, "EmiVamp: pool idx is wrong");

        if (lpTokensInfo[_pid].tokenType == 0) {
            _depositUniswap(_pid, _amount);
        } else if (lpTokensInfo[_pid].tokenType == 1) {
            _depositMooniswap(_pid, _amount);
        } else {
            return;
        }
        emit Deposit(msg.sender, lpTokensInfo[_pid].lpToken, _amount);
    }

    /**
     * @dev Actual function that converts third-party Uniswap liquidity (represented by LP-tokens) to our own LP-tokens
     */
    function _depositUniswap(uint256 _pid, uint256 _amount) internal {
        IUniswapV2Pair lpToken = IUniswapV2Pair(lpTokensInfo[_pid].lpToken);

        // check pair existance
        IERC20 token0 = IERC20(lpToken.token0());
        IERC20 token1 = IERC20(lpToken.token1());

        // transfer to us
	TransferHelper.safeTransferFrom(address(lpToken), address(msg.sender), address(lpToken), _amount);

        // get liquidity
        (uint256 amountIn0, uint256 amountIn1) = lpToken.burn(address(this));

        _addOurLiquidity(
            address(token0),
            address(token1),
            amountIn0,
            amountIn1
        );
    }

    function _addOurLiquidity(
        address _token0,
        address _token1,
        uint256 _amount0,
        uint256 _amount1
    ) internal {
        TransferHelper.safeApprove(_token0, address(ourRouter), _amount0);
        TransferHelper.safeApprove(_token1, address(ourRouter), _amount1);

        (uint256 amountOut0, uint256 amountOut1, uint256 liquidityOut) =
            ourRouter.addLiquidity(                  
                address(_token0),
                address(_token1),
                _amount0,
                _amount1,
                0,
                0,
                defRef
            );

        (,,address _pair) = ourRouter.getReserves(IERC20(_token0), IERC20(_token1));

        TransferHelper.safeTransfer(
            _pair,
            msg.sender,
            liquidityOut
        );

        // return the change
        if (amountOut0 < _amount0) { // consumed less tokens 0 than given
            TransferHelper.safeTransfer(
                _token0,
                address(msg.sender),
                _amount0.sub(amountOut0)
            );
        }

        if (amountOut1 < _amount1) { // consumed less tokens 1 than given
            TransferHelper.safeTransfer(
                _token1,
                address(msg.sender),
                _amount1.sub(amountOut1)
            );
        }
    }

    /**
     * @dev Actual function that converts third-party Mooniswap liquidity (represented by LP-tokens) to our own LP-tokens
     */
    function _depositMooniswap(uint256 _pid, uint256 _amount) internal {
        IMooniswap lpToken = IMooniswap(lpTokensInfo[_pid].lpToken);
        IERC20[] memory t = lpToken.getTokens();

        // check pair existance
        IERC20 token0 = IERC20(t[0]);
        IERC20 token1 = IERC20(t[1]);

        // transfer to us
	TransferHelper.safeTransferFrom(address(lpToken), address(msg.sender), address(this), _amount);

        uint256 amountBefore0 = token0.balanceOf(address(this));
        uint256 amountBefore1 = token1.balanceOf(address(this));

        uint256[] memory minVals = new uint256[](2);

        lpToken.withdraw(_amount, minVals);

        // get liquidity
        uint256 amount0 = token0.balanceOf(address(this)).sub(amountBefore0);
        uint256 amount1 = token1.balanceOf(address(this)).sub(amountBefore1);

        _addOurLiquidity(address(token0), address(token1), amount0, amount1);
    }

    /**
    @dev Function check for LP token pair availability. Return _pid or 0 if none exists
  */
    function isPairAvailable(address _token0, address _token1)
        public
        view
        returns (uint16)
    {
        require(_token0 != address(0));
        require(_token1 != address(0));

        for (uint16 i = 0; i < lpTokensInfo.length; i++) {
            address t0 = address(0);
            address t1 = address(0);

            if (lpTokensInfo[i].tokenType == 0) {
              IUniswapV2Pair lpt = IUniswapV2Pair(lpTokensInfo[i].lpToken);
              t0 = lpt.token0();
              t1 = lpt.token1();
            } else if (lpTokensInfo[i].tokenType == 1) {
              IMooniswap lpToken = IMooniswap(lpTokensInfo[i].lpToken);

              IERC20[] memory t = lpToken.getTokens();

              t0 = address(t[0]);
              t1 = address(t[1]);
            } else {
                return 0;
            }

            if (
                (t0 == _token0 && t1 == _token1) ||
                (t1 == _token0 && t0 == _token1)
            ) {
                return i;
            }
        }
        return 0;
    }

    /**
     * @dev Owner can transfer out any accidentally sent ERC20 tokens
     */
    function transferAnyERC20Token(
        address tokenAddress,
        address beneficiary,
        uint256 tokens
    ) external onlyAdmin returns (bool success) {
        require(tokenAddress != address(0), "Token address cannot be 0");

        return IERC20(tokenAddress).transfer(beneficiary, tokens);
    }
}
