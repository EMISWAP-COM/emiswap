// SPDX-License-Identifier: MIT
pragma solidity ^0.6.2;

import "@openzeppelin/contracts/proxy/Initializable.sol";
import "./uniswapv2/interfaces/IUniswapV2Pair.sol";
import "./uniswapv2/interfaces/IUniswapV2Factory.sol";
import "./libraries/Priviledgeable.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./interfaces/IEmiRouter.sol";
import "./interfaces/IEmiswap.sol";
import "./libraries/TransferHelper.sol";

/**
 * @dev Contract to convert liquidity from other market makers (Uniswap/Mooniswap) to our pairs.
 */
contract EmiVamp is Initializable, Priviledgeable {
    using SafeERC20 for IERC20;

    struct LPTokenInfo {
      address lpToken;
      uint16  tokenType; // Token type: 0 - uniswap (default), 1 - mooniswap
    }

    IERC20 [] public allowedTokens; // List of tokens that we accept

    // Info of each third-party lp-token.
    LPTokenInfo [] public lpTokensInfo;

 string public codeVersion = "EmiVamp v1.0-20-g84634f1";
    IEmiRouter public ourRouter;

    event Deposit(address indexed user, address indexed token, uint256 amount);

  // !!!In updates to contracts set new variables strictly below this line!!!
  //-----------------------------------------------------------------------------------

  /**
   * @dev Implementation of {UpgradeableProxy} type of constructors
   */
  function initialize(address[] calldata _lptokens, uint8[] calldata _types, address _ourrouter) public onlyAdmin initializer
  {
    require(_lptokens.length > 0);
    require(_lptokens.length == _types.length);
    require(_ourrouter != address(0));

    for (uint i = 0; i < _lptokens.length; i++) {
      lpTokensInfo.push(LPTokenInfo({lpToken: _lptokens[i], tokenType: _types[i]}));
    }
    ourRouter = IEmiRouter(_ourrouter);
    _addAdmin(msg.sender);
  }

  /**
   * @dev Returns length of allowed tokens private array
   */
  function getAllowedTokensLength() external view returns (uint)
  {
    return allowedTokens.length;
  }

  function lpTokensInfoLength() external view returns (uint)
  {
    return lpTokensInfo.length;
  }

  /**
   * @dev Adds new entry to the list of allowed tokens (if it is not exist yet)
   */  
  function addAllowedToken(address _token) external onlyAdmin
  {
    require(_token != address(0));

    for (uint i = 0; i < allowedTokens.length; i++) {
      if (address(allowedTokens[i])==_token) {
        return;
      }
    }
    allowedTokens.push(IERC20(_token));
  }

  /**
   * @dev Adds new entry to the list of convertible LP-tokens
   */  
  function addLPToken(address _token, uint16 _tokenType) external onlyAdmin returns (uint)
  {
    require(_token != address(0));
    require(_tokenType < 2);

    for (uint i = 0; i < lpTokensInfo.length; i++) {
      if (lpTokensInfo[i].lpToken==_token) {
        return i;
      }
    }
    lpTokensInfo.push(LPTokenInfo({lpToken: _token, tokenType: _tokenType}));
    return lpTokensInfo.length;
  }

    // Deposit LP tokens to us
  /**
   * @dev Main function that converts third-party liquidity (represented by LP-tokens) to our own LP-tokens
   */  
    function deposit(uint256 _pid, uint256 _amount) public
  {
        require(_pid < lpTokensInfo.length);

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
        lpToken.transferFrom(address(msg.sender), address(lpToken), _amount);

	// get liquidity
        (uint amountIn0, uint amountIn1) = lpToken.burn(address(this));

        _addOurLiquidity(address(token0), address(token1), amountIn0, amountIn1);
    }

   function _addOurLiquidity(address _token0, address _token1, uint _amount0, uint _amount1) internal
   {
        (uint amountOut0, uint amountOut1, ) = ourRouter.addLiquidity(
          address(_token0), address(_token1), _amount0, _amount1, 0, 0
        );

        // return the change
        if (amountOut0 - _amount0 > 0) {
          TransferHelper.safeTransfer(_token0, address(msg.sender), amountOut0 - _amount0);
        }

        if (amountOut1 - _amount1 > 0) {
          TransferHelper.safeTransfer(_token1, address(msg.sender), amountOut1 - _amount1);
        }
   }

  /**
   * @dev Actual function that converts third-party Mooniswap liquidity (represented by LP-tokens) to our own LP-tokens
   */  
    function _depositMooniswap(uint256 _pid, uint256 _amount) internal {
        IEmiswap lpToken = IEmiswap(lpTokensInfo[_pid].lpToken);

	// check pair existance
        IERC20 token0 = IERC20(lpToken.tokens(0));
        IERC20 token1 = IERC20(lpToken.tokens(1));

        // transfer to us
        uint amountBefore0 = token0.balanceOf(msg.sender);
        uint amountBefore1 = token1.balanceOf(msg.sender);

        uint [] memory minVals = new uint[](2);

        lpToken.withdraw(_amount, minVals);

	// get liquidity
        uint amount0 = token0.balanceOf(msg.sender) - amountBefore0;
        uint amount1 = token1.balanceOf(msg.sender) - amountBefore1;

        _addOurLiquidity(address(token0), address(token1), amount0, amount1);
    }

  /**
    @dev Function check for LP token pair availability. Return _pid or 0 if none exists
  */
   function isPairAvailable(address _token0, address _token1) public view returns (uint16)
   {
     require(_token0 != address(0));
     require(_token1 != address(0));

     for (uint16 i = 0; i < lpTokensInfo.length; i++) {
       IUniswapV2Pair lpt = IUniswapV2Pair(lpTokensInfo[i].lpToken);
       address t0 = lpt.token0();
       address t1 = lpt.token1();

       if ((t0 ==_token0 && t1 == _token1) || (t1 ==_token0 && t0 == _token1)) {
         return i;
       }
     }
     return 0;
   }

   /**
    * @dev Owner can transfer out any accidentally sent ERC20 tokens
    */
    function transferAnyERC20Token(address tokenAddress, address beneficiary, uint tokens) external onlyAdmin returns (bool success) {
        require(tokenAddress!=address(0), "Token address cannot be 0");

        return IERC20(tokenAddress).transfer(beneficiary, tokens);
    }
}