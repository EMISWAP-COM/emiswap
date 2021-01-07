// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.6.2;

/*************************************************************************
 *    EmiVesting inerface
 *
 ************************************************************************/
interface IEmiVesting {
  function freeze(address beneficiary, uint tokens, uint category) external;
  function freezeVirtual(address beneficiary, uint tokens, uint category) external;
  function freezeVirtual2(address beneficiary, uint32 sinceDate, uint tokens, uint category) external;
  function balanceOf(address beneficiary) external view returns (uint);
  function getCrowdsaleLimit() external view returns (uint);
}