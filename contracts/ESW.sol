// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.2;

import "@openzeppelin/contracts/proxy/Initializable.sol";
import "./interfaces/IEmiVesting.sol";
import "./libraries/Priviledgeable.sol";
import "./libraries/ProxiedERC20.sol";

contract ESW is ProxiedERC20, Initializable, Priviledgeable {
  address public dividendToken;
  address public vesting;
  uint256 internal _initialSupply;
  mapping(address => uint256) internal _mintLimit;
  mapping(address => bool) internal _mintGranted;

  // !!!In updates to contracts set new variables strictly below this line!!!
  //-----------------------------------------------------------------------------------
 string public codeVersion = "ESW v1.0-20-ga130a08";
 uint256 constant public MAXIMUM_SUPPLY = 200_000_000e18;

  modifier mintGranted() {
    require(_mintGranted[msg.sender], "ESWc mint: caller is not alowed!");
    _;
  }

  function initialize() public virtual {
    _initialize("EmiDAO Token crowdsale", "ESWc", 18);
    _addAdmin(msg.sender);
  }

  function grantMint(address _newIssuer) public onlyAdmin {
    require(_newIssuer != address(0), "ESW: Zero address not allowed");
    _mintGranted[_newIssuer] = true;
  }

  function revokeMint(address _revokeIssuer) public onlyAdmin {
    require(_revokeIssuer != address(0), "ESW: Zero address not allowed");
    if (_mintGranted[_revokeIssuer]) {
      _mintGranted[_revokeIssuer] = false;
    }
  }

  function setVesting(address _vesting) public onlyAdmin {
    require(_vesting != address(0), "Set vesting contract address");
    vesting = _vesting;
    grantMint(_vesting);
  }

  function initialSupply() public view returns (uint256) {
    return _initialSupply;
  }

  function balanceOf2(address account) public view returns (uint256) {
    return super.balanceOf(account).add(IEmiVesting(vesting).balanceOf(account));
  }

  function balanceOf(address account) public override view returns (uint256) {
    return super.balanceOf(account);
  }  

  function setDividendToken(address _dividendToken) onlyAdmin public {
    dividendToken = _dividendToken;
  }

  function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
    super.transfer(recipient, amount);
    return true;
  }

  function transferFrom(address sender, address recipient, uint256 amount) public virtual override returns (bool) {
    super.transferFrom(sender, recipient, amount);
    return true;
  }

  function getMintLimit(address account) public view onlyAdmin returns(uint256) {
    return _mintLimit[account];
  }

  /******************************************************************
  * set mint limit for exact contract wallets  
  *******************************************************************/
  function setMintLimit(address account, uint256 amount) public onlyAdmin {
    _mintLimit[account] = amount;
    if (amount > 0) {
      grantMint(account);
    } else {
      revokeMint(account);
    }
  }

  function _mint(address recipient, uint256 amount) override internal {
    require(totalSupply().add(amount) <= MAXIMUM_SUPPLY, "ESW: Maximum supply exceeded");
    _mintLimit[msg.sender] = _mintLimit[msg.sender].sub(amount);
    super._mint(recipient, amount);
  }

  /************************************************************
  * mint with start vesting for the recipient, 
  * 
  *************************************************************/
  function mintAndFreeze(address recipient, uint256 amount, uint256 category) external mintGranted() {
    IEmiVesting(vesting).freeze(recipient, amount, category);
    _mint(vesting, amount);
  }

  /************************************************************
  * mint virtual with start vesting for the recipient, 
  * 
  *************************************************************/
  function mintVirtualAndFreeze(address recipient, uint256 amount, uint256 category) external mintGranted() {
    IEmiVesting(vesting).freezeVirtual(recipient, amount, category);
  }

  /************************************************************
  * mint virtual with start vesting for the presale tokens
  * 
  *************************************************************/
  function mintVirtualAndFreezePresale(address recipient, uint32 sinceDate, uint256 amount, uint256 category) external mintGranted() {
    IEmiVesting(vesting).freezeVirtualWithCrowdsale(recipient, sinceDate, amount, category);
  }  

  /*
  * Get currentCrowdsaleLimit
  */
  function currentCrowdsaleLimit() external view returns( uint256 ) {
    return( IEmiVesting(vesting).getCrowdsaleLimit() );
  }
}