// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.6.2;

interface IEmiVoting {
    event VotingCreated(uint256 indexed hash, uint256 endTime);
    event VotingFinished(uint256 indexed hash, uint256 result);

    function getVoting(uint256 _hash)
        external
        view
        returns (
            address,
            address,
            uint256,
            uint256
        );

    function newUpgradeVoting(
        address _oldContract,
        address _newContract,
        uint256 _votingEndTime,
        uint256 _hash
    ) external returns (uint256);

    function getVotingResult(uint256 _hash) external view returns (address);

    function calcVotingResult(uint256 _hash) external;
}
