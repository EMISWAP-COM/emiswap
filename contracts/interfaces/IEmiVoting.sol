// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.6.2;

interface IEmiVoting {
  event VotingCreated(uint indexed hash, uint endTime);
  event VotingFinished(uint indexed hash, uint result);

  function getVoting(uint _hash) external view returns (address, address, uint, uint);
  function newUpgradeVoting(address _oldContract, address _newContract, uint _votingEndTime, uint _hash) external returns (uint);
  function getVotingResult(uint _hash) external view returns (address);
  function calcVotingResult(uint _hash) external;
}