// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.6.0;

/**
 * @dev Interface of the DAO token.
 */
interface IESW {
  function name() external returns (string memory);
  function symbol() external returns (string memory);
  function decimals() external returns (uint8);  
  function initialSupply() external returns (uint256);
  function currentCrowdsaleLimit() external view returns(uint256);
  function rawBalanceOf(address account) external view returns (uint256);
  
  function setVesting(address _vesting) external;
}