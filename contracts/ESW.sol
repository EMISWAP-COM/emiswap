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
 string public codeVersion = "ESW v1.0-56-ge9510cb";
    uint256 public constant MAXIMUM_SUPPLY = 200_000_000e18;
    bool public isFirstMinter = true;
    address public constant firstMinter =
        0xe20FB4e76aAEa3983a82ECb9305b67bE23D890e3;
    address public constant secondMinter =
        0xA211F095fECf5855dA3145f63F6256362E30783D;
    uint256 public minterChangeBlock = 0;

    event minterSwitch(address newMinter, uint256 afterBlock);

    mapping(address => uint256) public walletNonce;
    address public oracle;

    modifier mintGranted() {
        require(_mintGranted[msg.sender], "ESW mint: caller is not alowed!");
        require(
            (// first minter address after minterChangeBlock, second before minterChangeBlock
            (isFirstMinter &&
                (
                    block.number >= minterChangeBlock
                        ? msg.sender == firstMinter
                        : msg.sender == secondMinter
                )) ||
                // second minter address after minterChangeBlock, first before minterChangeBlock
                (!isFirstMinter &&
                    (
                        block.number >= minterChangeBlock
                            ? msg.sender == secondMinter
                            : msg.sender == firstMinter
                    ))),
            "ESW mint: minter is not alowed!"
        );
        _;
    }

    function initialize() public virtual {
        _initialize("EmiDAO Token", "ESW", 18);
        _addAdmin(msg.sender);
    }

    function updateTokenName(string memory newName, string memory newSymbol)
        public
        onlyAdmin
    {
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

    /**
     * switchMinter - function for switching between two registered minters
     * @param isSetFirst - true - set first / false - set second minter
     */

    function switchMinter(bool isSetFirst) public onlyAdmin {
        isFirstMinter = isSetFirst;
        minterChangeBlock = block.number + 35; /* 6504 ~24 hours*/
        emit minterSwitch(
            (isSetFirst ? firstMinter : secondMinter),
            minterChangeBlock
        );
    }

    function initialSupply() public view returns (uint256) {
        return _initialSupply;
    }

    function balanceOf(address account) public view override returns (uint256) {
        return super.balanceOf(account);
    }

    function transfer(address recipient, uint256 amount)
        public
        virtual
        override
        returns (bool)
    {
        super.transfer(recipient, amount);
        return true;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public virtual override returns (bool) {
        super.transferFrom(sender, recipient, amount);
        return true;
    }

    /**
     * getMintLimit - read mint limit for wallets
     * @param account - wallet address
     * @return - mintlimit for requested wallet
     */

    function getMintLimit(address account)
        public
        view
        onlyAdmin
        returns (uint256)
    {
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

    function _mint(address recipient, uint256 amount) internal override {
        require(
            totalSupply().add(amount) <= MAXIMUM_SUPPLY,
            "ESW: Maximum supply exceeded"
        );
        _mintLimit[msg.sender] = _mintLimit[msg.sender].sub(amount);
        super._mint(recipient, amount);
    }

    function burn(address account, uint256 amount) public {
        super._burn(account, amount);
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
     * mintSigned - oracle signed function allow user to mint ESW tokens
     * @param recipient - user's wallet for receiving tokens
     * @param amount - amount to mint
     * @param nonce - user's mint request number, for security purpose
     * @param sig - oracle signature, oracle allowance for user to mint tokens
     */

    function mintSigned(
        address recipient,
        uint256 amount,
        uint256 nonce,
        bytes memory sig
    ) public {
        require(recipient == msg.sender, "ESW:sender");
        // check sign
        bytes32 message =
            _prefixed(
                keccak256(abi.encodePacked(recipient, amount, nonce, this))
            );

        require(
            _recoverSigner(message, sig) == oracle &&
                walletNonce[msg.sender] < nonce,
            "ESW:sign"
        );

        walletNonce[msg.sender] = nonce;

        super._mint(recipient, amount);
    }

    function getOracle() public view returns (address) {
        return (oracle);
    }

    /****** test only, remove at production ****/
    function mint(address recipient, uint256 amount) public mintGranted {
        super._mint(recipient, amount);
    }

    function setOracle(address _oracle) public onlyAdmin {
        require(_oracle != address(0), "oracleSign: bad address");
        oracle = _oracle;
    }
    /*******************************************/
}
