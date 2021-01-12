// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.6.2;

/*************************************************************************
 *    EmiVesting inerface
 *
 ************************************************************************/
interface IEmiVesting {
    function freeze(
        address beneficiary,
        uint256 tokens,
        uint256 category
    ) external;

    function freezeVirtual(
        address beneficiary,
        uint256 tokens,
        uint256 category
    ) external;

    function freezeVirtualWithCrowdsale(
        address beneficiary,
        uint32 sinceDate,
        uint256 tokens,
        uint256 category
    ) external;

    function balanceOf(address beneficiary) external view returns (uint256);

    function getCrowdsaleLimit() external view returns (uint256);
}
