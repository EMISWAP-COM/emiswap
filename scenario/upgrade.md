# Contract upgrade guide

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
