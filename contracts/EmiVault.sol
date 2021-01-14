// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.6.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./libraries/Priviledgeable.sol";

contract EmiVault is Initializable, Priviledgeable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

 string public codeVersion = "EmiVault v1.0-49-g086af6c";
    // !!!In updates to contracts set new variables strictly below this line!!!
    //-----------------------------------------------------------------------------------

    address public constant ORACLE = 0xe20FB4e76aAEa3983a82ECb9305b67bE23D890e3;
    mapping(address => uint256) public walletNonce;

    function initialize() public initializer {
        _addAdmin(msg.sender);
    }

    /*************************************************************
     *  SIGNED functions
     **************************************************************/
    function _splitSignature(bytes memory sig)
        internal
        pure
        returns (
            uint8,
            bytes32,
            bytes32
        )
    {
        require(sig.length == 65, "Incorrect signature length");

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            //first 32 bytes, after the length prefix
            r := mload(add(sig, 0x20))
            //next 32 bytes
            s := mload(add(sig, 0x40))
            //final byte, first of next 32 bytes
            v := byte(0, mload(add(sig, 0x60)))
        }

        return (v, r, s);
    }

    function _recoverSigner(bytes32 message, bytes memory sig)
        internal
        pure
        returns (address)
    {
        uint8 v;
        bytes32 r;
        bytes32 s;

        (v, r, s) = _splitSignature(sig);

        return ecrecover(message, v, r, s);
    }

    function _prefixed(bytes32 hash) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)
            );
    }

    function getWalletNonce() public view returns (uint256) {
        return walletNonce[msg.sender];
    }

    /**
     * withdrawTokens - oracle signed function allow user to withdraw dividend tokens
     * @param tokenAddresses - array of token addresses to withdraw
     * @param amounts - array of token amounts to withdraw
     * @param recipient - user's wallet for receiving tokens
     * @param nonce - user's withdraw request number, for security purpose
     * @param sig - oracle signature, oracle allowance for user to withdraw tokens
     */

    function withdrawTokens(
        address[] memory tokenAddresses,
        uint256[] memory amounts,
        address recipient,
        uint256 nonce,
        bytes memory sig
    ) public {
        require(recipient == msg.sender, "EmiVault:sender");
        require(
            tokenAddresses.length > 0 &&
                tokenAddresses.length == amounts.length &&
                tokenAddresses.length <= 60,
            "EmiVault:length"
        );
        // check sign
        bytes32 message =
            _prefixed(
                keccak256(
                    abi.encodePacked(
                        tokenAddresses,
                        amounts,
                        recipient,
                        nonce,
                        this
                    )
                )
            );

        require(
            _recoverSigner(message, sig) == ORACLE &&
                walletNonce[msg.sender] < nonce,
            "EmiVault:sign"
        );

        walletNonce[msg.sender] = nonce;

        for (uint256 index = 0; index < tokenAddresses.length; index++) {
            IERC20(tokenAddresses[index]).transfer(recipient, amounts[index]);
        }
    }
}
