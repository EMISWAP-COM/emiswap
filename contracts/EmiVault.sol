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
      
 string public codeVersion = "EmiVault v1.0-26-g7562cb8";
  // !!!In updates to contracts set new variables strictly below this line!!!
  //----------------------------------------------------------------------------------- 

  function initialize()
    public
    initializer
  {
    _addAdmin(msg.sender);    
  }
}