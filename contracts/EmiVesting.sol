// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.6.2;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "./interfaces/IEmiVesting.sol";
import "./interfaces/IERC20Detailed.sol";
import "./libraries/Priviledgeable.sol";

contract EmiVesting is Initializable, Priviledgeable, IEmiVesting {
    using SafeMath for uint;
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    //-----------------------------------------------------------------------------------
    // Data Structures
    //-----------------------------------------------------------------------------------
    uint32 constant QUARTER = 3 * 43776 minutes; // 3 months of 30.4 days in seconds;
    uint constant WEEK = 7 days;
    uint constant CROWDSALE_LIMIT = 40000000e18;// tokens
    uint constant CATEGORY_COUNT = 12; // Maximum category count
    uint32 constant VIRTUAL_MASK = 0x80000000;
    uint32 constant PERIODS_MASK = 0x0000FFFF;

    struct LockRecord {
	uint amountLocked;  // Amount of locked tokens in total
        uint32 periodsLocked; // Number of periods locked in total and withdrawn: withdrawn << 16 + total
        uint32 periodLength; // Length of the period
        uint32 freezeTime; // Time when tokens were frozen
        uint32 category;   // High bit of category means that its virtual tokens
    }

    struct CategoryRecord {
        uint tokensAcquired;
        uint tokensMinted;
        uint tokensAvailableToMint;
    }

    event TokensLocked(address indexed beneficiary, uint amount);
    event TokensClaimed(address indexed beneficiary, uint amount);
    event TokenChanged(address indexed oldToken, address indexed newToken);

    //-----------------------------------------------------------------------------------
    // Variables, Instances, Mappings
    //-----------------------------------------------------------------------------------
    /* Real beneficiary address is a param to this mapping */
    mapping(address => LockRecord[]) private _locksTable;
    mapping(address => CategoryRecord[CATEGORY_COUNT]) private _statsTable;

    address public _token;
    uint public version;
    uint public currentCrowdsaleLimit;

    // !!!In updates to contracts set new variables strictly below this line!!!
    //-----------------------------------------------------------------------------------
 string public codeVersion = "EmiVesting v1.0-11-g02dccfa";

    //-----------------------------------------------------------------------------------
    // Smart contract Constructor
    //-----------------------------------------------------------------------------------
    function initialize(address _ESW, uint _version) public initializer
    {
      require(_ESW != address(0), "Token address cannot be empty");
      _token = _ESW;
      currentCrowdsaleLimit = CROWDSALE_LIMIT;
      _addAdmin(msg.sender);
      _addAdmin(_ESW);
    }

    //-----------------------------------------------------------------------------------
    // Observers
    //-----------------------------------------------------------------------------------
    // Return unlock date and amount of given lock
    function getLock(address beneficiary, uint32 idx) external onlyAdmin view returns (uint, uint, uint)
    {
      require(beneficiary != address(0), "Beneficiary should not be zero address");
      require(idx < _locksTable[beneficiary].length, "Lock index is out of range");

      return _getLock(beneficiary, idx);
    }

    function getLocksLen(address beneficiary) external onlyAdmin view returns (uint)
    {
      require(beneficiary != address(0), "Beneficiary should not be zero address");

      return _locksTable[beneficiary].length;
    }

    function getStats(address beneficiary, uint32 category) external onlyAdmin view returns (uint, uint, uint)
    {
      require(beneficiary != address(0), "Beneficiary should not be zero address");
      require(category < CATEGORY_COUNT, "Wrong category idx");

      return (_statsTable[beneficiary][category].tokensAcquired, _statsTable[beneficiary][category].tokensMinted, 
        _statsTable[beneficiary][category].tokensAvailableToMint);
    }

    //-----------------------------------------------------------------------------------
    // Observers
    //-----------------------------------------------------------------------------------
    // Return closest unlock date and amount
    function getNextUnlock() external view returns (uint, uint)
    {
        uint lockAmount = 0;
        uint unlockTime = 0;
        LockRecord[] memory locks = _locksTable[msg.sender];
        
        for (uint i = 0; i < locks.length; i++) {
          uint32 periodsWithdrawn = locks[i].periodsLocked >> 16;
          uint32 periodsTotal = locks[i].periodsLocked & PERIODS_MASK;

          for (uint j = periodsWithdrawn; j < periodsTotal; j++) {
            if (locks[i].freezeTime + locks[i].periodLength * (j+1) >= block.timestamp) {
              if (unlockTime == 0) {
                unlockTime = locks[i].freezeTime + locks[i].periodLength * (j+1);
                lockAmount = locks[i].amountLocked / periodsTotal;
              } else {
                if (unlockTime > locks[i].freezeTime + locks[i].periodLength * (j+1)) {
                  unlockTime = locks[i].freezeTime + locks[i].periodLength * (j+1);
                  lockAmount = locks[i].amountLocked / periodsTotal;
                }
              }
            }
          }
        }
        return (unlockTime, lockAmount);
    }

    function getMyLock(uint idx) external view returns (uint, uint, uint)
    {
      require(idx < _locksTable[msg.sender].length, "Lock index is out of range");

      return _getLock(msg.sender, uint32(idx));
    }

    function getMyLocksLen() external view returns (uint)
    {
      return _locksTable[msg.sender].length;
    }

    function getMyStats(uint category) external view returns (uint, uint, uint)
    {
      require(category < CATEGORY_COUNT, "Wrong category idx");

      return (_statsTable[msg.sender][category].tokensAcquired, _statsTable[msg.sender][category].tokensMinted, 
        _statsTable[msg.sender][category].tokensAvailableToMint);
    }

    function unlockedBalanceOf(address beneficiary) external view returns (uint)
    {
      require(beneficiary != address(0), "Address should not be zero");

      return _getBalance(beneficiary, false, false) - _getBalance(beneficiary, true, false);
    }

    function balanceOf(address beneficiary) external override view returns (uint)
    {
      require(beneficiary != address(0), "Address should not be zero");

      return _getBalance(beneficiary, false, false) + _getBalance(beneficiary, false, true);
    }

    function balanceOfVirtual(address beneficiary) external view returns (uint)
    {
      require(beneficiary != address(0), "Address should not be zero");

      return _getBalance(beneficiary, false, true);
    }

    function getCrowdsaleLimit() external override view returns (uint) {
      return currentCrowdsaleLimit;
    }

    function freeze(address beneficiary, uint tokens, uint category) external override onlyAdmin
    {
      require(beneficiary != address(0), "Address should not be zero");
      require(tokens >= 0, "Token amount should be positive non-zero");
      require(currentCrowdsaleLimit >= tokens, "Crowdsale tokens limit reached");
      require(category < CATEGORY_COUNT, "Wrong category idx");

      _freeze3(beneficiary, uint32((block.timestamp / WEEK) * WEEK), tokens, uint32(category), false, true);

      _statsTable[beneficiary][category].tokensAcquired += tokens;
      _statsTable[beneficiary][category].tokensMinted += tokens;

      emit TokensLocked(beneficiary, tokens);
    }

    // freeze presale tokens from specified date
    function freeze2(address beneficiary, uint sinceDate, uint tokens, uint category) external onlyAdmin
    {
      require(beneficiary != address(0), "Address should not be zero");
      require(sinceDate > 1593561600, "Date must be after token sale start"); // 2020-07-01
      require(tokens > 0, "Token amount should be positive non-zero");
      require(currentCrowdsaleLimit >= tokens, "Crowdsale tokens limit reached");
      require(category < CATEGORY_COUNT, "Wrong category idx");

      _freeze3(beneficiary, uint32((sinceDate / WEEK) * WEEK), tokens, uint32(category), false, true);

      _statsTable[beneficiary][category].tokensAcquired += tokens;
      _statsTable[beneficiary][category].tokensMinted += tokens;

      emit TokensLocked(beneficiary, tokens);
    }

    // freeze presale tokens from specified date
    function freezeBulk(address[] calldata beneficiaries, uint[] calldata sinceDate, uint[] calldata tokens, uint category) external onlyAdmin
    {
      require(beneficiaries.length > 0, "Array should not be empty");
      require(beneficiaries.length == sinceDate.length, "Arrays should be of equal length");
      require(sinceDate.length == tokens.length, "Arrays should be of equal length");
      uint cct = currentCrowdsaleLimit;

      for (uint i = 0; i < beneficiaries.length; i++) {
        require(cct >= tokens[i], "Crowdsale tokens limit reached");
        cct -= tokens[i];
        _freeze3(beneficiaries[i], uint32((sinceDate[i] / WEEK) * WEEK), tokens[i], uint32(category), false, false);
        _statsTable[beneficiaries[i]][category].tokensAcquired += tokens[i];
        _statsTable[beneficiaries[i]][category].tokensMinted += tokens[i];
        emit TokensLocked(beneficiaries[i], tokens[i]);
      }
    }

    // freeze presale tokens from current date without crowdSaleLimit updates
    function freezeVirtual(address beneficiary, uint tokens, uint category) external override onlyAdmin
    {
      require(beneficiary != address(0), "Address should not be zero");
      require(tokens > 0, "Token amount should be positive non-zero");
      require(category < CATEGORY_COUNT, "Wrong category idx");

      _freeze3(beneficiary, uint32((block.timestamp / WEEK) * WEEK), tokens, uint32(category), true, false);

      _statsTable[beneficiary][category].tokensAcquired += tokens;
      _statsTable[beneficiary][category].tokensAvailableToMint += tokens;
    }

    // freeze presale tokens from specified date with crowdsale limit updates
    function freezeVirtual2(address beneficiary, uint32 sinceDate, uint tokens, uint category) external override onlyAdmin
    {
      require(beneficiary != address(0), "Address should not be zero");
      require(sinceDate > 1593561600, "Date must be after token sale start"); // 2020-07-01
      require(tokens > 0, "Token amount should be positive non-zero");
      require(category < CATEGORY_COUNT, "Wrong category idx");

      _freeze3(beneficiary, uint32((sinceDate / WEEK) * WEEK), tokens, uint32(category), true, true);

      _statsTable[beneficiary][category].tokensAcquired += tokens;
      _statsTable[beneficiary][category].tokensAvailableToMint += tokens;
    }

    function claim() external returns (bool)
    {
      uint tokensAvailable = _getBalance(msg.sender, false, false) - _getBalance(msg.sender, true, false);
      require(tokensAvailable > 0, "No unlocked tokens available");

      LockRecord[] memory addressLock = _locksTable[msg.sender];

      for (uint i = 0; i < addressLock.length; i++) {
        if (!_isVirtual(addressLock[i].category)) { // not virtual tokens, claim
          uint32 periodsWithdrawn = addressLock[i].periodsLocked >> 16;
          uint32 periodsTotal = addressLock[i].periodsLocked & PERIODS_MASK;
          uint32 newPeriods = 0;
          for (uint j = periodsWithdrawn; j < periodsTotal; j++) {
            if (addressLock[i].freezeTime + addressLock[i].periodLength * (j+1) < block.timestamp) {             
              newPeriods++;
            }
          }
          if (newPeriods > 0) {
            _locksTable[msg.sender][i].periodsLocked = ((periodsWithdrawn + newPeriods) << 16) + periodsTotal;
          }
        }
      }

      emit TokensClaimed(msg.sender, tokensAvailable);

      return IERC20(_token).transfer(msg.sender, tokensAvailable);
    }

    // function changes token address
    function changeToken(address _newtoken) external onlyAdmin returns (bool)
    {
      require(_newtoken != address(0), "New token cannot be null");
      emit TokenChanged(_token, _newtoken);
      _token = _newtoken;

      return true;
    }
    //-----------------------------------------------------------------------------------
    // Locks manipulation
    //-----------------------------------------------------------------------------------    
    function _freeze(address _beneficiary, uint32 _freezetime, uint _tokens, uint32 category, bool isVirtual, bool updateCS) internal
    {
      uint32 cat = (isVirtual)?category | VIRTUAL_MASK: category;
      LockRecord memory l = LockRecord({ amountLocked: _tokens, periodsLocked: 4, periodLength: QUARTER, freezeTime: _freezetime, category: cat});

      if (updateCS) {
        require(currentCrowdsaleLimit >= _tokens, "EmiVesting: crowdsale limit exceeded");
        currentCrowdsaleLimit = currentCrowdsaleLimit.sub(_tokens);
      }
      _locksTable[_beneficiary].push(l);
    }

    function _freeze3(address _beneficiary, uint32 _freezetime, uint _tokens, uint32 category, bool isVirtual, bool updateCS) internal
    {      
      LockRecord[] storage lrec = _locksTable[_beneficiary];
      bool recordFound = false;

      for (uint j = 0; j < lrec.length; j++) {
        if (lrec[j].freezeTime == _freezetime && (lrec[j].category & ~VIRTUAL_MASK)==category) {
          recordFound = true;
          lrec[j].amountLocked += _tokens;
          if (updateCS) {
            require(currentCrowdsaleLimit >= _tokens, "EmiVesting: crowdsale limit exceeded 3");
            currentCrowdsaleLimit = currentCrowdsaleLimit.sub(_tokens);
          }
        }
      }
      if (!recordFound) { // no record found, create new
        _freeze(_beneficiary, _freezetime, _tokens, category, isVirtual, updateCS);
      }
    }

    function _getBalance(address beneficiary, bool locked, bool isVirtual) internal view returns (uint)
    {
      LockRecord[] memory addressLock = _locksTable[beneficiary];
      uint totalBalance = 0;
      uint lockedBalance = 0;

      for (uint i = 0; i < addressLock.length; i++) {
        if (_isVirtual(addressLock[i].category) == isVirtual) {
          uint32 periodsWithdrawn = addressLock[i].periodsLocked >> 16;
          uint32 periodsTotal = addressLock[i].periodsLocked & PERIODS_MASK;
          uint periodAmount = addressLock[i].amountLocked / periodsTotal;

          totalBalance += addressLock[i].amountLocked - (periodAmount * periodsWithdrawn);
          for (uint j = periodsWithdrawn; j < periodsTotal; j++) {
            if (addressLock[i].freezeTime + addressLock[i].periodLength * (j+1) >= block.timestamp) {             
              lockedBalance += periodAmount;
            }
          }
        }
      }

      return (locked)?lockedBalance:totalBalance;
    }

    function _getLock(address beneficiary, uint32 idx) internal view returns (uint, uint, uint)
    {
        uint32 periodsWithdrawn = _locksTable[beneficiary][idx].periodsLocked >> 16;
        uint32 periodsTotal = _locksTable[beneficiary][idx].periodsLocked & PERIODS_MASK;

        return (_locksTable[beneficiary][idx].freezeTime, 
           _locksTable[beneficiary][idx].amountLocked.div(periodsTotal).mul(periodsTotal-periodsWithdrawn), 
           _locksTable[beneficiary][idx].category & ~VIRTUAL_MASK);
    }

    function _isVirtual(uint32 v) internal pure returns (bool)
    {
      return (v & VIRTUAL_MASK) > 0;
    }
    // ------------------------------------------------------------------------
    // Owner can transfer out any accidentally sent ERC20 tokens
    // ------------------------------------------------------------------------
    function transferAnyERC20Token(address tokenAddress, address beneficiary, uint tokens) public onlyAdmin returns (bool success) {
        require(tokenAddress!=address(0), "Token address cannot be 0");
        require(tokenAddress!=_token, "Token cannot be ours");

        return IERC20(tokenAddress).transfer(beneficiary, tokens);
    }
}