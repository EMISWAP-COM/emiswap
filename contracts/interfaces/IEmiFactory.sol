// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IEmiswap.sol";

interface IEmiFactory {
    event Deployed(
        address indexed emiswap,
        address indexed token1,
        address indexed token2
    );

    event adminGranted(address indexed admin, bool isGranted);

    function pools(IERC20, IERC20) external view returns (IEmiswap);

    function getAllPools() external view returns (IEmiswap[] memory);
}
