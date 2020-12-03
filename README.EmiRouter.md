# EmiRouter

## getLiquidity

```solidity
/**
* @param tokenA address of first token in pair
* @param tokenB address of second token in pair  
* @return LP balance
*/
function getLiquidity(
    address tokenA,
    address tokenB
) 
external 
view 
returns (uint256)
```

## addLiquidity

```solidity
/**
* @param tokenA address of first token in pair
* @param tokenB address of second token in pair  
* @param amountADesired desired amount of first token
* @param amountBDesired desired amount of second token
* @param amountAMin minimum amount of first token
* @param amountBMin minimum amount of second token
* @return amountA added liquidity of first token
* @return amountB added liquidity of second token
* @return liquidity
*/

function addLiquidity (
    address tokenA,
    address tokenB,
    uint256 amountADesired,
    uint256 amountBDesired,
    uint256 amountAMin,
    uint256 amountBMin
) 
    external
    returns (uint256 amountA, uint256 amountB, uint256 liquidity)
```

## addLiquidityETH

```solidity
/**
* @param token address of token
* @param amountTokenDesired desired amount of token
* @param amountTokenMin minimum amount of token
* @param amountETHMin minimum amount of ETH
* @return amountToken added liquidity of token
* @return amountETH added liquidity of ETH
* @return liquidity
*/

function addLiquidityETH (
    address token,
    uint amountTokenDesired,
    uint amountTokenMin,
    uint amountETHMin
) 
    external
    payable
returns (uint amountToken, uint amountETH, uint liquidity)
```

## removeLiquidity

```solidity
/*
* @param tokenA address of first token in pair
* @param tokenB address of second token in pair  
* @param liquidity LP token
* @param amountAMin minimum amount of first token
* @param amountBMin minimum amount of second token
*/
function removeLiquidity (
    address tokenA,
    address tokenB,
    uint liquidity,
    uint amountAMin,
    uint amountBMin
)
```

## removeLiquidityETH

```solidity
/**
* @param token address of token
* @param liquidity LP token amount
* @param amountTokenMin minimum amount of token
* @param amountETHMin minimum amount of ETH
*/
function removeLiquidityETH (
    address token,
    uint256 liquidity,
    uint256 amountTokenMin,
    uint256 amountETHMin
)
```

## swapExactTokensForTokens

```solidity
/**
* @param amountIn exact in value of source token
* @param amountOutMin minimum amount value of result token
* @param path array of token addresses, represent the path for swaps
* @param to swap result to account address
* @param ref ref account address
* @return amounts result amount
*/

function swapExactTokensForTokens (
    uint256 amountIn,
    uint256 amountOutMin,
    address[] calldata path,
    address[] calldata pathDAI
)
  external
returns (uint256[] memory amounts) 
```

## swapTokensForExactTokens

```solidity
/**
* @param amountOut exact in value of result token
* @param amountInMax maximum amount value of source token
* @param path array of token addresses, represent the path for swaps
* @param pathDAI array of token addresses, last element is DAI, represent the path for swaps result token to DAI, place [] if no
* @return amounts result amount values
*/

function swapTokensForExactTokens (
    uint256 amountOut,
    uint256 amountInMax,
    address[] calldata path,
    address[] calldata pathDAI
) 
  external
returns (uint256[] memory amounts)
```

## swapExactETHForTokens

```solidity
/**
* @param amountOutMin minimum amount value of result token
* @param path array of token addresses, represent the path for swaps
* @param pathDAI array of token addresses, last element is DAI, represent the path for swaps result token to DAI, place [] if no
* @return amounts result token amount values
*/
  
function swapExactETHForTokens (
    uint256 amountOutMin, 
    address[] calldata path,
    address[] calldata pathDAI
)
    external
    payable
returns (uint[] memory amounts)
```

## swapTokensForExactETH

```solidity
/**
* @param amountOut amount value of result ETH
* @param amountInMax maximum amount of source token
* @param path array of token addresses, represent the path for swaps, (WETH for ETH)
* @param pathDAI array of token addresses, last element is DAI, represent the path for swaps result token to DAI, place [] if no
* @return amounts result token amount values
*/

function swapTokensForExactETH (
    uint256 amountOut,
    uint256 amountInMax,
    address[] calldata path,
    address[] calldata pathDAI
)
    external
returns (uint256[] memory amounts)
```
## swapExactTokensForETH

```solidity
/**
* @param amountIn amount value of source token
* @param amountOutMin minimum amount of result ETH
* @param path array of token addresses, represent the path for swaps, (WETH for ETH)
* @param pathDAI array of token addresses, last element is DAI, represent the path for swaps result token to DAI, place [] if no
* @return amounts result token amount values
*/
  
function swapExactTokensForETH (
    uint256 amountIn,
    uint256 amountOutMin,
    address[] calldata path, 
    address[] calldata pathDAI
)
    external
returns (uint[] memory amounts)
```

## swapETHForExactTokens

```solidity
/**
  * @param amountOut amount of result tokens
  * @param path array of token addresses, represent the path for swaps, (WETH for ETH)
  * @param pathDAI array of token addresses, last element is DAI, represent the path for swaps result token to DAI, place [] if no
  * @return amounts result token amount values
  */
  
function swapETHForExactTokens (
    uint256 amountOut, 
    address[] calldata path, 
    address[] calldata pathDAI 
)
    external
    payable
returns (uint256[] memory amounts)
```

## LIBRARY FUNCTIONS

## getAmountsOut

```solidity
/**
* @param amountIn amount of source token
* @param path array of token addresses, represent the path for swaps, (WETH for ETH)
* @return amounts result token amount values
*/
function getAmountsOut(uint amountIn, address[] memory path)
    public
    view
returns (uint[] memory amounts)
```

## getAmountsIn

```solidity
/**
* @param amountOut amount of result token
* @param path array of token addresses, represent the path for swaps, (WETH for ETH)
* @return amounts result token amount values
*/
function getAmountsIn(uint amountOut, address[] memory path)
    public
    view
returns (uint[] memory amounts)
```