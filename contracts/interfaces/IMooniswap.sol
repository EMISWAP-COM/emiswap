// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IMooniswap {
    function getTokens() external view returns (IERC20[] memory);

    function withdraw(uint256 amount, uint256[] calldata minReturns) external;
}
