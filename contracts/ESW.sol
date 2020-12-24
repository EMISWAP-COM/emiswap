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
 string public codeVersion = "ESW v1.0-26-g7562cb8";
  uint256 constant public MAXIMUM_SUPPLY = 200_000_000e18; 

  mapping (address => uint256) public walletNonce;
  address public oracle;
  
  modifier mintGranted() {
    require(_mintGranted[msg.sender], "ESW mint: caller is not alowed!");
    _;
  }

  function initialize() public virtual {
    _initialize("EmiDAO Token", "ESW", 18);
    _addAdmin(msg.sender);
  }

  function updateTokenName(string memory newName, string memory newSymbol) public onlyAdmin {
    _updateTokenName(newName, newSymbol);
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

  function burn(address account, uint256 amount) public {
    super._burn(account, amount);
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
  * mint only claimed from vesting for the recipient 
  * 
  *************************************************************/
  function mintClaimed(address recipient, uint256 amount) external mintGranted() {
    _mint(recipient, amount);
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

  /*************************************************************
  *  SIGNED functions
  **************************************************************/
  function _splitSignature(bytes memory sig) internal pure returns (uint8, bytes32, bytes32) {
    require (sig.length == 65, "Incorrect signature length");

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
    
  function _recoverSigner(bytes32 message, bytes memory sig) internal pure returns (address) {
    uint8 v;
    bytes32 r;
    bytes32 s;

    (v, r, s) = _splitSignature(sig);

    return ecrecover(message, v, r, s);
  }
    
  function _prefixed(bytes32 hash) internal pure returns (bytes32) {
    return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
  }

  function getWalletNonce() public view returns(uint256) {
    return walletNonce[msg.sender];
  }

  function setOracle(address _oracle) public onlyAdmin {
    require(_oracle != address(0), "oracleSign: bad address");
    oracle = _oracle;
  }

  function mintSigned(address recipient, uint256 amount, uint256 nonce, bytes memory sig) public {
    // check sign    
    bytes32 message = _prefixed(keccak256(abi.encodePacked(
      recipient, 
      amount,
      nonce,
      this)));
      
    require(_recoverSigner(message, sig) == oracle && walletNonce[msg.sender] < nonce, "CrowdSale:sign incorrect");

    walletNonce[msg.sender] = nonce;

    super._mint(recipient, amount);
  }

  function getOracle()
    public
    view
    returns(address)
  {
    return(oracle);
  }
}