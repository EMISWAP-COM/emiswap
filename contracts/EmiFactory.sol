// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./libraries/UniERC20.sol";
import "./Emiswap.sol";

contract EmiFactory is Ownable {
    using UniERC20 for IERC20;

    mapping(address => bool) private _adminTable;

    modifier onlyAdmin() {
        require(_adminTable[msg.sender], "Admin: caller is not admin");
        _;
    }

    event Deployed(
        address indexed emiswap,
        address indexed token1,
        address indexed token2
    );

    event adminGranted(address indexed admin, bool isGranted);

    uint256 public constant MAX_FEE = 0.003e18; // 0.3%

    uint256 public fee;
    uint256 public feeVault;
    address public addressVault;
    Emiswap[] public allPools;
    mapping(Emiswap => bool) public isPool;
    mapping(IERC20 => mapping(IERC20 => Emiswap)) public pools;

    function getAllPools() external view returns (Emiswap[] memory) {
        return allPools;
    }

    function setFee(uint256 newFee) external onlyAdmin {
        require(newFee <= MAX_FEE, "Factory: fee should be <= 0.3%");
        fee = newFee;
    }

    function setFeeVault(uint256 newFeeVault) external onlyAdmin {
        require(newFeeVault < fee, "Factory: vault fee");
        feeVault = newFeeVault;
    }

    function setaddressVault(address newAddressVault) external onlyAdmin {
        require(newAddressVault != address(0), "Factory: vault");
        addressVault = newAddressVault;
    }

    function setAdminGrant(address newAdmin, bool isGranted)
        external
        onlyOwner
    {
        require(newAdmin != address(0), "Admin address 0");
        _adminTable[newAdmin] = isGranted;
        emit adminGranted(newAdmin, isGranted);
    }

    function deploy(IERC20 tokenA, IERC20 tokenB)
        external
        returns (Emiswap pool)
    {
        require(tokenA != tokenB, "Factory: not support same tokens");
        require(
            pools[tokenA][tokenB] == Emiswap(0),
            "Factory: pool already exists"
        );

        (IERC20 token1, IERC20 token2) = sortTokens(tokenA, tokenB);
        IERC20[] memory tokens = new IERC20[](2);
        tokens[0] = token1;
        tokens[1] = token2;

        string memory symbol1 = token1.uniSymbol();
        string memory symbol2 = token2.uniSymbol();

        pool = new Emiswap(
            tokens,
            string(
                abi.encodePacked("Emiswap V1 (", symbol1, "-", symbol2, ")")
            ),
            string(abi.encodePacked("EMI-V1-", symbol1, "-", symbol2))
        );

        pool.transferOwnership(owner());
        pools[token1][token2] = pool;
        pools[token2][token1] = pool;
        allPools.push(pool);
        isPool[pool] = true;

        emit Deployed(address(pool), address(token1), address(token2));
    }

    function sortTokens(IERC20 tokenA, IERC20 tokenB)
        public
        pure
        returns (IERC20, IERC20)
    {
        if (tokenA < tokenB) {
            return (tokenA, tokenB);
        }
        return (tokenB, tokenA);
    }
}
