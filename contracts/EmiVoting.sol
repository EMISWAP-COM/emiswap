// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.6.2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "./libraries/Priviledgeable.sol";
import "./interfaces/IEmiVoting.sol";

contract EmiVoting is IEmiVoting, Initializable, Priviledgeable {
  using SafeMath for uint256;
  using Address for address;

  struct VotingRecord {
    address oldContract;
    address newContract;
    uint endTime;
    uint voteResult;
  }

  mapping(uint => VotingRecord) private _votingList;
  uint[] private _votingHash;
 string public codeVersion = "EmiVoting v1.0-27-g6e09c30";

    function initialize(address _admin) public initializer
    {
      _addAdmin(msg.sender);
      _addAdmin(_admin);
    }

    //-----------------------------------------------------------------------------------
    // Observers
    //-----------------------------------------------------------------------------------
    // Return unlock date and amount of given lock 
    function getVoting(uint _hash) external override view returns (address, address, uint, uint)
    {
      return (_votingList[_hash].oldContract, _votingList[_hash].newContract, _votingList[_hash].endTime, _votingList[_hash].voteResult);
    }

    function getVotingHash(uint8 idx) external onlyAdmin view returns (uint)
    {
      require(idx < _votingHash.length, "Voting index is out of range");
      return _votingHash[idx];
    }

    function getVotingLen() external onlyAdmin view returns (uint)
    {
      return _votingHash.length;
    }

  // starts new voting for upgrading contract
  // return 
  function newUpgradeVoting(address _oldContract, address _newContract, uint _votingEndTime, uint _hash) external override onlyAdmin returns (uint) {
    require(_oldContract!=address(0), "Old contract cannot be null");
    require(_newContract!=address(0), "New contract cannot be null");
    require(_votingEndTime > block.timestamp, "Voting end time is in the past");
    require(_hash!=0, "Hash cannot be 0");

    _votingList[_hash].oldContract = _oldContract;
    _votingList[_hash].newContract = _newContract;
    _votingList[_hash].endTime = _votingEndTime;
    _votingList[_hash].voteResult = 0;
    _votingHash.push(_hash);

    emit VotingCreated(_hash, _votingEndTime);

    return _hash;
  }

  // returns address if voting succeeded or 0 othervise
  function getVotingResult(uint _hash) external view override returns (address) {
    VotingRecord memory v = _votingList[_hash];

    if (v.endTime > block.timestamp) { // voting is not finished yet
      return address(0);
    } else {
      if (v.voteResult == 2) { // voting succeeded
        return v.newContract;
      } else {
        return address(0);
      }
    }
  }

  // calculates and returns 0 if no results, 1 if voting negative, 2 if voting positive
  function calcVotingResult(uint _hash) external override {
    require(_votingList[_hash].endTime != 0, "Wrong hash value");
    VotingRecord memory vr = _votingList[_hash];
    
    if (vr.voteResult == 0 && vr.endTime <= block.timestamp) {
      _votingList[_hash].voteResult = 2; // always positive
      emit VotingFinished(_hash, 2);
    }
  }
}