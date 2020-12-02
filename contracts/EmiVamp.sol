// SPDX-License-Identifier: MIT
pragma solidity ^0.6.2;

import "@openzeppelin/contracts/proxy/Initializable.sol";
import "./uniswapv2/interfaces/IUniswapV2Pair.sol";
import "./uniswapv2/interfaces/IUniswapV2Factory.sol";
import "./libraries/Priviledgeable.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./interfaces/IEmiRouter.sol";

/**
 * @dev Contract to convert liquidity from other market makers to our Uniswap pairs.
 */
contract EmiVamp is Initializable, Priviledgeable {
    using SafeERC20 for IERC20;

    IERC20 [] private _allowedTokens; // List of tokens that we accept

    // Info of each third-party lp-token.
    IUniswapV2Pair [] public lpTokensInfo;
 string public codeVersion = "EmiVamp v1.0-11-g02dccfa";
    IEmiRouter public ourRouter;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);

  // !!!In updates to contracts set new variables strictly below this line!!!
  //-----------------------------------------------------------------------------------

  /**
   * @dev Implementation of {UpgradeableProxy} type of constructors
   */
  function initialize(address[] calldata _lptokens, address _ourrouter) public onlyAdmin initializer
  {
    require(_lptokens.length > 0);
    require(_ourrouter != address(0));

    for (uint i = 0; i < _lptokens.length; i++) {
      lpTokensInfo.push(IUniswapV2Pair(_lptokens[i]));
    }
    ourRouter = IEmiRouter(_ourrouter);
    _addAdmin(msg.sender);
  }

  /**
   * @dev Returns length of allowed tokens private array
   */
  function getAllowedTokensLength() external view onlyAdmin returns (uint)
  {
    return _allowedTokens.length;
  }

  function lpTokensInfoLength() external view returns (uint)
  {
    return lpTokensInfo.length;
  }

  /**
   * @dev Returns allowed token address stored under specified index in array
   */
  function getAllowedToken(uint idx) external view onlyAdmin returns (address)
  {
    require(idx < _allowedTokens.length);
    return address(_allowedTokens[idx]);
  }

  /**
   * @dev Adds new entry to the list of allowed tokens (if it is not exist yet)
   */  
  function addAllowedToken(address _token) external onlyAdmin
  {
    require(_token != address(0));

    for (uint i = 0; i < _allowedTokens.length; i++) {
      if (address(_allowedTokens[i])==_token) {
        return;
      }
    }
    _allowedTokens.push(IERC20(_token));
  }

  /**
   * @dev Adds new entry to the list of convertible LP-tokens
   */  
  function addLPToken(address _token) external onlyAdmin returns (uint)
  {
    require(_token != address(0));

    for (uint i = 0; i < lpTokensInfo.length; i++) {
      if (address(lpTokensInfo[i])==_token) {
        return i;
      }
    }
    lpTokensInfo.push(IUniswapV2Pair(_token));
    return lpTokensInfo.length;
  }

    // Deposit LP tokens to us
  /**
   * @dev Main function that converts third-party liquidity (represented by LP-tokens) to our own LP-tokens
   */  
    function deposit(uint256 _pid, uint256 _amount) public {
        require(_pid < lpTokensInfo.length);
        IUniswapV2Pair lpToken = lpTokensInfo[_pid];

	// check pair existance
        IERC20 token0 = IERC20(lpToken.token0());
        IERC20 token1 = IERC20(lpToken.token1());

        // transfer to us
        lpToken.transferFrom(address(msg.sender), address(lpToken), _amount);

	// get liquidity
        (uint amountIn0, uint amountIn1) = lpToken.burn(address(this));

        (uint amountOut0, uint amountOut1, ) = ourRouter.addLiquidity(address(token0), address(token1), amountIn0, amountIn1, amountIn0.div(2), amountIn1.div(2));

        // return the change
        if (amountOut0 - amountIn0 > 0) {
          token0.safeTransfer(address(msg.sender), amountOut0 - amountIn0);
        }

        if (amountOut1 - amountIn1 > 0) {
          token1.safeTransfer(address(msg.sender), amountOut1 - amountIn1);
        }
        emit Deposit(msg.sender, _pid, _amount);
    }

   /**
    * @dev Owner can transfer out any accidentally sent ERC20 tokens
    */
    function transferAnyERC20Token(address tokenAddress, address beneficiary, uint tokens) external onlyAdmin returns (bool success) {
        require(tokenAddress!=address(0), "Token address cannot be 0");

        return IERC20(tokenAddress).transfer(beneficiary, tokens);
    }
}