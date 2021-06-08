# ESW crowdsale deployment guide

First of all, open all enclosed files from *flat* folder of the repository. 

## Compile files

1. open them one-by-one in FILE EXPLORERS
2. Switch to SOLIDITY COMPILER tab.
3. Open each file tab and press big blue button Compile _filename_ for each file.
4. Go to DEPLOY and RUN TRANSACTION tab.

## Deploy contracts

First, setup environment: set Injected Web3 and login to Metamask main admin account. Select proper account from Account field

### Voting contract
0. Switch to SOLIDITY COMPILER tab.
1. Switch to _EmiVoting.sol_ in opened file list tabs.
2. Press big blue button *Compile EmiVoting.sol*.
3. Go to DEPLOY and RUN TRANSACTION tab.
4. Select *EmiVoting* from Contract field.
5. Push *Deploy* button.
6. On "Deployed Contracts" section -> EmiVoting AT... write down emiVotingImpl address.

### Referrals contract

0. Switch to SOLIDITY COMPILER tab.
1. Switch to _EmiReferral.sol_ in opened file list tabs.
2. Press big blue button *Compile EmiReferral.sol*.
3. Go to DEPLOY and RUN TRANSACTION tab.
4. Select *EmiReferral* from Contract field.
5. Push Deploy button.
6. On "Deployed Contracts" section -> EmiReferral AT... write down emiReferralImpl address.

### ESWc contract

0. Switch to SOLIDITY COMPILER tab.
1. Switch to _ESW.sol_ in opened file list tabs.
2. Press big blue button *Compile ESW.sol*.
3. Go to DEPLOY and RUN TRANSACTION tab.
4. Select *ESW* from Contract field.
5. Push Deploy button.
6. On "Deployed Contracts" section -> ESW AT... write down ESWImpl address.

### Crowdsale contract
0. Switch to SOLIDITY COMPILER tab.
1. Switch to _Crowdsale.sol_ in opened file list tabs.
2. Press big blue button *Compile Crowdsale.sol*.
3. Select *Crowdsale* from Contract field.
4. Set gas limit field to 5000000.
4. Push Deploy button.
5. On "Deployed Contracts" section -> Crowdsale AT... write down CrowdsaleImpl address.

### Vesting contract
0. Switch to SOLIDITY COMPILER tab.
1. Switch to _EmiVesting.sol_ in opened file list tabs.
2. Press big blue button *Compile EmiVesting.sol*.
3. Go to DEPLOY and RUN TRANSACTION tab.
4. Select *EmiVesting* from Contract field.
5. Push Deploy button.
6. On "Deployed Contracts" section -> EmiVesting AT... write down emiVestingImpl address.

### Vamp contract
0. Switch to SOLIDITY COMPILER tab.
1. Switch to _EmiVamp.sol_ in opened file list tabs.
2. Press big blue button *Compile EmiVamp.sol*.
3. Go to DEPLOY and RUN TRANSACTION tab.
4. Select *EmiVamp* from Contract field.
5. Push Deploy button.
6. On "Deployed Contracts" section -> EmiVamp AT... write down emiVampImpl address.

### EmiVault contract Set 0.6.2 version, disable optimization
0. Switch to SOLIDITY COMPILER tab.
1. Switch to _EmiVault.Full.sol_ in opened file list tabs.
2. Press big blue button *Compile EmiVault.Full.sol*.
3. Go to DEPLOY and RUN TRANSACTION tab.
4. Select *EmiVault* from Contract field.
5. Push Deploy button.
6. On "Deployed Contracts" section -> EmiVault AT... write down emiVaultImpl address.
7. Make EmiVault contract upgradeable proxy (see below)!

### EmiFactory contract
0. Switch to SOLIDITY COMPILER tab. Set 0.6.12 version, enable optimization = 100000
1. Switch to _EmiFactory.Full.sol_ in opened file list tabs.
2. Press big blue button *Compile EmiFactory.Full.sol*.
3. Go to DEPLOY and RUN TRANSACTION tab.
4. Select *EmiFactory* from Contract field.
5. Push Deploy button.
6. On "Deployed Contracts" section -> EmiFactory AT... write down emiFactoryImpl address.
7. Set configuration values - admin grant, vault address, fee and vault fee:
    1. function setAdminGrant, set current wallet, true and run transaction.
    2. function setaddressVault, set EmiVault proxy address and run transaction.
    3. function setFee, set parameter to 3000000000000000 // 0.03% (3*10^15)
    4. function setFeeVault, set parameter to 500000000000000 // 0.005% (3*10^14)

### EmiRouter contract 
0. Switch to SOLIDITY COMPILER tab. Set 0.6.12 version, enable optimization = 100000
1. Switch to _EmiRouter.Full.sol_ in opened file list tabs.
2. Press big blue button *Compile EmiRouter.Full.sol*.
3. Go to DEPLOY and RUN TRANSACTION tab.
4. Select *EmiRouter* from Contract field.
5. set deploy parameters:
    1. EmiFactory address - from previouse step
    2. WETH token address - 0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2 (MAINNET WETH address)
6. Push Deploy button.
7. On "Deployed Contracts" section -> EmiRouter AT... write down emiRouterImpl address.
 
### Proxy admin contract
0. Switch to SOLIDITY COMPILER tab.
1. Switch to _EmiVotableProxyAdmin.Full.sol_ in opened file list tabs.
2. Press big blue button *Compile EmiVotableProxyAdmin.Full.sol*.
3. Go to DEPLOY and RUN TRANSACTION tab.
4. Select *EmiVotableProxyAdmin* from Contract field.
5. Change account address to upgrade admin account if needed.
6. Set address_vc parameter to emiVotingImpl address.
7. Push Deploy button.
8. On "Deployed Contracts" section -> EmiVotableProxyAdmin AT... write down "emiVotableProxyAdmin address".

### Add proxy admin to Voting contract
If upgrade proxy account differ from main system account, we need to setup admin privileges to upgrade account. To do so:
0. In Deployed contracts section, open EmiVoting AT ... tab
1. Select main admin account in Accounts field
2. Set _address_admin_ field near _addAdmin_ method to emiVotableProxyAdmin address.
3. Press *Transact*

## Create upgradeable proxies

### ESWc
0. Switch to SOLIDITY COMPILER tab.
1. Switch to _EmiVotingProxyAdmin.sol_ in opened file list tabs.
2. Press big blue button *Compile EmiVotingProxyAdmin.sol*.
3. Select *TransparentUpgradeableProxy* from Contract field.
4. Change account address to upgrade admin account if it exist.
5. Set _LOGIC address_ parameter to emiESWcImpl address.
6. Set _ADMIN address_ parameter to emiVotableProxyAdmin address.
7. Set _DATA bytes_ parameter to 0x8129fc1c.
8. Push Transact button.
9. On "Deployed Contracts" section -> TransactUpgradeableProxy AT... write down final *ESWc* address.

### EmiVesting
0. Switch to SOLIDITY COMPILER tab.
1. Switch to _EmiVotingProxyAdmin.sol_ in opened file list tabs.
2. Press big blue button *Compile EmiVotingProxyAdmin.sol*.
3. Select *TransparentUpgradeableProxy* from Contract field.
4. Change account address to upgrade admin account if it exist.
5. Prepare initialization data:
   1. On Deployed Contract section open EMIVESTING accordion
   2. Select initialize method, open params pane
   3. Set _ESW address_ field to ESWc address from step ESWc 7.
   4. Set _version_ field to 1.
   5. Press small double-sheet icon to the left of *transact* button (don't press button itself!!!)
6. Set _LOGIC address_ parameter to emiVestingImpl address.
7. Set _ADMIN address_ parameter to emiVotableProxyAdmin address.
8. Set _DATA bytes_ parameter to value from step 5-5. It should look like long digits string: 0xcd6dc687000000000000000000000000652c9accc53e765e1d96e2455e618daab79ba5950000000000000000000000000000000000000000000000000000000000000001
9. Push Transact button.
10. On "Deployed Contracts" section -> last TransactUpgradeableProxy AT... entry write down final *Vesting* address.

### Referrals
0. Switch to SOLIDITY COMPILER tab.
1. Switch to _EmiVotingProxyAdmin.sol_ in opened file list tabs.
2. Press big blue button *Compile EmiVotingProxyAdmin.sol*.
3. Select *TransparentUpgradeableProxy* from Contract field.
4. Change account address to upgrade admin account if it exist.
5. Set _LOGIC address_ parameter to emiReferralImpl address.
6. Set _ADMIN address_ parameter to emiVotableProxyAdmin address.
7. Set _DATA bytes_ parameter to 0x8129fc1c.
8. Push Transact button.
9. On "Deployed Contracts" section -> last TransactUpgradeableProxy AT... entry write down final *Referrals* address.

### EmiVamp
0. Switch to SOLIDITY COMPILER tab.
1. Switch to _EmiVotingProxyAdmin.sol_ in opened file list tabs.
2. Press big blue button *Compile EmiVotingProxyAdmin.sol*.
3. Select *TransparentUpgradeableProxy* from Contract field.
4. Change account address to upgrade admin account if it exist.
5. Prepare initialization data:
   1. On Deployed Contract section open EMIVAMP accordion
   2. Select initialize method, open params pane
   3. Set _lpTokens_ field to this address: .
   4. Set _types_ field to 0.
   5. Set _ourrouter_ field to Router address from step.
   6. Press small double-sheet icon to the left of *transact* button (don't press button itself!!!)
6. Set _LOGIC address_ parameter to emiVampImpl address.
7. Set _ADMIN address_ parameter to emiVotableProxyAdmin address.
8. Set _DATA bytes_ parameter to value from step 5-6. It should look like long digits string: 0xcd6dc687000000000000000000000000652c9accc53e765e1d96e2455e618daab79ba5950000000000000000000000000000000000000000000000000000000000000001
9. Push Transact button.
10. On "Deployed Contracts" section -> last TransactUpgradeableProxy AT... entry write down final *Vamp* address.

### Crowdsale
0. Switch to SOLIDITY COMPILER tab.
1. Switch to _EmiVotingProxyAdmin.sol_ in opened file list tabs.
2. Press big blue button *Compile EmiVotingProxyAdmin.sol*.
3. Select *TransparentUpgradeableProxy* from Contract field.
4. Change account address to upgrade admin account if it exist.
5. Prepare initialization data:
   1. In Deployed Contract section open CROWDSALE accordion
   2. Select initialize method, open params pane
   3. Set _eswToken address_ field to ESWc address from step ESWc 7.
   4. Set _uniswapFactory_ field to ''.
   5. Set _referralStoreInput address_ field to Referral address from step Referrals 9.
   6. Set _wethToken address_ field to ''.
   7. Set _foundationWallet address_ field to ''.
   8. Set _teamWallet address_ field to ''.
   9. Press small double-sheet icon to the left of *transact* button (don't press button itself!!!)
6. Set _LOGIC address_ parameter to CrowdsaleImpl address.
7. Set _ADMIN address_ parameter to emiVotableProxyAdmin address.
8. Set _DATA bytes_ parameter to value from step 5-9. It should look like long digits string: 0xcd6dc687000000000000000000000000652c9accc53e765e1d96e2455e618daab79ba5950000000000000000000000000000000000000000000000000000000000000001
9. Push Transact button.
10. In "Deployed Contracts" section -> last TransactUpgradeableProxy AT... entry write down final *Crowdsale* address.

### EmiVault
0. Switch to SOLIDITY COMPILER tab.
1. Switch to _EmiVotingProxyAdmin.sol_ in opened file list tabs.
2. Press big blue button *Compile EmiVotingProxyAdmin.sol*.
3. Select *TransparentUpgradeableProxy* from Contract field.
4. Change account address to upgrade admin account if it exist.
5. Set _LOGIC address_ parameter to emiVaultImpl address.
6. Set _ADMIN address_ parameter to emiVotableProxyAdmin address.
7. Set _DATA bytes_ parameter to 0x8129fc1c.
8. Push Transact button.
9. On "Deployed Contracts" section -> last TransactUpgradeableProxy AT... entry write down final *EmiVault* address.

## Add currencies
0. Get CrowdSale Proxy address
1. Go to Remix -> Open CrowdSale.Full.sol file on file browser
2. Compile 
3. go Deploy&run transactions
4. select contract - CrowdSale
5. Fill up field "At address" with CrowdSale Proxy address and press "At address" button
6. On deployed contracs find Crowdsale accordion - open functions list
7. On function fetchCoin fill up values:
    7.1 For exact price set (first of all must be DAI, second EMIREX)
        7.1.1 token address
        7.1.2 price value (for 0.11 DAI set 1100, for 0.275 set 2750)
        7.1.3 token status set 1
        7.1.4 make transaction
    7.2 For marken ptice tokens:
        7.2.1 token address
        7.2.2 price value 0
        7.2.3 token status set 3
        7.2.4 make transaction
8. repeat for all tokens

## Configure ESWc
0. Get ESWc PROXY Contract Address
1. Go to Remix -> Open ESW.Full.sol file on file browser
2. Compile 
3. go Deploy&run transactions
4. select contract - ESW
5. Fill up field "At address" with ESWc PROXY Contract Address and press "At address" button
6. On deployed contracs find ESW accordion - open functions list
7. On function setVesting fill up address value with EmiVesting PROXY Contract Address, make transaction
8. On function setMintLimit 
    8.1 fill up address value with CrowdSale PROXY Contract Address, 
    8.2 fill up tokens value with 40000000000000000000000000 (40000000 ESW), 
    8.3 make transaction

## Configure Referral 
0. Get Referral PROXY Contract Address
1. Go to Remix -> Open EmiReferral.Full.sol file on file browser
2. Compile 
3. go Deploy&run transactions
4. select contract - EmiReferral
5. Fill up field "At address" with EmiReferral PROXY Contract Address and press "At address" button
6. On deployed contracs find EmiReferral accordion - open functions list
7. Run function setAdminOnce, make transaction
8. On function grantRef fill up address value with CrowdSale PROXY Contract Address, make transaction

## upgrade crowdsale
0. make deployment of new crowdsale implementation, as described in section "Crowdsale contract" (top manual part) -> save new CrowdSale impl address
1. prepare future date for voiting to be completed, date must be in "The Current Unix Timestamp" (https://www.unixtimestamp.com/index.php), get unix time value from site for future date in 5-10 minutes from now -> save "voting finish unix time".
2. get some random number "hash", for example 1000 -> save it
3. compile EmiVoting.sol and get it AT " ... emiVoting address ... "
4. run newUpgradeVoting with parameters:
    4.1 old crowdSale Implementation address (not proxy!)
    4.2 new CrowdSale impl address
    4.3 "voting finish unix time"
    4.4 "hash" = 1000
5. run transaction
6. wait for date "voting finish unix time" will passed -> run emiVoting.calcVotingResult(hash)
7. compile VotableProxyAdmin.Full.sol and get it AT " ... emiVotableProxyAdmin address ... " 
8. select contract "EmiVotableProxyAdmin", press "AT" 
9. in "Deployed contracts" section find emiVotableProxyAdmin accordeon
10. select and fill up method upgrade with params:
    10.1 CrowdSale PROXY Contract Address
    10.2 "hash"
11. run method upgrade

## Remove token from crowdsale listing
0. Idea: token not listed in crowdsale if it has status = 0. To remove token from crowdsale listing set token status to 0 needed
1. Connect to contract. 
    1.1 Get "CrowdSale PROXY Contract Address"
    1.2 Go to Remix -> Open CrowdSale.Full.sol file on file browser
    1.3 Compile 
    1.4 go Deploy&run transactions
    1.5 select contract - CrowdSale
    1.6 Fill up field "At address" with "CrowdSale PROXY Contract Address" and press "At address" button -> you'll get crowdsale in "Deployed Contracts" list
2. Get address of token to remove from crowdsale - "token address"
3. Find and open Crowdsale accordeon in "Deployed Contracts" list.
4. Get index of the token in crowdsale listing -> run readonly method "coinIndex" with parameter "token address" -> get "index number".
5. Get data by index number -> run readonly method "coinData" with parameter "index number" -> you need to check token address and status (status 1, 3 is working status, 0 is not listed status).
6. To remove token from CrowdSale listing -> execute method "setStatusByID", with parameters:
    6.1 "index number"
    6.2 0 (status 0 - is not listed)

### EmiPrice2
0. Switch to SOLIDITY COMPILER tab.
1. Switch to _EmiPric2.full.sol_ in opened file list tabs.
2. Press big blue button *Compile EmiPrice2.sol*.
3. Select *TransparentUpgradeableProxy* from Contract field.
4. Change account address to upgrade admin account if it exist.
5. Prepare initialization data:
   1. On Deployed Contract section open EMIPRICE2 accordion
   2. Select initialize method, open params pane
   3. Set _market1_ field to this address (EmiFactory): 0x1771dff85160768255f0a44d20965665806cbf48.
   4. Set _market2_ field to this address (Uniswap factory): 0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f.
   5. Set _market3_ field to this address (OneSplit contract): 0x1814222fa8c8c1C1bf380e3BBFBd9De8657Da476.
   6. Set _emiRouter_ field to this address (EmiRouter): 0x52893082158EE997Bb46748bD2ccb2bbB5A23E71.
   7. Set _uniRouter_ field to this address (Uniswap router02): 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D.
   8. Press small double-sheet icon to the left of *transact* button (don't press button itself!!!)
6. Set _LOGIC address_ parameter to emiPriceImpl address.
7. Set _ADMIN address_ parameter to emiVotableProxyAdmin address.
8. Set _DATA bytes_ parameter to value from step 5-8. It should look like long digits string: 0xcd6dc687000000000000000000000000652c9accc53e765e1d96e2455e618daab79ba5950000000000000000000000000000000000000000000000000000000000000001
9. Push Transact button.
10. On "Deployed Contracts" section -> last TransactUpgradeableProxy AT... entry write down final *EmiPrice2* address.
