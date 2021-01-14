// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.6.0;

/**
 * @dev Interface of the DAO token.
 */
interface IESW {
    function name() external returns (string memory);

    function balanceOf(address account) external view returns (uint256);

    function symbol() external returns (string memory);

    function decimals() external returns (uint8);

    function initialSupply() external returns (uint256);

    function burn(address account, uint256 amount) external;

    function mintClaimed(address recipient, uint256 amount) external;

    function getPriorVotes(address account, uint256 blockNumber)
        external
        view
        returns (uint96);
}
