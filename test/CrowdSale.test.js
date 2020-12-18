// eslint-disable-next-line no-unused-vars
const { accounts, privateKeys, defaultSender } = require('@openzeppelin/test-environment');
const { ether, time, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { default: BigNumber } = require('bignumber.js');
const { assert } = require('chai');
const { contract } = require('./twrapper');

const Referral = contract.fromArtifact('EmiReferral');
const UniswapV2Factory = contract.fromArtifact('UniswapV2Factory');
const UniswapV2Pair = contract.fromArtifact('UniswapV2Pair');
const MockUSDX = contract.fromArtifact('MockUSDX');
const MocUnregistered = contract.fromArtifact('MockUSDX');
const MockUSDY = contract.fromArtifact('MockUSDY');
const MockUSDZ = contract.fromArtifact('MockUSDZ');
const MockWETH = contract.fromArtifact('MockWETH');
const MockWBTC = contract.fromArtifact('MockWBTC');
const ESW = contract.fromArtifact('ESW');
const EmiVesting = contract.fromArtifact('EmiVesting');
const EmiVoting = contract.fromArtifact('EmiVoting');
const EmiVotableProxyAdmin = contract.fromArtifact('EmiVotableProxyAdmin');
const Proxy = contract.fromArtifact('TransparentUpgradeableProxy');
const CrowdSale = contract.fromArtifact('CrowdSale');

const { web3 } = MockUSDX;

MockUSDX.numberFormat = 'String';
ESW.numberFormat = 'String';

// eslint-disable-next-line import/order
const { BN } = web3.utils;

let uniswapFactory;
let uniswapPair;
let usdx;
let usdy;
let unregistered_token;
let usdz;
let weth;
let wbtc;
let esw;
let eswImpl;
let eswImpl2;
let crowdSale;
let crowdSaleImpl;
let crowdSaleImpl2;
let emiVest;
let emiVestImpl;
let emiVestImpl2;
let ref;
let refImpl;
let emiProxyAdmin;
let emiVoting;

const money = {
    ether,
    eth: ether,
    zero: ether('0'),
    weth: ether,
    dai: ether,
    usdx: ether,
    unregistered_token: ether,
    usdy: (value) => ether(value).div(new BN (1e10)),
    usdc: (value) => ether(value).div(new BN (1e12)),
    wbtc: (value) => ether(value).div(new BN (1e10)),
    esw: ether
};

/**
 *Token  Decimals
V ETH    (18)
  USDT   (6)
  USDB   (18)
V USDC   (6)
V DAI    (18)
V EMRX   (8)
V WETH   (18)
v WBTC   (8)
  renBTC (8)
*/

describe('CrowdSale Test', function () {
    const [    TestOwner,     alice,     bob,     clarc,     dave,     eve,     foundation,     team,     proxyAdmin,     presaleAdmin,     george,     henry,     ivan,     oracleWallet] = accounts;
    const [TestOwnerPriv, alicePriv, bobPriv, clarcPriv, davePriv, evePriv, foundationPriv, teamPriv, proxyAdminPriv, presaleAdminPriv, georgePriv, henryPriv, ivanPriv, oracleWalletPriv] = privateKeys;
    const RefDefault = "0xdF3242dE305d033Bb87334169faBBf3b7d3D96c2";

    beforeEach(async function () {
        uniswapFactory = await UniswapV2Factory.new(TestOwner);

        esw = await ESW.new();
        usdx = await MockUSDX.new();
        unregistered_token = await MockUSDX.new();
        usdy = await MockUSDY.new();
        usdz = await MockUSDZ.new();
        weth = await MockWETH.new();
        wbtc = await MockWBTC.new();
        this.refImpl = await Referral.new();
        // prepare upgradeable
        this.eswImpl = await ESW.new();
        this.eswImpl2 = await ESW.new();
        this.crowdSaleImpl = await CrowdSale.new();
        this.crowdSaleImpl2 = await CrowdSale.new();
        this.emiVestImpl = await EmiVesting.new();
        this.emiVestImpl2 = await EmiVesting.new();

        this.emiVoting = await EmiVoting.new();
        this.emiProxyAdmin = await EmiVotableProxyAdmin.new(this.emiVoting.address, {from: proxyAdmin});
        await this.emiVoting.addAdmin(proxyAdmin);

        let initESW = await this.eswImpl.contract.methods.initialize().encodeABI();
        let ESW_proxy = await Proxy.new(this.eswImpl.address, this.emiProxyAdmin.address, initESW, {from: proxyAdmin});
        esw = await ESW.at(ESW_proxy.address);

        let initData = await this.emiVestImpl.contract.methods.initialize(esw.address).encodeABI();

        let t = await Proxy.new(this.emiVestImpl.address, this.emiProxyAdmin.address, initData, {from: proxyAdmin});
        await this.emiVestImpl2.initialize(esw.address);

        initData = await this.refImpl.contract.methods.initialize().encodeABI();

        let rr = await Proxy.new(this.refImpl.address, this.emiProxyAdmin.address, initData, {from: proxyAdmin});
        this.emiVest = await EmiVesting.at(t.address);
        ref = await Referral.at(rr.address);
        
        await esw.setVesting(this.emiVest.address, {from: proxyAdmin});
        
        let initDataCrowdSale = this.crowdSaleImpl.contract.methods.initialize(
            esw.address, uniswapFactory.address, ref.address, weth.address, foundation, team ).encodeABI();

        let crowdSale_proxy = await Proxy.new(this.crowdSaleImpl.address, this.emiProxyAdmin.address, initDataCrowdSale, {from: proxyAdmin});
        crowdSale = await CrowdSale.at(crowdSale_proxy.address);

        // Set new crowdsale admin
        crowdSale.addAdmin(presaleAdmin, {from: proxyAdmin});

        await esw.setMintLimit(crowdSale.address, money.eth('40000000'), {from: proxyAdmin});
        
        /* USDX - USDZ pair (DAI - USDC) */
        await uniswapFactory.createPair(usdx.address, usdz.address);
        const pairAddress = await uniswapFactory.getPair(usdx.address, usdz.address);
        uniswapPair = await UniswapV2Pair.at(pairAddress);

        /* USDX - WETH pair (DAI - ETH) */
        await uniswapFactory.createPair(usdx.address, weth.address);
        const pairAddressUSDX_WETH = await uniswapFactory.getPair(usdx.address, weth.address);
        uniswapPairUSDX_WETH = await UniswapV2Pair.at(pairAddressUSDX_WETH);

        /* USDX - WBTC pair (DAI - WBTC) */
        await uniswapFactory.createPair(usdx.address, wbtc.address);
        const pairAddressUSDX_WBTC = await uniswapFactory.getPair(usdx.address, wbtc.address);
        uniswapPairUSDX_WBTC = await UniswapV2Pair.at(pairAddressUSDX_WBTC);

        const usdxToPAir = new BN(100).mul(new BN(10).pow(new BN(await usdx.decimals()))).toString();
        const usdzToPAir = new BN(101).mul(new BN(10).pow(new BN(await usdz.decimals()))).toString();
    
        const usdxToPAir_USDXWETH = new BN(400).mul(new BN(10).pow(new BN(await usdx.decimals()))).toString();
        const wethToPAir_USDXWETH = new BN(1).mul(new BN(10).pow(new BN(await weth.decimals()))).toString();

        const usdxToPAir_USDXWBTC = new BN(202000).mul(new BN(10).pow(new BN(await usdx.decimals()))).toString();
        const wbtcToPAir_USDXWBTC = new BN(20).mul(new BN(10).pow(new BN(await wbtc.decimals()))).toString();

        await usdx.transfer(bob, usdxToPAir);
        await usdx.transfer(uniswapPair.address, usdxToPAir);
        await usdz.transfer(uniswapPair.address, usdzToPAir);
        await uniswapPair.mint(alice);

        await usdx.transfer(bob, usdxToPAir);
        await usdx.transfer(uniswapPairUSDX_WETH.address, usdxToPAir_USDXWETH);
        await weth.deposit({ value: wethToPAir_USDXWETH });
        await weth.transfer(uniswapPairUSDX_WETH.address, wethToPAir_USDXWETH);
        await uniswapPairUSDX_WETH.mint(alice);
    
        await usdx.transfer(uniswapPairUSDX_WBTC.address, usdxToPAir_USDXWBTC);
        await wbtc.transfer(uniswapPairUSDX_WBTC.address, wbtcToPAir_USDXWBTC);
        await uniswapPairUSDX_WBTC.mint(alice);
        
        // Make crowdsale know about token
        await crowdSale.fetchCoin(usdx.address, 1100, 1, {from: proxyAdmin}); // DAI always first, 1 ESW = 0.11 DAI, 1 DAI=1/0.11=9.090909091 ESW
        await crowdSale.fetchCoin(usdy.address, 2750, 1, {from: proxyAdmin}); // EMRX = 0.4 DAI, 1 DAI = 1/0.4 EMRX = 2.5 EMRX, 1 ESW = 0.11*2.5 EMRX = 0.275EMRX, 1 EMRX=1/0.275=3.636363636 ESW
        await crowdSale.fetchCoin(usdz.address, 0, 3, {from: proxyAdmin});    // USDC, rate from uniswap
        await crowdSale.fetchCoin(wbtc.address, 0, 3, {from: proxyAdmin});    // WBTC, rate from uniswap        

        // coins to wallets
        await usdz.transfer(alice, money.usdc('10'));
        await wbtc.transfer(alice, money.wbtc('4360'));
        await usdx.transfer(alice, money.usdx('10'));
        await usdy.transfer(alice, money.usdy('10'));
        await usdz.transfer(alice, money.usdc('10'));

        // change vesting, check results
        // setup voting
        let releaseTime = (await time.latest()).add(time.duration.minutes(2));
        let h = 43201;
        await this.emiVoting.newUpgradeVoting(this.emiVestImpl.address, this.emiVestImpl2.address, releaseTime, h);
        await time.increaseTo(releaseTime.add(time.duration.minutes(4)));
        await this.emiVoting.calcVotingResult(h);
 
        let j = await this.emiVoting.getVotingResult(h);
        // process upgrade
        await this.emiProxyAdmin.upgrade(this.emiVest.address, h, {from: proxyAdmin});

        // change crowdSale, check results
        // setup voting
        releaseTime = (await time.latest()).add(time.duration.minutes(2));
        h = Math.floor(Math.random() * 1000000);
        await this.emiVoting.newUpgradeVoting(this.crowdSaleImpl.address, this.crowdSaleImpl2.address, releaseTime, h);
        await time.increaseTo(releaseTime.add(time.duration.minutes(4)));
        await this.emiVoting.calcVotingResult(h); 
        await this.emiVoting.getVotingResult(h);
        // process upgrade
        await this.emiProxyAdmin.upgrade(crowdSale.address, h, {from: proxyAdmin});
    });
    describe('Test vesting contract', ()=> {
      it('cannot upgrade contracts under non-admin account', async function () { 
        // try to upgrade contracts under other accounts
        expectRevert.unspecified(
          this.emiProxyAdmin.upgrade(this.emiVest.address, 43201, {from: TestOwner})
        );
        expectRevert.unspecified(
          this.emiProxyAdmin.upgrade(this.emiVest.address, 43201, {from: alice})
        );
        expectRevert.unspecified(
          this.emiProxyAdmin.upgrade(this.emiVest.address, 43201)
        );
      });
    });

    describe('Test crowdsale contract after upgrade', ()=> {
        it('should be working fine', async function () {
            let v = await this.emiVest.codeVersion;
            assert.equal((await crowdSale.coinRate(0)).toString(), '1100');
        });
    });

    describe('Test crowdsale buy tiny values', ()=> {
        it('should be working fine for ETH (18 decimals)', async function () {
            let buy1 = (await crowdSale.buyWithETHView('10', false))[0].toString();
            assert.equal(buy1, '36363', 'buy for 10 WEI must get 36363 ESW (0.000000000000036363)');
        });
        it('should be working fine for ESW Reverse for ETH', async function () { // round(36363*400)=90*1100/10000=9.9, round(9.9) = 9
            let buy1 = (await crowdSale.buyWithETHView('36363', true))[0].toString(); 
            assert.equal(buy1, '9', 'buy 36363 ESW for 9 WEI (0.000000000000000009)');
        });
        it('should be working fine for USDX (18 decimals)', async function () {
            let buy1 = (await crowdSale.buyView(usdx.address, '1', false))[0].toString();
            assert.equal(buy1, '9', 'buy for 1*10**(-18) must get 9*10**(-18)  ');
        });
        it('should be working fine Reverse ESW for USDX (18 decimals)', async function () {
            let buy1 = (await crowdSale.buyView(usdx.address, '11', true))[0].toString();
            assert.equal(buy1, '1', 'buy for 1*10**(-18) must get 9*10**(-18)  ');
        });
        it('should be working fine for USDY (8 decimals)', async function () {
            let buy1 = (await crowdSale.buyView(usdy.address, '1', false))[0].toString();
            assert.equal(buy1, '30000000000', 'buy for 1*10**(-8) must get 3*10**(10)  ');
        });
        it('should be working fine for USDC (6 decimals)', async function () {
            let buy1 = (await crowdSale.buyView(usdz.address, '1', false))[0].toString();
            assert.equal(buy1, '9000900090000', 'buy for 1*10**(-6) must get 3*10**(12)  ');
        });
        it('should be working fine for WBTC (8 decimals)', async function () {
            let buy1 = (await crowdSale.buyView(wbtc.address, '1', false))[0].toString();
            assert.equal(buy1, '918181818181818', 'buy for 1*10**(-8) must get 91818*10**(10)  ');
        });
        it('should be working fine Reverse ESW for WBTC (8 decimals)', async function () {
            let buy1 = (await crowdSale.buyView(wbtc.address, '1818181818181818', true))[0].toString();
            assert.equal(buy1, '1', 'buy for 1*10**(-8) must get 91818*10**(10)  ');
        });
    });
    // george, henry, ivan

    describe('Test presale', ()=> {
      it('should be working fine for loading presales', async function () {
        let beneficiaries = [george, henry, ivan];
        let georgeBal = '10123456789000000000';
        let henryBal = '123987654321000000000';
        let ivanBal = '124654965465465000000';
        let tokens = [georgeBal, henryBal, ivanBal];
        let sinceDates = ['1601424000', '1598918400', '1599004800'];

        await crowdSale.presaleBulkLoad(beneficiaries, tokens, sinceDates, {from: presaleAdmin});

        //let teamBalanceAfter =  new BN(georgeBal).add( new BN(henryBal)).add( new BN(ivanBal)).mul(new BN('1.05')).toString();
        let teamBalanceAfter =  (new BN(georgeBal).add( new BN(henryBal)).add( new BN(ivanBal))).mul(new BN('105')).div(new BN('100')).toString();
        let foundationBalanceAfter =  (new BN(georgeBal).add( new BN(henryBal)).add( new BN(ivanBal))).mul(new BN('5')).div(new BN('100')).toString();
        //console.log('team wallet ESW', (await esw.balanceOf2(team)).toString(), teamBalanceAfter );
        //console.log('foundation wallet ESW', (await esw.balanceOf2(foundation)).toString(), foundationBalanceAfter );
        assert.equal(georgeBal, (await esw.balanceOf2(george)).toString(), 'George ESW balance must be ', georgeBal);
        assert.equal((await esw.balanceOf2(team)).toString(), teamBalanceAfter, 'team balance must be ' + teamBalanceAfter);
        assert.equal((await esw.balanceOf2(foundation)).toString(), foundationBalanceAfter, 'foundation balance must be ' + foundationBalanceAfter);
      });
      it('should be working fine for small value presales', async function () {
        let beneficiaries = [george, henry, ivan];
        let georgeBal = '1';
        let henryBal = '2';
        let ivanBal = '3';
        let tokens = [georgeBal, henryBal, ivanBal];
        console.log('tokens', tokens);
        let sinceDates = ['1601424000', '1598918400', '1599004800'];
        await crowdSale.presaleBulkLoad(beneficiaries, tokens, sinceDates, {from: presaleAdmin});
        console.log('team wallet ESW', (await esw.balanceOf2(team)).toString());
        assert.equal(georgeBal, (await esw.balanceOf2(george)).toString(), 'George ESW balance must be', georgeBal);
      });
      it('should be working for exact mintLimit in loading presales', async function () {
        console.log('team wallet ESW', (await esw.balanceOf2(team)).toString())
        let beneficiaries = [george, henry, ivan];
        console.log('beneficiaries', beneficiaries);
        let tokens = ['8095000000000000000000000', '10000000000000000000000000', '20000000000000000000000000'];
        let sinceDates = ['1601424000', '1598918400', '1599004800'];
        await crowdSale.presaleBulkLoad(beneficiaries, tokens, sinceDates, {from: presaleAdmin});
        console.log('team wallet ESW', (await esw.balanceOf2(team)).toString(), '\ngeorge wallet ESW', (await esw.balanceOf2(george)).toString(),
            '\nhenry wallet ESW', (await esw.balanceOf2(henry)).toString(), '\nivan wallet ESW', (await esw.balanceOf2(ivan)).toString());
      });
      it('should revert for exceed mintLimit in loading presales', async function () {
        let beneficiaries = [george, henry, ivan];
        let tokens = ['100000000000000000000000000000', '10000000000000000000000000', '2000000100000000000000000'];
        let sinceDates = ['1601424000', '1598918400', '1599004800'];
        await expectRevert(
          crowdSale.presaleBulkLoad(beneficiaries, tokens, sinceDates, {from: presaleAdmin}),
          'EmiVesting: crowdsale limit exceeded'
        );
        console.log('team wallet ESW', (await esw.balanceOf2(team)).toString(), 'george wallet ESW', (await esw.balanceOf2(george)).toString(), 'must be 0');
      });
      it('should revert for incorrect admin wallet', async function () {
        let beneficiaries = [george, henry, ivan];
        let tokens = ['100000000000000000000000', '100000000000000000000000', '100000000000000000000000'];
        let sinceDates = ['1601424000', '1598918400', '1599004800'];
        await expectRevert(
          crowdSale.presaleBulkLoad(beneficiaries, tokens, sinceDates, {from: alice}),
          'Priviledgeable: caller is not the owner'
        );
      });
  });

    describe('Buy with ETH', () => {
        beforeEach(async function () {
            const WEIValue = money.ether('2');
            const Decimals = money.ether('1');
            this.BuyWithETHTest = { WEIValue: WEIValue, Decimals: Decimals };
            this.BalanceBefore = new BN(await web3.eth.getBalance(foundation)).div(new BN(10).pow(new BN(18)));
            this.isPreview = false;
        });
        it('buyWithETHView: should preview buy for 2 ETH to be equal to 7272.7272728 ESW', async function () {            
            this.isPreview = true;
            let expectedESW = '7272727272727272727272'; // 800USD / 0.11(DAI/ESW) = 7272.727272727
            let res = (await crowdSale.buyWithETHView(this.BuyWithETHTest.WEIValue, false, { from: bob }))[0].toString();
            assert.equal(expectedESW, res, 'preview buy for 2 ETH to be equal to 7272.7272728 ESW');
        });
        it('buyWithETHViewReverse: should preview buy 7000 ESW for 1.925 ETH', async function () {            
            this.isPreview = true;
            let expectedESW = money.ether('1.925').toString(); // 7000ESW = 1.925ETH * 400USD/ETH / 0.11DAI/ESW
            let res = (await crowdSale.buyWithETHView(money.esw('7000'), true, { from: bob }))[0].toString();
            assert.equal(expectedESW, res, 'preview buy 7000 ESW for 1.925 ETH');
        });
        it('buyWithETHViewReverse: should preview buy 19047619 ESW for ETH', async function () { // close to 40000000 ~= 19047619*1.05*2
            this.isPreview = true;
            let expectedESW = money.ether('5238.095225').toString(); // 19047619 ESW = 5238.095225ETH * 400USD/ETH / 0.11DAI/ESW
            let res = (await crowdSale.buyWithETHView(money.esw('19047619'), true, { from: bob }))[0].toString();
            assert.equal(expectedESW, res, 'preview buy 19000000 ESW for 5238.095225 ETH');
        });
        it('buyWithETHViewReverse: should not preview buy 19047620 ESW for ETH', async function () { // over 40000000 = 38095238.095238095*1.05
            this.isPreview = true;
            let expectedESW = money.ether('10476.190476190476125000').toString(); // 38095238.095238096 ESW * 1.05 = 40000000.000000001, exceeds 40000000
            let res = (await crowdSale.buyWithETHView(money.esw('38095238.095238095'), true, { from: bob }))[0].toString();
            assert.equal(expectedESW, res, 'preview buy 19000000 ESW for 5238.0955 ETH');
        });
        it('buyWithETHReverse: should not buy 38095238.095238096 ESW for 10476.19047619 ETH', async function () { // over 40000000 = 19047620*1.05*2 
            this.isPreview = true;
            await expectRevert(
                crowdSale.buyWithETH(alice, money.esw('38095238.095238096'), true, { from: bob, value: money.eth('10476.19047619')}),                
                'Sale:0 ETH'
            );
        });
        it('buyWithETHReverse: should not buy 5238.0955 ETH, it exceeds limit', async function () { // over 40000000.000036364 = 10476.1904762*400/0.11*1.05
            this.isPreview = true;
            await expectRevert(
                crowdSale.buyWithETH(alice, money.eth('10476.1904762'), false, { from: bob, value: money.eth('10476.1904762')}),
                'Sale:0 ETH'
            );
        });
        it('buyWithETHView: should preview buy 19047619 ESW for ETH', async function () { // close to 40000000 ~= 19047619*1.05*2
            this.isPreview = true;
            let expectedESW = money.ether('5238.095225').toString(); // 19047619 ESW = 5238.095225ETH * 400USD/ETH / 0.11DAI/ESW
            let res = (await crowdSale.buyWithETHView(expectedESW, false, { from: bob }))[0].toString();
            assert.equal(money.esw('19047619'), res, 'preview buy 19047619 ESW for 5238.095225 ETH');
        });
        it('should be working fine for 10 WEI ETH ', async function () {
            let tx = await crowdSale.sendTransaction({ from: bob, value: '10' });
            console.log(
                'Gas used: ' + tx.receipt.gasUsed, 
                'bob"s balance ', new BN(await esw.balanceOf2(bob)).toString(), 
                'foundation"s balance ', new BN(await esw.balanceOf2(foundation)).toString(),
                'RefDefault"s balance ', new BN(await esw.balanceOf2(RefDefault)).toString(),
                'team"s balance ', new BN (await esw.balanceOf2(team)).toString());
            assert.equal(
                '0', 
                new BN (await esw.balanceOf2(team)).toString(), "buyer+foundation value equal to team")
        });
        it('should mint an equal value of esw both to a buyer and owner', async function () {
            let tx = await crowdSale.sendTransaction({ from: bob, value: this.BuyWithETHTest.WEIValue });
            
            let bobBalance = new BN(await esw.balanceOf2(bob));
            let foundationBalance = new BN(await esw.balanceOf2(foundation));
            let RefDefaultBalance = new BN(await esw.balanceOf2(RefDefault));
            let teamBalance = new BN (await esw.balanceOf2(team));

            console.log('Gas used:', tx.receipt.gasUsed);
            assert.equal(
                '0', 
                teamBalance.toString(), "buyer+foundation value equal to team")
        });
        it('should mint an equal value of esw both to a buyer and owner with 1-lv referral', async function () {
            await ref.addReferral(bob, clarc);
            let tx = await crowdSale.sendTransaction({ from: bob, value: this.BuyWithETHTest.WEIValue });
            const BuyerBalance = await esw.balanceOf2(bob);
            const Ref1Balance = await esw.balanceOf2(clarc);

            console.log('Clarc as 1 level referral received 5%', (Ref1Balance / this.BuyWithETHTest.Decimals).toString(), 'ESW', 'gas used', await tx.receipt.gasUsed);
            assert.equal('0', new BN(Ref1Balance).toString(), '1-lv referral must be 0.05% of buyer\'s');
        });
        it('buyWithETH, should mint an equal value of esw both to a buyer and owner with 1-lv referral', async function () {
            let tx = await crowdSale.buyWithETH(clarc, this.BuyWithETHTest.WEIValue, false, { from: bob, value: this.BuyWithETHTest.WEIValue });
            const BuyerBalance = await esw.balanceOf2(bob);
            const Ref1Balance = await esw.balanceOf2(clarc);

            console.log('Clarc as 1 level referral received 5%', (Ref1Balance / this.BuyWithETHTest.Decimals).toString(), 'ESW', 'gas used', await tx.receipt.gasUsed);
            assert.equal('0', new BN(Ref1Balance).toString(), '1-lv referral must be 0.05% of buyer\'s');
        });
        it('buyWithETH, should emit Event with 1-lv referral', async function () {
            let tx = await crowdSale.buyWithETH(clarc, this.BuyWithETHTest.WEIValue, false, { from: bob, value: this.BuyWithETHTest.WEIValue });
            expectEvent(tx.receipt, 'Buy', 
                { account: bob, amount: '7272727272727272727272', coinId: '999', coinAmount: '2000000000000000000', referral: clarc});
        });
        it('buyWithETH exact ESW, should mint 7000 esw both to buyer and get 1.925 ETH from buyer', async function () { // 7000 * 0.11 / 400 = 1.925
            let tx = await crowdSale.buyWithETH(clarc, money.esw('7000'), true, { from: bob, value: money.eth('1.925') });
            const BuyerBalance = await esw.balanceOf2(bob);
            const Ref1Balance = await esw.balanceOf2(clarc);

            console.log('Clarc as 1 level referral received 5%', (Ref1Balance / this.BuyWithETHTest.Decimals).toString(), 'ESW', 'gas used', await tx.receipt.gasUsed);
            assert.equal('0', new BN(Ref1Balance).toString(), '1-lv referral must be 0.05% of buyer\'s');
        });
        it('buyWithETH exact ESW, expect revert of buying 7000 esw both for 1.92 ETH', async function () { // 7000 * 0.11 / 400 = 1.925
            this.isPreview = true;
            await expectRevert(
                crowdSale.buyWithETH(clarc, money.esw('7000'), true, { from: bob, value: money.eth('1.92') }),
                'Sale:0 ETH'
            );
        });
        it('buyWithETH exact ESW, expect revert of buying 7000 esw both for ZERO ETH', async function () { // 7000 * 0.11 / 400 = 1.925
            this.isPreview = true;
            await expectRevert(
                crowdSale.buyWithETH(clarc, money.esw('7000'), true, { from: bob, value: money.eth('0') }),
                'Sale:ETH needed'
            );
        });
        it('buyWithETH exact ESW, expect revert of buying 7000 esw both for 1.926 ETH', async function () { // 7000 * 0.11 / 400 = 1.925
            this.isPreview = true;
            await expectRevert(
                crowdSale.buyWithETH(clarc, money.esw('7000'), true, { from: bob, value: money.eth('1.926') }),
                'Sale:0 ETH'
            );
        });
        it('buyWithETH, should mint an equal value of esw both to a buyer and owner with 1-lv referral', async function () {
            let tx = await crowdSale.buyWithETH(clarc, this.BuyWithETHTest.WEIValue, false, { from: bob, value: this.BuyWithETHTest.WEIValue });
            const BuyerBalance = await esw.balanceOf2(bob);
            const Ref1Balance = await esw.balanceOf2(clarc);

            console.log('Clarc as 1 level referral received 5%', (Ref1Balance / this.BuyWithETHTest.Decimals).toString(), 'ESW', 'gas used', await tx.receipt.gasUsed);
            assert.equal('0', new BN(Ref1Balance).toString(), '1-lv referral must be 0.05% of buyer\'s');
        });
        it('buyWithETH exact ESW, should mint an equal value of esw both to a buyer and owner with 1-lv referral', async function () {
            let tx = await crowdSale.buyWithETH(clarc, this.BuyWithETHTest.WEIValue, false, { from: bob, value: this.BuyWithETHTest.WEIValue });
            const BuyerBalance = await esw.balanceOf2(bob);
            const Ref1Balance = await esw.balanceOf2(clarc);

            console.log('Clarc as 1 level referral received 5%', (Ref1Balance / this.BuyWithETHTest.Decimals).toString(), 'ESW', 'gas used', await tx.receipt.gasUsed);
            assert.equal('0', new BN(Ref1Balance).toString(), '1-lv referral must be 0.05% of buyer\'s');
        });
        it('should mint an equal value of esw both to a buyer and owner with 2-lv referral', async function () {
            await ref.addReferral(bob, clarc);
            await ref.addReferral(clarc, dave);
            let tx = await crowdSale.sendTransaction({ from: bob, value: this.BuyWithETHTest.WEIValue });
            const BuyerBalance = await esw.balanceOf2(bob);
            const Ref1Balance = await esw.balanceOf2(clarc);
            const Ref2Balance = await esw.balanceOf2(dave);

            console.log('Clarc as 1 level referral received 5%', (Ref1Balance / this.BuyWithETHTest.Decimals).toString(), 'ESW', 'gas used', await tx.receipt.gasUsed);
            assert.equal('0', new BN(Ref1Balance).toString(), '1-lv referral must be 0.05% of buyer\'s');
            console.log('Dave  as 2 level referral received 3%', (Ref2Balance / this.BuyWithETHTest.Decimals).toString(), 'ESW');
            assert.equal('0', new BN(Ref2Balance).toString(), '2-lv referral must be 0.03% of buyer\'s');
        });
        it('buyWithETH, should mint an equal value of esw both to a buyer and owner with 2-lv referral', async function () {
            await ref.addReferral(clarc, dave);
            let tx = await crowdSale.buyWithETH(clarc, this.BuyWithETHTest.WEIValue, false, { from: bob, value: this.BuyWithETHTest.WEIValue });
            const BuyerBalance = await esw.balanceOf2(bob);
            const Ref1Balance = await esw.balanceOf2(clarc);
            const Ref2Balance = await esw.balanceOf2(dave);

            console.log('Clarc as 1 level referral received 5%', (Ref1Balance / this.BuyWithETHTest.Decimals).toString(), 'ESW', 'gas used', await tx.receipt.gasUsed);
            assert.equal('0', new BN(Ref1Balance).toString(), '1-lv referral must be 0.05% of buyer\'s');
            console.log('Dave  as 2 level referral received 3%', (Ref2Balance / this.BuyWithETHTest.Decimals).toString(), 'ESW');
            assert.equal('0', new BN(Ref2Balance).toString(), '2-lv referral must be 0.03% of buyer\'s');
        });
        it('should mint an equal value of esw both to a buyer and owner with 2-lv referral', async function () {
            await ref.addReferral(clarc, dave);
            let tx = await crowdSale.buyWithETH(clarc, this.BuyWithETHTest.WEIValue, false, { from: bob, value: this.BuyWithETHTest.WEIValue });
            const BuyerBalance = await esw.balanceOf2(bob);
            const Ref1Balance = await esw.balanceOf2(clarc);
            const Ref2Balance = await esw.balanceOf2(dave);

            console.log('Clarc as 1 level referral received 5%', (Ref1Balance / this.BuyWithETHTest.Decimals).toString(), 'ESW', 'gas used', await tx.receipt.gasUsed);
            assert.equal('0', new BN(Ref1Balance).toString(), '1-lv referral must be 0.05% of buyer\'s');
            console.log('Dave  as 2 level referral received 3%', (Ref2Balance / this.BuyWithETHTest.Decimals).toString(), 'ESW');
            assert.equal('0', new BN(Ref2Balance).toString(), '2-lv referral must be 0.03% of buyer\'s');
        });
        it('should mint an equal value of esw both to a buyer and owner with 3-lv referral', async function () {
            await ref.addReferral(bob, clarc);
            await ref.addReferral(clarc, dave);
            await ref.addReferral(dave, eve);
            let tx = await crowdSale.sendTransaction({ from: bob, value: this.BuyWithETHTest.WEIValue });
            const BuyerBalance = await esw.balanceOf2(bob);
            const Ref1Balance = await esw.balanceOf2(clarc);
            const Ref2Balance = await esw.balanceOf2(dave);
            const Ref3Balance = await esw.balanceOf2(eve);

            console.log('Clarc as 1 level referral received 5%', (Ref1Balance / this.BuyWithETHTest.Decimals).toString(), 'ESW', 'gas used', await tx.receipt.gasUsed);
            assert.equal('0', new BN(Ref1Balance).toString(), '1-lv referral must be 0.05% of buyer\'s');
            console.log('Dave  as 2 level referral received 3%', (Ref2Balance / this.BuyWithETHTest.Decimals).toString(), 'ESW');
            assert.equal('0', new BN(Ref2Balance).toString(), '2-lv referral must be 0.03% of buyer\'s');
            console.log('Eve   as 3 level referral received 1%', (Ref3Balance / this.BuyWithETHTest.Decimals).toString(), 'ESW');
            assert.equal('0', new BN(Ref3Balance).toString(), '3-lv referral must be 0.01% of buyer\'s');
        });
        it('buyWithETH, should mint an equal value of esw both to a buyer and owner with 3-lv referral', async function () {
            await ref.addReferral(clarc, dave);
            await ref.addReferral(dave, eve);
            let tx = await crowdSale.buyWithETH(clarc, this.BuyWithETHTest.WEIValue, false, { from: bob, value: this.BuyWithETHTest.WEIValue });
            const BuyerBalance = await esw.balanceOf2(bob);
            const Ref1Balance = await esw.balanceOf2(clarc);
            const Ref2Balance = await esw.balanceOf2(dave);
            const Ref3Balance = await esw.balanceOf2(eve);

            console.log('Clarc as 1 level referral received 5%', (Ref1Balance / this.BuyWithETHTest.Decimals).toString(), 'ESW', 'gas used', await tx.receipt.gasUsed);
            assert.equal('0', new BN(Ref1Balance).toString(), '1-lv referral must be 0.05% of buyer\'s');
            console.log('Dave  as 2 level referral received 3%', (Ref2Balance / this.BuyWithETHTest.Decimals).toString(), 'ESW');
            assert.equal('0', new BN(Ref2Balance).toString(), '2-lv referral must be 0.03% of buyer\'s');
            console.log('Eve   as 3 level referral received 1%', (Ref3Balance / this.BuyWithETHTest.Decimals).toString(), 'ESW');
            assert.equal('0', new BN(Ref3Balance).toString(), '3-lv referral must be 0.01% of buyer\'s');
        });
        it('buyWithETH, should mint exact 70000 esw both to a buyer and owner with 3-lv referral', async function () { // 70000 * 0.11 / 400 = 19.25
            await ref.addReferral(clarc, dave);
            await ref.addReferral(dave, eve);            
            let neededETH = (await crowdSale.buyWithETHView(money.esw('70000'), true, { from: bob }))[0];
            this.BuyWithETHTest.WEIValue = neededETH
            let tx = await crowdSale.buyWithETH(clarc, money.esw('70000'), true, { from: bob, value: neededETH });
            const BuyerBalance = await esw.balanceOf2(bob);
            const Ref1Balance = await esw.balanceOf2(clarc);
            const Ref2Balance = await esw.balanceOf2(dave);
            const Ref3Balance = await esw.balanceOf2(eve);

            assert(neededETH.toString(), money.eth('19.25'), 'Must be exact 19.25 ETH');

            console.log('Clarc as 1 level referral received 5%', (Ref1Balance / this.BuyWithETHTest.Decimals).toString(), 'ESW', 'gas used', await tx.receipt.gasUsed);
            assert.equal('0', new BN(Ref1Balance).toString(), '1-lv referral must be 0.05% of buyer\'s');
            console.log('Dave  as 2 level referral received 3%', (Ref2Balance / this.BuyWithETHTest.Decimals).toString(), 'ESW');
            assert.equal('0', new BN(Ref2Balance).toString(), '2-lv referral must be 0.03% of buyer\'s');
            console.log('Eve   as 3 level referral received 1%', (Ref3Balance / this.BuyWithETHTest.Decimals).toString(), 'ESW');
            assert.equal('0', new BN(Ref3Balance).toString(), '3-lv referral must be 0.01% of buyer\'s');
        });
        afterEach(async function () {
            if (!this.isPreview) {
                assert.isAtLeast(new BN(await web3.eth.getBalance(foundation)).div(new BN(10).pow(new BN(18))).toNumber(), this.BalanceBefore.toNumber(), "Result balance must be greater!");
                const balance0 = new BN(await esw.balanceOf2(team)).div(new BN(this.BuyWithETHTest.Decimals)).toNumber();
                const balance2 = new BN(await esw.balanceOf2(bob)).div(new BN(this.BuyWithETHTest.Decimals)).toNumber();
    
                console.log('Bob bought ESW tokens for', web3.utils.fromWei(this.BuyWithETHTest.WEIValue.toString(), 'ether'), 'ETH and received', balance2, 'ESW tokens',
                    'balance0', balance0.toString(), 'balance2', balance2.toString());
                assert.isAtLeast(0, balance0);
            }
        });
    });

    describe('Buy with unregistered', () => {
        beforeEach(async function () {
            const USDXValue = money.usdx('1');
            const USDXdec = await usdx.decimals();
            const ESWdec = await esw.decimals();
            const Decimals = money.usdx('1');
            await unregistered_token.approve(crowdSale.address, USDXValue, { from: alice });
            this.BuyWithUSDX = { USDXValue: USDXValue, USDXdec: USDXdec, ESWdec: ESWdec, Decimals: Decimals };
            this.BalanceBefore = new BN(await usdx.balanceOf(foundation));
        });
        it('should return 0 from buyView', async function () {
            let res = (await crowdSale.buyView(unregistered_token.address, this.BuyWithUSDX.USDXValue, { from: alice }))[0].toString();
            assert.equal(res, '0', 'Preview buyView of unregistered token must return 0 value!');
        });
        it('should revert buy', async function () {
            await expectRevert(
                crowdSale.buy(unregistered_token.address, this.BuyWithUSDX.USDXValue, clarc, false, { from: alice }),
                'Sale:Coin not allowed'
            );
        });
        it('should return version', async function () {
            console.log('Version', (await crowdSale.codeVersion()).toString());
        });
    });

    describe('Buy with USDX (DAI), 1 ESW = 0.11 USDX (DAI) ', () => {
        beforeEach(async function () {
            const USDXValue = money.usdx('1');
            const USDXdec = await usdx.decimals();
            const ESWdec = await esw.decimals();
            const Decimals = money.usdx('1');
            this.isPreview = false;
            await usdx.approve(crowdSale.address, USDXValue, { from: alice });
            this.BuyWithUSDX = { USDXValue: USDXValue, USDXdec: USDXdec, ESWdec: ESWdec, Decimals: Decimals };
            this.BalanceBefore = new BN(await usdx.balanceOf(foundation));
        });
        it('should mint an equal value of esw both to a buyer and owner', async function () {
            let tx = await crowdSale.buy(usdx.address, this.BuyWithUSDX.USDXValue, '0x0000000000000000000000000000000000000000', false, { from: alice });
            console.log('Gas used:', tx.receipt.gasUsed);
            assert.equal(
                '0',
                new BN (await esw.balanceOf2(team)).toString(), "buyer+foundation value equal to team")
        });
        it('should mint an equal value of esw both to a buyer and owner ', async function () {
            await usdx.transfer(alice, money.usdx('2095238'));
            await usdx.approve(crowdSale.address, money.usdx('2095238'), { from: alice });
            await crowdSale.buy(usdx.address, money.dai('2095238'), '0x0000000000000000000000000000000000000000', false, { from: alice });
            assert.equal(
                new BN(await esw.balanceOf2(alice)).add(new BN(await esw.balanceOf2(foundation))).add(new BN(await esw.balanceOf2(RefDefault))).toString(),
                '19047618181818181818181818', "buyer+foundation value equal to team")
        });
        it('should emit Event to a buyer', async function () {
            await usdx.transfer(alice, money.usdx('2095238'));
            await usdx.approve(crowdSale.address, money.usdx('2095238'), { from: alice });
            let tx = await crowdSale.buy(usdx.address, money.dai('2095238'), '0x0000000000000000000000000000000000000000', false, { from: alice });
            expectEvent(tx.receipt, 'Buy', 
                { account: alice, amount: '19047618181818181818181818', coinId: '0', coinAmount: '2095238000000000000000000', referral: '0x0000000000000000000000000000000000000000'});
        });
        it('should emit Event to a buyer with referral', async function () {
            await usdx.transfer(alice, money.usdx('2095238'));
            await usdx.approve(crowdSale.address, money.usdx('2095238'), { from: alice });
            let tx = await crowdSale.buy(usdx.address, money.dai('2095238'), clarc, false, { from: alice });
            expectEvent(tx.receipt, 'Buy', 
                { account: alice, amount: '19047618181818181818181818', coinId: '0', coinAmount: '2095238000000000000000000', referral: clarc});
        });
        it('should emit Event to a buyer with referral with Reverse', async function () {
            await usdx.transfer(alice, money.usdx('2095238'));
            await usdx.approve(crowdSale.address, money.usdx('2095238'), { from: alice });
            let tx = await crowdSale.buy(usdx.address, '19047618181818181818181818', bob, true, { from: alice });
            expectEvent(tx.receipt, 'Buy', 
                { account: alice, amount: '19047618181818181818181818', coinId: '0', coinAmount: '2095237999999999999999999', referral: bob});
        });
        it('Buy exact ESW should mint an equal value of esw both to a buyer and owner ', async function () {
            await usdx.transfer(alice, money.usdx('2095238'));
            await usdx.approve(crowdSale.address, money.usdx('19047618'), { from: alice });
            await crowdSale.buy(usdx.address, money.esw('19047618'), '0x0000000000000000000000000000000000000000', true, { from: alice });
            console.log('Bought exact ESW 19047618', (await esw.balanceOf2(alice)).toString());
            assert.equal(
                new BN(await esw.balanceOf2(alice)).add(new BN(await esw.balanceOf2(foundation))).add(new BN(await esw.balanceOf2(RefDefault))).toString(),
                '19047618000000000000000000', "buyer+foundation value equal to team")
        });
        it('should revert for buy 38095240 ESW ', async function () { // 38095240 * 1.05 (=40000002) > 40000000
            this.isPreview = true;
            await usdx.transfer(alice, money.usdx('4190476.4'));
            await usdx.approve(crowdSale.address, money.usdx('4190476.4'), { from: alice });
            await expectRevert(
                crowdSale.buy(usdx.address, money.dai('4190476.4'), '0x0000000000000000000000000000000000000000', false, { from: alice }),
                'Sale:0 ESW'
            );
        });
        it('should revert for buy ESW with ZERO tokens ', async function () {
            await expectRevert(
                crowdSale.buy(usdx.address, money.dai('0'), '0x0000000000000000000000000000000000000000', false, { from: alice }),
                'Sale:amount needed'
            );
        });
        it('should revert for buy ESW with tokens more than allowence', async function () { 
            await expectRevert(
                crowdSale.buy(usdx.address, money.esw('10'), '0x0000000000000000000000000000000000000000', true, { from: alice }),
                'ERC20: transfer amount exceeds allowance'
            );
        });
        it('Buy exact ESW should revert for buy 38095240 ESW ', async function () { // 38095240 * 1.05 > 40000000
            this.isPreview = true;
            await usdx.transfer(alice, money.usdx('4190476.4'));
            await usdx.approve(crowdSale.address, money.usdx('4190476.4'), { from: alice });
            await expectRevert(
                crowdSale.buy(usdx.address, money.esw('38095240'), '0x0000000000000000000000000000000000000000', true, { from: alice }),
                'Sale:0 ESW'
            );
        });
        it('should not preview buy for 38095240 ESW ', async function () { // 38095240 * 1.05  > 40000000
            this.isPreview = true;
            let res = (await crowdSale.buyView(usdx.address, money.esw('38095240'), true))[0].toString();
            assert.equal(res, '0', "no preview for exceed total suply");
        });
        it('should preview buy for 38095238 ESW ', async function () { // 38095238 * 1.05  = 39999999.9
            this.isPreview = true;
            let res = (await crowdSale.buyView(usdx.address, money.esw('38095238'), true))[0].toString();
            assert.equal(res, '4190476180000000000000000', "preview for exceed total suply"); // 2095238.09 DAI
        });
        it('should preview buy for 10 ESW wei ', async function () {
            this.isPreview = true;
            let res = (await crowdSale.buyView(usdx.address, '10', true))[0].toString();
            assert.equal(res, '1', "preview for exceed total suply");
        });
        it('should mint an equal value of esw both to a buyer and owner with 1-lv referral', async function () {
            const BuyerBalance0 = await esw.balanceOf2(alice);
            await crowdSale.buy(usdx.address, this.BuyWithUSDX.USDXValue, clarc, false, { from: alice });
      
            const BuyerBalance = await esw.balanceOf2(alice);
            const Ref1Balance = await esw.balanceOf2(clarc);

            console.log('Clarc as 1 level referral received 5%', (Ref1Balance / this.BuyWithUSDX.Decimals).toString(), 'ESW');
            assert.equal('0', new BN(Ref1Balance).toString(), '1-lv referral must be 0.05% of buyer\'s');
        });
        it('should mint an equal value of esw both to a buyer and owner with 2-lv referral', async function () {
            await ref.addReferral(clarc, dave);
            await crowdSale.buy(usdx.address, this.BuyWithUSDX.USDXValue, clarc, false, { from: alice });
      
            const BuyerBalance = await esw.balanceOf2(alice);
            const Ref1Balance = await esw.balanceOf2(clarc);
            const Ref2Balance = await esw.balanceOf2(dave);

            console.log('Clarc as 1 level referral received 5%', (Ref1Balance / this.BuyWithUSDX.Decimals).toString(), 'ESW');
            assert.equal('0', new BN(Ref1Balance).toString(), '1-lv referral must be 0.05% of buyer\'s');
            console.log('Dave  as 2 level referral received 3%', (Ref2Balance / this.BuyWithUSDX.Decimals).toString(), 'ESW');
            assert.equal('0', new BN(Ref2Balance).toString(), '2-lv referral must be 0.03% of buyer\'s');
        });
        it('should mint an equal value of esw both to a buyer and owner with 3-lv referral', async function () {
            await ref.addReferral(clarc, dave);
            await ref.addReferral(dave, eve);
            await crowdSale.buy(usdx.address, this.BuyWithUSDX.USDXValue, clarc, false, { from: alice });
      
            const BuyerBalance = await esw.balanceOf2(alice);
            const Ref1Balance = await esw.balanceOf2(clarc);
            const Ref2Balance = await esw.balanceOf2(dave);
            const Ref3Balance = await esw.balanceOf2(eve);

            console.log('Clarc as 1 level referral received 5%', (Ref1Balance / this.BuyWithUSDX.Decimals).toString(), 'ESW');
            assert.equal('0', new BN(Ref1Balance).toString(), '1-lv referral must be 0.05% of buyer\'s');
            console.log('Dave  as 2 level referral received 3%', (Ref2Balance / this.BuyWithUSDX.Decimals).toString(), 'ESW');
            assert.equal('0', new BN(Ref2Balance).toString(), '2-lv referral must be 0.03% of buyer\'s');
            console.log('Eve   as 3 level referral received 1%', (Ref3Balance / this.BuyWithUSDX.Decimals).toString(), 'ESW');
            assert.equal('0', new BN(Ref3Balance).toString(), '3-lv referral must be 0.01% of buyer\'s');
        });
        it('Buy exact ESW should mint an equal value of esw both to a buyer and owner with 3-lv referral', async function () {
            await ref.addReferral(clarc, dave);
            await ref.addReferral(dave, eve);
            await usdx.transfer(alice, money.usdx('121'));
            await usdx.approve(crowdSale.address, money.usdx('121'), { from: alice });
            await crowdSale.buy(usdx.address, money.esw('1100'), clarc, true, { from: alice });
      
            const BuyerBalance = await esw.balanceOf2(alice);
            const Ref1Balance = await esw.balanceOf2(clarc);
            const Ref2Balance = await esw.balanceOf2(dave);
            const Ref3Balance = await esw.balanceOf2(eve);
            
            console.log('Alice bought', BuyerBalance.toString(), 'ESW for', (await usdx.balanceOf(foundation)).toString(), 'DAI')
            assert.equal(BuyerBalance.toString(), money.esw('1100').toString(), 'Alice bought 1100 ESW for DAI');
            assert.equal((await usdx.balanceOf(foundation)).toString(), money.usdx('121').toString(), 'Alice bought ESW for 121 DAI');
            console.log('Clarc as 1 level referral received 5%', (Ref1Balance / this.BuyWithUSDX.Decimals).toString(), 'ESW');
            assert.equal('0', new BN(Ref1Balance).toString(), '1-lv referral must be 0.05% of buyer\'s');
            console.log('Dave  as 2 level referral received 3%', (Ref2Balance / this.BuyWithUSDX.Decimals).toString(), 'ESW');
            assert.equal('0', new BN(Ref2Balance).toString(), '2-lv referral must be 0.03% of buyer\'s');
            console.log('Eve   as 3 level referral received 1%', (Ref3Balance / this.BuyWithUSDX.Decimals).toString(), 'ESW');
            assert.equal('0', new BN(Ref3Balance).toString(), '3-lv referral must be 0.01% of buyer\'s');
        });
        afterEach(async function () {
            if (!this.isPreview) {
                assert.isAtLeast(
                    new BN(await usdx.balanceOf(foundation)).div(new BN(this.BuyWithUSDX.Decimals)).toNumber(), 
                    new BN(this.BalanceBefore).div(new BN(this.BuyWithUSDX.Decimals)).toNumber(), "Result balance must be greater!");

                const balance0 = new BN(await esw.balanceOf2(team)).div(new BN(this.BuyWithUSDX.Decimals));
                const balance2 = new BN(await esw.balanceOf2(alice)).div(new BN(this.BuyWithUSDX.Decimals));
    
                console.log('Alice bought ESW tokens for', this.BuyWithUSDX.USDXValue / 10 ** this.BuyWithUSDX.USDXdec,
                    'USDX and received', balance2.toNumber(), 'ESW tokens');
    
                assert.isAtLeast(0, balance0.toNumber());
            };
        });
    });

    describe('Buy with USDY (EMRX), 1 ESW = 0.275 USDY (EMRX) ', () => {
        beforeEach(async function () {
            const USDYdec = await usdy.decimals();
            const USDYValue = money.usdy('10');
            const ESWdec = await esw.decimals();
            const Decimals = money.esw('1');
            await usdy.approve(crowdSale.address, USDYValue, { from: alice });
            this.BalanceBefore = new BN(await usdy.balanceOf(foundation));
            this.BuyWithUSDYTest = { USDYValue: USDYValue, USDYdec: USDYdec, ESWdec: ESWdec, Decimals: Decimals };
        });
        it('should preview buy for 3.636363636363636363 ESW ', async function () {
            this.isPreview = true;
            let res = (await crowdSale.buyView(usdy.address, money.esw('3.63636364'), true))[0].toString();
            assert.equal(res, money.usdy('1').toString(), "preview buy for 3.636363636363636363 ESW");
        });
        it('should not preview buy for 38095240 ESW ', async function () { // 38095240 * 1.05 > 40000000
            this.isPreview = true;
            let res = (await crowdSale.buyView(usdy.address, money.esw('38095240'), true))[0].toString();
            assert.equal(res, '0', "no preview for exceed total suply");
        });
        it('should preview buy for 38095238 ESW ', async function () { // 38095238 * 1.05 = 39999999.9
            this.isPreview = true;
            let res = (await crowdSale.buyView(usdy.address, money.esw('38095238'), true))[0].toString();
            assert.equal(res, money.usdy('10476190.45000000').toString(), "preview for exceed total suply"); // 10476190.45000000 EMRX
        });
        it('should preview buy tiny for 0.00001 ESW ', async function () { // 0.00001 * 0.275
            this.isPreview = true;
            let res = (await crowdSale.buyView(usdy.address, money.esw('0.00001'), true))[0].toString();
            assert.equal(res, money.usdy('0.00000275').toString(), "preview for exceed total suply");
        });
        it('should mint an equal value of esw both to a buyer and owner', async function () {
            await crowdSale.buy(usdy.address, this.BuyWithUSDYTest.USDYValue, '0x0000000000000000000000000000000000000000', false, { from: alice });
            assert.equal(
                '0', 
                new BN (await esw.balanceOf2(team)).toString(), "buyer+foundation value equal to team")
        });
        it('should mint an equal value of esw both to a buyer and owner with 1-lv referral', async function () {
            await crowdSale.buy(usdy.address, this.BuyWithUSDYTest.USDYValue, clarc, false, { from: alice });
      
            const BuyerBalance = await esw.balanceOf2(alice);
            const Ref1Balance = await esw.balanceOf2(clarc);

            console.log('Clarc as 1 level referral received 5%', (Ref1Balance / this.BuyWithUSDYTest.Decimals).toString(), 'ESW');
            assert.equal('0', new BN(Ref1Balance).toString(), '1-lv referral must be 0.05% of buyer\'s');
        });
        it('should mint an equal value of esw both to a buyer and owner with 2-lv referral', async function () {
            await ref.addReferral(clarc, dave);
            await crowdSale.buy(usdy.address, this.BuyWithUSDYTest.USDYValue, clarc, false, { from: alice });
      
            const BuyerBalance = await esw.balanceOf2(alice);
            const Ref1Balance = await esw.balanceOf2(clarc);
            const Ref2Balance = await esw.balanceOf2(dave);

            console.log('Clarc as 1 level referral received 5%', (Ref1Balance / this.BuyWithUSDYTest.Decimals).toString(), 'ESW');
            assert.equal('0', new BN(Ref1Balance).toString(), '1-lv referral must be 0.05% of buyer\'s');
            console.log('Dave  as 2 level referral received 3%', (Ref2Balance / this.BuyWithUSDYTest.Decimals).toString(), 'ESW');
            assert.equal('0', new BN(Ref2Balance).toString(), '2-lv referral must be 0.03% of buyer\'s');
        });
        it('should mint an equal value of esw both to a buyer and owner with 3-lv referral', async function () {
            await ref.addReferral(clarc, dave);
            await ref.addReferral(dave, eve);
            await crowdSale.buy(usdy.address, this.BuyWithUSDYTest.USDYValue, clarc, false, { from: alice });
      
            const BuyerBalance = await esw.balanceOf2(alice);
            const Ref1Balance = await esw.balanceOf2(clarc);
            const Ref2Balance = await esw.balanceOf2(dave);
            const Ref3Balance = await esw.balanceOf2(eve);

            console.log('Clarc as 1 level referral received 5%', (Ref1Balance / this.BuyWithUSDYTest.Decimals).toString(), 'ESW');
            assert.equal('0', new BN(Ref1Balance).toString(), '1-lv referral must be 0.05% of buyer\'s');
            console.log('Dave  as 2 level referral received 3%', (Ref2Balance / this.BuyWithUSDYTest.Decimals).toString(), 'ESW');
            assert.equal('0', new BN(Ref2Balance).toString(), '2-lv referral must be 0.03% of buyer\'s');
            console.log('Eve   as 3 level referral received 1%', (Ref3Balance / this.BuyWithUSDYTest.Decimals).toString(), 'ESW');
            assert.equal('0', new BN(Ref3Balance).toString(), '3-lv referral must be 0.01% of buyer\'s');
        });
        afterEach(async function () {
            if (!this.isPreview) {
                assert.isAtLeast(
                    new BN(await usdy.balanceOf(foundation)).div(new BN(this.BuyWithUSDYTest.Decimals)).toNumber(), 
                    new BN(this.BalanceBefore).div(new BN(this.BuyWithUSDYTest.Decimals)).toNumber(), "Result balance must be greater!");

                const balance0 = new BN(await esw.balanceOf2(team)).div(new BN(this.BuyWithUSDYTest.Decimals));
                const balance2 = new BN(await esw.balanceOf2(alice)).div(new BN(this.BuyWithUSDYTest.Decimals));
    
                console.log('Alice bought ESW tokens for', this.BuyWithUSDYTest.USDYValue / 10 ** this.BuyWithUSDYTest.USDYdec,
                    'USDY and received', balance2.toNumber(), 'ESW tokens');
    
                assert.isAtLeast(balance0.toNumber(), balance2.toNumber());
            };
        });
    });
  
    describe('Buy with USDC, 1 USDC = 9.000900090009 ESW', () => {
        beforeEach(async function () {
            const USDZdec = await usdz.decimals();
            const USDZValue = money.usdc('10');
            const ESWdec = await esw.decimals();
            const Decimals = money.esw('1');
            await usdz.approve(crowdSale.address, USDZValue, { from: alice });
            this.isPreview = false;
            this.BalanceBefore = new BN(await usdz.balanceOf(foundation));
            this.BuyWithUSDZTest = { USDZValue: USDZValue, USDZdec: USDZdec, ESWdec: ESWdec, Decimals: Decimals };
        });
        it('should preview buy 9.000900090009 ESW ', async function () {
            this.isPreview = true;
            let res = (await crowdSale.buyView(usdz.address, money.esw('9.000901'), true))[0].toString();
            assert.equal(res, money.usdc('1').toString(), "preview buy 9.000900090009 ESW");
        });
        it('should not preview buy for 38095240 ESW ', async function () { // 38095240 * 1.05 > 40000000
            this.isPreview = true;
            let res = (await crowdSale.buyView(usdz.address, money.esw('38095240'), true))[0].toString();
            assert.equal(res, '0', "no preview for exceed total suply");
        });
        it('should preview buy for 38095238 ESW ', async function () { // 38095238 * 1.05  = 39999999.9
            this.isPreview = true;
            let res = (await crowdSale.buyView(usdz.address, money.esw('38095238'), true))[0].toString();
            assert.equal(res, money.usdc('4232380.941800').toString(), "preview exceed total suply"); // 4232380.941800 USDC
        });
        it('should preview buy tiny for 0.00001 ESW ', async function () { // 0.00001 * 0.275
            this.isPreview = true;
            let res = (await crowdSale.buyView(usdz.address, money.esw('0.00001'), true))[0].toString();
            assert.equal(res, money.usdc('0.000001').toString(), "preview for exceed total suply");
        });
        it('should mint an equal value of esw both to a buyer and owner', async function () {
            await crowdSale.buy(usdz.address, this.BuyWithUSDZTest.USDZValue, '0x0000000000000000000000000000000000000000', false, { from: alice });
            assert.equal(
                '0',
                new BN (await esw.balanceOf2(team)).toString(), "buyer+foundation value equal to team")
        });
        it('should mint an equal value of esw both to a buyer and owner with 1-lv referral', async function () {
            let tx = await crowdSale.buy(usdz.address, this.BuyWithUSDZTest.USDZValue, clarc, false, { from: alice });
      
            const BuyerBalance = await esw.balanceOf2(alice);
            const Ref1Balance = await esw.balanceOf2(clarc);
            console.log('Clarc as 1 level referral received 5%', (Ref1Balance / this.BuyWithUSDZTest.Decimals).toString(), 'ESW', 'gas used', await tx.receipt.gasUsed);
            assert.equal('0', new BN(Ref1Balance).toString(), '1-lv referral must be 0.05% of buyer\'s');
        });
        it('Buy exact ESW should mint an equal value of esw both to a buyer and owner with 1-lv referral', async function () {
            await usdz.approve(crowdSale.address, money.usdc('100000'), { from: alice });
            let tx = await crowdSale.buy(usdz.address, money.esw('100'), clarc, true, { from: alice });
      
            const BuyerBalance = await esw.balanceOf2(alice);
            const Ref1Balance = await esw.balanceOf2(clarc);
            assert.equal(BuyerBalance.toString(), money.esw('100'), 'Alice bought 100 ESW for USDC');
            assert.equal((await usdz.balanceOf(foundation)).toString(), money.usdc('11.11').toString(), 'Alice bought ESW for');
            console.log('Clarc as 1 level referral received 5%', (Ref1Balance / this.BuyWithUSDZTest.Decimals).toString(), 'ESW', 'gas used', await tx.receipt.gasUsed);
            assert.equal('0', new BN(Ref1Balance).toString(), '1-lv referral must be 0.05% of buyer\'s');
        });
        it('should mint an equal value of esw both to a buyer and owner with 2-lv referral', async function () {
            await ref.addReferral(clarc, dave);
            await crowdSale.buy(usdz.address, this.BuyWithUSDZTest.USDZValue, clarc, false, { from: alice });
      
            const BuyerBalance = await esw.balanceOf2(alice);
            const Ref1Balance = await esw.balanceOf2(clarc);
            const Ref2Balance = await esw.balanceOf2(dave);

            console.log('Clarc as 1 level referral received 5%', (Ref1Balance / this.BuyWithUSDZTest.Decimals).toString(), 'ESW');
            assert.equal('0', new BN(Ref1Balance).toString(), '1-lv referral must be 0.05% of buyer\'s');
            console.log('Dave  as 2 level referral received 3%', (Ref2Balance / this.BuyWithUSDZTest.Decimals).toString(), 'ESW');
            assert.equal('0', new BN(Ref2Balance).toString(), '2-lv referral must be 0.03% of buyer\'s');
        });
        it('should mint an equal value of esw both to a buyer and owner with 3-lv referral', async function () {
            await ref.addReferral(clarc, dave);
            await ref.addReferral(dave, eve);
            await crowdSale.buy(usdz.address, this.BuyWithUSDZTest.USDZValue, clarc, false, { from: alice });
      
            const BuyerBalance = await esw.balanceOf2(alice);
            const Ref1Balance = await esw.balanceOf2(clarc);
            const Ref2Balance = await esw.balanceOf2(dave);
            const Ref3Balance = await esw.balanceOf2(eve);

            console.log('Clarc as 1 level referral received 5%', (Ref1Balance / this.BuyWithUSDZTest.Decimals).toString(), 'ESW');
            assert.equal('0', new BN(Ref1Balance).toString(), '1-lv referral must be 0.05% of buyer\'s');
            console.log('Dave  as 2 level referral received 3%', (Ref2Balance / this.BuyWithUSDZTest.Decimals).toString(), 'ESW');
            assert.equal('0', new BN(Ref2Balance).toString(), '2-lv referral must be 0.03% of buyer\'s');
            console.log('Eve   as 3 level referral received 1%', (Ref3Balance / this.BuyWithUSDZTest.Decimals).toString(), 'ESW');
            assert.equal('0', new BN(Ref3Balance).toString(), '3-lv referral must be 0.01% of buyer\'s');
        });
        afterEach(async function () {
            if (!this.isPreview) {
                assert.isAtLeast(
                    new BN(await usdz.balanceOf(foundation)).div(new BN(this.BuyWithUSDZTest.Decimals)).toNumber(), 
                    new BN(this.BalanceBefore).div(new BN(this.BuyWithUSDZTest.Decimals)).toNumber(), "Result balance must be greater!");

                const balance0 = new BN(await esw.balanceOf2(team)).div(new BN(this.BuyWithUSDZTest.Decimals));
                const balance2 = new BN(await esw.balanceOf2(alice)).div(new BN(this.BuyWithUSDZTest.Decimals));
    
                console.log('Alice bought ESW tokens for', this.BuyWithUSDZTest.USDZValue / 10 ** this.BuyWithUSDZTest.USDZdec,
                    'USDC and received', balance2.toNumber(), 'ESW tokens');
    
                assert.isAtLeast(0, balance0.toNumber());
            };
        });
    });
  
    describe('Buy with WBTC, 1 WBTC = 91818.1818191 ESW', () => {
        beforeEach(async function () {
            const WBTCdec = await wbtc.decimals();
            const WBTCValue = money.wbtc('1');
            const ESWdec = await esw.decimals();            
            const Decimals = money.esw('1');
            this.isPreview = false;
            this.BalanceBefore = new BN(await wbtc.balanceOf(foundation));
            await wbtc.approve(crowdSale.address, WBTCValue, { from: alice });
            this.BuyWithWBTCTest = { WBTCValue: WBTCValue, WBTCdec: WBTCdec, ESWdec: ESWdec, Decimals: Decimals };
        });
        it('should preview buy 91818.1818191 ESW ', async function () {
            this.isPreview = true;
            let res = (await crowdSale.buyView(wbtc.address, money.esw('91818.182'), true))[0].toString();
            assert.equal(res, money.wbtc('1').toString(), "preview buy 91818.1818191 ESW");
        });
        it('should not preview buy for 38095240 ESW ', async function () { // 38095240 * 1.05 > 40000000
            this.isPreview = true;
            let res = (await crowdSale.buyView(wbtc.address, money.esw('38095240'), true))[0].toString();
            assert.equal(res, '0', "no preview for exceed total suply");
        });
        it('should preview buy for 38095238 ESW ', async function () { // 38095238 * 1.05 = 39999999.9
            this.isPreview = true;
            let res = (await crowdSale.buyView(wbtc.address, money.esw('38095238'), true))[0].toString();
            assert.equal(res, money.wbtc('414.89863168').toString(), "preview for exceed total suply"); // 414.89863168 WBTC
        });
        it('should preview buy tiny for 0.00001 ESW ', async function () { // 0.00001 * 0.275
            this.isPreview = true;
            let res = (await crowdSale.buyView(wbtc.address, money.esw('0.01'), true))[0].toString();
            assert.equal(res, money.wbtc('0.00000010').toString(), "preview for exceed total suply");
        });
        it('should mint an equal value of esw both to a buyer and owner', async function () {
            console.log("Alice balance before",(await wbtc.balanceOf(alice)).toString(), "Alice spend ", this.BuyWithWBTCTest.WBTCValue.toString());
            await crowdSale.buy(wbtc.address, this.BuyWithWBTCTest.WBTCValue, '0x0000000000000000000000000000000000000000', false, { from: alice });
            console.log("Alice balance after ",(await wbtc.balanceOf(alice)).toString());
            assert.equal(
                '0',
                new BN (await esw.balanceOf2(team)).toString(), "buyer+foundation value equal to team")
        });
        it('should mint an equal value of esw both to a buyer and owner with 1-lv referral', async function () {
            await crowdSale.buy(wbtc.address, this.BuyWithWBTCTest.WBTCValue, clarc, false, { from: alice });
      
            const BuyerBalance = await esw.balanceOf2(alice);
            const Ref1Balance = await esw.balanceOf2(clarc);
            console.log('Clarc as 1 level referral received 5%', (Ref1Balance / this.BuyWithWBTCTest.Decimals).toString(), 'ESW');
            assert.equal('0', new BN(Ref1Balance).toString(), '1-lv referral must be 0.05% of buyer\'s');
        });
        it('should mint an equal value of esw both to a buyer and owner with 1-lv referral', async function () {
            let tx = await crowdSale.buy(wbtc.address, this.BuyWithWBTCTest.WBTCValue, clarc, false, { from: alice });

            expectEvent(tx.receipt, 'Buy', 
                { account: alice, amount: '91818181818181818181818', coinId: '3', coinAmount: this.BuyWithWBTCTest.WBTCValue, referral: clarc});
            
            await wbtc.approve(crowdSale.address, this.BuyWithWBTCTest.WBTCValue, { from: alice });
            tx = await crowdSale.buy(wbtc.address, this.BuyWithWBTCTest.WBTCValue, dave, false, { from: alice });

            expectEvent(tx.receipt, 'Buy', 
                { account: alice, amount: '91818181818181818181818', coinId: '3', coinAmount: this.BuyWithWBTCTest.WBTCValue, referral: clarc});
        });
        it('should mint an equal value of esw both to a buyer and owner with 2-lv referral', async function () {
            await ref.addReferral(clarc, dave);
            await crowdSale.buy(wbtc.address, this.BuyWithWBTCTest.WBTCValue, clarc, false, { from: alice });
      
            const BuyerBalance = await esw.balanceOf2(alice);
            const Ref1Balance = await esw.balanceOf2(clarc);
            const Ref2Balance = await esw.balanceOf2(dave);

            console.log('Clarc as 1 level referral received 5%', (Ref1Balance / this.BuyWithWBTCTest.Decimals).toString(), 'ESW');
            assert.equal('0', new BN(Ref1Balance).toString(), '1-lv referral must be 0.05% of buyer\'s');
            console.log('Dave  as 2 level referral received 3%', (Ref2Balance / this.BuyWithWBTCTest.Decimals).toString(), 'ESW');
            assert.equal('0', new BN(Ref2Balance).toString(), '2-lv referral must be 0.03% of buyer\'s');
        });
        it('should mint an equal value of esw both to a buyer and owner with 3-lv referral', async function () {
            await ref.addReferral(clarc, dave);
            await ref.addReferral(dave, eve);
            await crowdSale.buy(wbtc.address, this.BuyWithWBTCTest.WBTCValue, clarc, false, { from: alice });
      
            const BuyerBalance = await esw.balanceOf2(alice);
            const Ref1Balance = await esw.balanceOf2(clarc);
            const Ref2Balance = await esw.balanceOf2(dave);
            const Ref3Balance = await esw.balanceOf2(eve);

            console.log('Clarc as 1 level referral received 5%', (Ref1Balance / this.BuyWithWBTCTest.Decimals).toString(), 'ESW');
            assert.equal('0', new BN(Ref1Balance).toString(), '1-lv referral must be 0.05% of buyer\'s');
            console.log('Dave  as 2 level referral received 3%', (Ref2Balance / this.BuyWithWBTCTest.Decimals).toString(), 'ESW');
            assert.equal('0', new BN(Ref2Balance).toString(), '2-lv referral must be 0.03% of buyer\'s');
            console.log('Eve   as 3 level referral received 1%', (Ref3Balance / this.BuyWithWBTCTest.Decimals).toString(), 'ESW');
            assert.equal('0', new BN(Ref3Balance).toString(), '3-lv referral must be 0.01% of buyer\'s');
        });
        afterEach(async function () {
            if (!this.isPreview) {
                assert.isAtLeast(
                    new BN(await wbtc.balanceOf(foundation)).div(new BN(this.BuyWithWBTCTest.Decimals)).toNumber(), 
                    new BN(this.BalanceBefore).div(new BN(this.BuyWithWBTCTest.Decimals)).toNumber(), "Result balance must be greater!");

                const balance0 = new BN(await esw.balanceOf2(team)).div(new BN(this.BuyWithWBTCTest.Decimals)); ;
                const balance2 = new BN(await esw.balanceOf2(alice)).div(new BN(this.BuyWithWBTCTest.Decimals));
    
                console.log('Alice bought ESW tokens for', this.BuyWithWBTCTest.WBTCValue / 10 ** this.BuyWithWBTCTest.WBTCdec,
                    'WBTC and received', balance2.toNumber(), 'ESW tokens. Team ', balance0.toNumber(), 'ESW tokens');
    
                assert.isAtLeast(0, balance0.toNumber());
            };
        });
    });
    describe('Buy with WBTC, 436 WBTC = 40032648 ESW, awaitng revert', () => {        
        beforeEach(async function () {
            const WBTCdec = await wbtc.decimals();
            const WBTCValue = money.wbtc('436');
            const ESWdec = await esw.decimals();            
            const Decimals = money.esw('1');
            this.BalanceBefore = new BN(await wbtc.balanceOf(foundation));
            await wbtc.approve(crowdSale.address, WBTCValue, { from: alice });
            this.BuyWithWBTCTest = { WBTCValue: WBTCValue, WBTCdec: WBTCdec, ESWdec: ESWdec, Decimals: Decimals };
        });
        it('Should revert for trying to buy over 40_000_000 ESW', async function(){
            console.log("Alice balance before",(await wbtc.balanceOf(alice)).toString(), "Alice whant to spend ", money.wbtc('436').toString());
            await expectRevert(
                crowdSale.buy(wbtc.address, money.wbtc('436'), '0x0000000000000000000000000000000000000000', false, { from: alice }),
                'Sale:0 ESW',
            );
            console.log("Alice balance after ",(await wbtc.balanceOf(alice)).toString());
        });
        it('Should revert for trying to buy 40_009_693.5 over 40_000_000 ESW', async function(){
            console.log("Alice balance before",(await wbtc.balanceOf(alice)).toString(), "Alice whant to spend ", money.wbtc('415').toString());
            await expectRevert(
                crowdSale.buy(wbtc.address, money.wbtc('415'), '0x0000000000000000000000000000000000000000', false, { from: alice }),
                'Sale:0 ESW',
            );
            console.log("Alice balance after ",(await wbtc.balanceOf(alice)).toString());
        });
        it('Should work fine for trying to buy for 206.930693067 BTC (39_999_999 ESW)', async function(){
            console.log("Alice balance before",(await wbtc.balanceOf(alice)).toString(), "Alice whant to spend ", money.wbtc('206.930693067').toString());
            await crowdSale.buy(wbtc.address, money.wbtc('206.930693067'), '0x0000000000000000000000000000000000000000', false, { from: alice });
            console.log("Alice balance after ",(await wbtc.balanceOf(alice)).toString());
            console.log("Alice ESW balance after ", new BN(await esw.balanceOf2(alice)).add(new BN(await esw.balanceOf2(foundation))).toString());
            assert.equal(
                '0', 
                new BN (await esw.balanceOf2(team)).toString(), 
                "buyer+foundation value equal to team")
        });
        it('Should work fine for trying to buy 39_999_999 ESW', async function(){
            console.log("Alice balance before",(await wbtc.balanceOf(alice)).toString(), "Alice whant to buy ", money.esw('19000000').toString());
            await crowdSale.buy(wbtc.address, money.esw('19000000'), '0x0000000000000000000000000000000000000000', true, { from: alice });
            console.log("Alice balance after ",(await wbtc.balanceOf(alice)).toString());
            console.log("Alice ESW balance after ", new BN(await esw.balanceOf2(alice)).add(new BN(await esw.balanceOf2(foundation))).toString());
            assert.equal(
              '0', 
              new BN (await esw.balanceOf2(team)).toString(), 
              "buyer+foundation value equal to team")
        });
    });
    describe('Oracle sign sale for tokens buy exact ESW', () => {
        beforeEach('get sign and make tx', async function () { 
            // set oracle, check oracle
            this.ZEROref = '0x0000000000000000000000000000000000000000';
            await crowdSale.setOracle(oracleWallet, {from: proxyAdmin});
            let storedOracle = await crowdSale.getOracle();
            assert.equal(storedOracle, oracleWallet, 'Get stored Oracle address');
        });        
        describe('Oracle sign sale for DAI tokens buy exact ESW', async function () {
            beforeEach('prepare sign', async function () {
                // front part 
                // alice ask oracle signature to buy 100 ESW
                // get nonce (number of confirmed transactions) from contract, incrementing for coming transaction
                this.txCount = await crowdSale.getWalletNonce({from: alice}) + 1

                // oracle part
                // get purchase parameters and make hash of it
                let hash = web3.utils.soliditySha3(
                    alice,              // buyer wallet
                    usdx.address,       // token to spend
                    money.esw('1000'),  // if buy_kind == true -> ESW amount to buy if buy_kind == false -> amount of token to spend
                    this.ZEROref,       // referral wallet
                    true,               // buy_kind (true - exact ESW to purchase, false - exact token to spend)
                    this.txCount,       // nonce (tx number from front)
                    crowdSale.address   // crowdSale contract address
                );
                // oracle part
                // sign hash (paramentrs) with oracle_private_key -> get signature and send it back to front
                // core step, this signature contains oracle_wallet (from private key) and hashed parameters
                this.sigObject = await web3.eth.accounts.sign(hash, oracleWalletPriv)
            })
            it('should be same oracle wallet', async function() {
                // sign check, correct signature recover must return signer wallet
                let sigWallet = await web3.eth.accounts.recover(this.sigObject)
                assert.equal(oracleWallet, sigWallet, 'Signature wallet must be equal to recovered sigwallet');
            });
            it('ESW should be sold correctly to alice', async function () {
                // front part
                // make user approve tokens and call crowdSale.buySigned
                try {
                    await usdx.transfer(alice, money.usdx('10000'));
                    await usdx.approve(crowdSale.address, money.usdx('10000'), { from: alice });
                    let res = await crowdSale.buySigned(
                        usdx.address, 
                        money.esw('1000'), 
                        this.ZEROref, 
                        true, 
                        this.txCount,
                        this.sigObject.signature, 
                        {from: alice}
                    );
                    console.log('        buySigned gasUsed', await res.receipt.gasUsed);
                    expectEvent(res.receipt, 'Buy', { 
                        account: alice, 
                        amount: money.esw('1000'), 
                        coinId: '0', 
                        coinAmount: money.usdx('110'),
                        referral: this.ZEROref                });
                }  catch (error) {
                    console.log(error)
                }
            });
            it('FRAUD test - ESW should not be sold to bob', async function () {
                try {
                    await usdx.transfer(bob, money.usdx('10000'));
                    await usdx.approve(crowdSale.address, money.usdx('10000'), { from: bob });
                    await expectRevert(crowdSale.buySigned(
                        usdx.address, 
                        money.esw('1000'), 
                        this.ZEROref, 
                        true, 
                        this.txCount,
                        this.sigObject.signature, 
                        {from: bob}
                        ),
                        'CrowdSale:sign incorrect');
                }  catch (error) {
                    console.log(error)
                }
            });
            it('FRAUD test - ESW should not be sold to alice with changed params - more ESW', async function () {
                try {
                    await usdx.transfer(alice, money.usdx('10000'));
                    await usdx.approve(crowdSale.address, money.usdx('10000'), { from: alice });
                    await expectRevert(crowdSale.buySigned(
                        usdx.address, 
                        money.esw('10000'),
                        this.ZEROref, 
                        true, 
                        this.txCount,
                        this.sigObject.signature, 
                        {from: alice}
                        ),
                        'CrowdSale:sign incorrect');
                }  catch (error) {
                    console.log(error)
                }
            });
        })
        describe('Oracle sign sale ESW for exact DAI tokens', async function () {
            beforeEach('prepare sign', async function () {                
                // get nonce (number of confirmed transactions) from contract, incrementing for coming transaction
                this.txCount = await crowdSale.getWalletNonce({from: alice}) + 1

                // get purchase parameters and make hash of it
                let hash = web3.utils.soliditySha3(
                    alice,              // buyer wallet
                    usdx.address,       // token to spend
                    money.usdx('1100'),  // if buy_kind == true -> ESW amount to buy if buy_kind == false -> amount of token to spend
                    this.ZEROref,       // referral wallet
                    false,               // buy_kind (true - exact ESW to purchase, false - exact token to spend)
                    this.txCount,       // nonce (tx number from front)
                    crowdSale.address   // crowdSale contract address
                );
                
                // sign hash (paramentrs) with oracle_private_key -> get signature and send it back to front
                this.sigObject = await web3.eth.accounts.sign(hash, oracleWalletPriv)
            })
            it('should be same oracle wallet', async function() {
                // sign check, correct signature recover must return signer wallet
                let sigWallet = await web3.eth.accounts.recover(this.sigObject)
                assert.equal(oracleWallet, sigWallet, 'Signature wallet must be equal to recovered sigwallet');
            });
            it('ESW should be sold correctly to alice', async function () {
                // front part
                // make user approve tokens and call crowdSale.buySigned
                try {
                    await usdx.transfer(alice, money.usdx('10000'));
                    await usdx.approve(crowdSale.address, money.usdx('10000'), { from: alice });
                    let res = await crowdSale.buySigned(
                        usdx.address, 
                        money.usdx('1100'),
                        this.ZEROref, 
                        false, 
                        this.txCount,
                        this.sigObject.signature, 
                        {from: alice}
                    );
                    console.log('        buySigned gasUsed', await res.receipt.gasUsed);
                    expectEvent(res.receipt, 'Buy', { 
                        account: alice, 
                        amount: money.esw('10000'),
                        coinId: '0', 
                        coinAmount: money.usdx('1100'),
                        referral: this.ZEROref                });
                }  catch (error) {
                    console.log(error)
                }
            });
            it('FRAUD test - ESW should not be sold to bob', async function () {
                try {
                    await usdx.transfer(bob, money.usdx('10000'));
                    await usdx.approve(crowdSale.address, money.usdx('10000'), { from: bob });
                    await expectRevert(crowdSale.buySigned(
                        usdx.address, 
                        money.usdx('1100'),
                        this.ZEROref, 
                        false, 
                        this.txCount,
                        this.sigObject.signature, 
                        {from: bob} ),
                        'CrowdSale:sign incorrect');
                }  catch (error) {
                    console.log(error)
                }
            });
            it('FRAUD test - ESW should not be sold to alice with changed params - more ESW', async function () {
                try {
                    await usdx.transfer(alice, money.usdx('10000'));
                    await usdx.approve(crowdSale.address, money.usdx('10000'), { from: alice });
                    await expectRevert(crowdSale.buySigned(
                        usdx.address, 
                        money.usdx('110'),
                        this.ZEROref, 
                        false, 
                        this.txCount,
                        this.sigObject.signature, 
                        {from: bob} ),
                        'CrowdSale:sign incorrect');
                }  catch (error) {
                    console.log(error)
                }
            });
        })
        describe('Oracle sign sale for WBTC tokens buy exact ESW', async function () {
            beforeEach('prepare sign', async function () {
                // front part 
                // alice ask oracle signature to buy 100 ESW
                // get nonce (number of confirmed transactions) from contract, incrementing for coming transaction
                this.txCount = await crowdSale.getWalletNonce({from: alice}) + 1

                // oracle part
                // get purchase parameters and make hash of it
                let hash = web3.utils.soliditySha3(
                    alice,              // buyer wallet
                    wbtc.address,       // token to spend
                    money.esw('1000'),  // if buy_kind == true -> ESW amount to buy if buy_kind == false -> amount of token to spend
                    this.ZEROref,       // referral wallet
                    true,               // buy_kind (true - exact ESW to purchase, false - exact token to spend)
                    this.txCount,       // nonce (tx number from front)
                    crowdSale.address   // crowdSale contract address
                );
                // oracle part
                // sign hash (paramentrs) with oracle_private_key -> get signature and send it back to front
                // core step, this signature contains oracle_wallet (from private key) and hashed parameters
                this.sigObject = await web3.eth.accounts.sign(hash, oracleWalletPriv)
            })
            it('should be same oracle wallet', async function() {
                // sign check, correct signature recover must return signer wallet
                let sigWallet = await web3.eth.accounts.recover(this.sigObject)
                assert.equal(oracleWallet, sigWallet, 'Signature wallet must be equal to recovered sigwallet');
            });
            it('ESW should be sold correctly to alice', async function () {
                // front part
                // make user approve tokens and call crowdSale.buySigned
                try {
                    await wbtc.transfer(alice, money.wbtc('100'));
                    await wbtc.approve(crowdSale.address, money.wbtc('100'), { from: alice });
                    let res = await crowdSale.buySigned(
                        wbtc.address, 
                        money.esw('1000'), 
                        this.ZEROref, 
                        true, 
                        this.txCount,
                        this.sigObject.signature, 
                        {from: alice}
                    );
                    console.log('        buySigned gasUsed', await res.receipt.gasUsed);
                    expectEvent(res.receipt, 'Buy', { 
                        account: alice, 
                        amount: money.esw('1000'), 
                        coinId: '3', 
                        coinAmount: money.wbtc('0.01089108'),
                        referral: this.ZEROref                });
                }  catch (error) {
                    console.log(error)
                }
            });
            it('ESW should be sold to alice only one for one signature and not sold again with the same signature', async function () {
                // front part
                // make user approve tokens and call crowdSale.buySigned
                try {
                    await wbtc.transfer(alice, money.wbtc('100'));
                    await wbtc.approve(crowdSale.address, money.wbtc('100'), { from: alice });
                    let res = await crowdSale.buySigned(
                        wbtc.address, 
                        money.esw('1000'), 
                        this.ZEROref, 
                        true, 
                        this.txCount,
                        this.sigObject.signature, 
                        {from: alice}
                    );
                    console.log('        buySigned first time, gasUsed', await res.receipt.gasUsed);
                    expectEvent(res.receipt, 'Buy', { 
                        account: alice, 
                        amount: money.esw('1000'), 
                        coinId: '3', 
                        coinAmount: money.wbtc('0.01089108'),
                        referral: this.ZEROref                });
                }  catch (error) {
                    console.log(error)
                }

                try {
                    await wbtc.transfer(alice, money.wbtc('100'));
                    await wbtc.approve(crowdSale.address, money.wbtc('100'), { from: alice });
                    await expectRevert(crowdSale.buySigned(
                        wbtc.address, 
                        money.esw('1000'), 
                        this.ZEROref, 
                        true, 
                        this.txCount,
                        this.sigObject.signature, 
                        {from: alice}),
                        'CrowdSale:sign incorrect');
                }  catch (error) {
                    console.log(error)
                }
            });
            it('FRAUD test - ESW should not be sold to bob', async function () {
                try {
                    await usdx.transfer(bob, money.wbtc('100'));
                    await usdx.approve(crowdSale.address, money.wbtc('100'), { from: bob });
                    await expectRevert(crowdSale.buySigned(
                        wbtc.address, 
                        money.esw('1000'), 
                        this.ZEROref, 
                        true, 
                        this.txCount,
                        this.sigObject.signature, 
                        {from: bob}
                        ),
                        'CrowdSale:sign incorrect');
                }  catch (error) {
                    console.log(error)
                }
            });
            it('FRAUD test - ESW should not be sold to alice with changed params - more ESW', async function () {
                try {
                    await wbtc.transfer(alice, money.wbtc('100'));
                    await wbtc.approve(crowdSale.address, money.wbtc('100'), { from: alice });
                    await expectRevert(crowdSale.buySigned(
                        wbtc.address, 
                        money.esw('10000'),
                        this.ZEROref, 
                        true, 
                        this.txCount,
                        this.sigObject.signature, 
                        {from: alice}
                        ),
                        'CrowdSale:sign incorrect');
                }  catch (error) {
                    console.log(error)
                }
            });
            it('FRAUD test - ESW should not be sold to alice with changed params - changed token', async function () {
                try {
                    await usdz.transfer(alice, money.wbtc('10000'));
                    await usdz.approve(crowdSale.address, money.wbtc('10000'), { from: alice });
                    await expectRevert(crowdSale.buySigned(
                        usdz.address, 
                        money.esw('10000'),
                        this.ZEROref, 
                        true, 
                        this.txCount,
                        this.sigObject.signature, 
                        {from: alice}
                        ),
                        'CrowdSale:sign incorrect');
                }  catch (error) {
                    console.log(error)
                }
            });
            it('FRAUD test - ESW should not be sold to alice with changed params - changed referral -> bob', async function () {
                try {
                    await wbtc.transfer(alice, money.wbtc('100'));
                    await wbtc.approve(crowdSale.address, money.wbtc('100'), { from: alice });
                    await expectRevert(crowdSale.buySigned(
                        wbtc.address, 
                        money.esw('10000'),
                        bob,
                        true, 
                        this.txCount,
                        this.sigObject.signature, 
                        {from: alice}
                        ),
                        'CrowdSale:sign incorrect');
                }  catch (error) {
                    console.log(error)
                }
            });
        })
        describe('Oracle sign sale for ETH buy exact ESW', async function () {
            beforeEach('prepare sign', async function () {
                // front part 
                // alice ask oracle signature to buy 100 ESW
                // get nonce (number of confirmed transactions) from contract, incrementing for coming transaction
                this.txCount = await crowdSale.getWalletNonce({from: alice}) + 1;

                // oracle part
                // get purchase parameters and make hash of it
                let hash = web3.utils.soliditySha3(
                    alice,
                    this.ZEROref,       // referral wallet
                    money.esw('1000'),  // if buy_kind == true -> ESW amount to buy if buy_kind == false -> amount of token to spend
                    true,               // buy_kind (true - exact ESW to purchase, false - exact token to spend)
                    this.txCount,       // nonce (tx number from front)
                    crowdSale.address   // crowdSale contract address
                );
                // oracle part
                // sign hash (paramentrs) with oracle_private_key -> get signature and send it back to front
                // core step, this signature contains oracle_wallet (from private key) and hashed parameters
                this.sigObject = await web3.eth.accounts.sign(hash, oracleWalletPriv)
            })
            it('should be same oracle wallet', async function() {
                // sign check, correct signature recover must return signer wallet
                let sigWallet = await web3.eth.accounts.recover(this.sigObject)
                assert.equal(oracleWallet, sigWallet, 'Signature wallet must be equal to recovered sigwallet');
            });
            it('ESW should be sold correctly to alice', async function () { // 1000ESW * 0.11 DAI/ESW / 400DAI/ETH = 0.275 ETH
                // front part
                // make user approve tokens and call crowdSale.buySigned                
                let res = await crowdSale.buyWithETHSign(
                    alice,
                    this.ZEROref,
                    money.esw('1000'), 
                    true, 
                    this.txCount,
                    this.sigObject.signature,
                    {from: alice, value: money.eth('0.275')}
                );
                console.log('        buySigned gasUsed', await res.receipt.gasUsed);
                expectEvent(res.receipt, 'Buy', {
                    account: alice, 
                    amount: money.esw('1000'), 
                    coinId: '999', 
                    coinAmount: money.eth('0.275'),
                    referral: this.ZEROref});
            });
            it('FRAUD test - ESW should not be sold to bob', async function () {                
                await expectRevert(crowdSale.buyWithETHSign(
                        bob,
                        this.ZEROref,
                        money.esw('1000'), 
                        true, 
                        this.txCount,
                        this.sigObject.signature,
                        {from: bob, value: money.eth('0.275')}
                    ),
                    'CrowdSale:sign incorrect');
            });
            it('FRAUD test - ESW should not be sold to alice with changed params - more ESW', async function () {
                await expectRevert(crowdSale.buyWithETHSign(
                    alice,
                    this.ZEROref,
                    money.esw('100000'), 
                    true, 
                    this.txCount,
                    this.sigObject.signature,
                    {from: alice, value: money.eth('0.275')}
                ),
                'CrowdSale:sign incorrect');
            });
            it('FRAUD test - ESW should not be sold to alice with changed params - changed ETH value', async function () {
                await expectRevert(crowdSale.buyWithETHSign(
                    alice,
                    this.ZEROref,
                    money.esw('1000'), 
                    true, 
                    this.txCount,
                    this.sigObject.signature,
                    {from: alice, value: money.eth('0.075')}
                ),
                'Sale:0 ETH');
            });
            it('FRAUD test - ESW should not be sold to alice with changed params - changed referral -> bob', async function () {            
                await expectRevert(crowdSale.buyWithETHSign(
                    alice,
                    bob,
                    money.esw('1000'), 
                    true, 
                    this.txCount,
                    this.sigObject.signature,
                    {from: alice, value: money.eth('0.275')}
                ),
                'CrowdSale:sign incorrect');
            });
        });
        describe('Oracle sign sale for ETH buy exact ETH', async function () {
            beforeEach('prepare sign', async function () {
                // front part 
                // alice ask oracle signature to buy 100 ESW
                // get nonce (number of confirmed transactions) from contract, incrementing for coming transaction
                this.txCount = await crowdSale.getWalletNonce({from: alice}) + 1;

                // oracle part
                // get purchase parameters and make hash of it
                let hash = web3.utils.soliditySha3(
                    alice,
                    this.ZEROref,       // referral wallet
                    money.ether('1'),   // if buy_kind == true -> ESW amount to buy if buy_kind == false -> amount of ETH to spend
                    false,              // buy_kind (true - exact ESW to purchase, false - exact token to spend)
                    this.txCount,       // nonce (tx number from front)
                    crowdSale.address   // crowdSale contract address
                );
                // oracle part
                // sign hash (paramentrs) with oracle_private_key -> get signature and send it back to front
                // core step, this signature contains oracle_wallet (from private key) and hashed parameters
                this.sigObject = await web3.eth.accounts.sign(hash, oracleWalletPriv)
            })
            it('should be same oracle wallet', async function() {
                // sign check, correct signature recover must return signer wallet
                let sigWallet = await web3.eth.accounts.recover(this.sigObject)
                assert.equal(oracleWallet, sigWallet, 'Signature wallet must be equal to recovered sigwallet');
            });
            it('ESW should be sold correctly to alice', async function () { // 1000ESW * 0.11 DAI/ESW / 400DAI/ETH = 0.275 ETH
                // front part
                // make user approve tokens and call crowdSale.buySigned

                let res = await crowdSale.buyWithETHSign(
                    alice,
                    this.ZEROref,
                    money.ether('1'), 
                    false, 
                    this.txCount,
                    this.sigObject.signature,
                    {from: alice, value: money.eth('1')}
                );
                console.log('        buySigned gasUsed', await res.receipt.gasUsed);
                expectEvent(res.receipt, 'Buy', {
                    account: alice, 
                    amount: money.esw('3636.363636363636363636'),
                    coinId: '999', 
                    coinAmount: money.eth('1'),
                    referral: this.ZEROref});
            });
            it('FRAUD ESW should be sold correctly to alice only once ', async function () {
                await crowdSale.buyWithETHSign(
                    alice,
                    this.ZEROref,
                    money.ether('1'), 
                    false, 
                    this.txCount,
                    this.sigObject.signature,
                    {from: alice, value: money.eth('1')}
                );
                await expectRevert(crowdSale.buyWithETHSign(
                    alice,
                    this.ZEROref,
                    money.ether('1'), 
                    false, 
                    this.txCount,
                    this.sigObject.signature,
                    {from: alice, value: money.eth('1')}
                ),
                'CrowdSale:sign incorrect');
            });
            it('FRAUD test - ESW should not be sold to bob', async function () {                
                await expectRevert(crowdSale.buyWithETHSign(
                        bob,
                        this.ZEROref,
                        money.ether('1'), 
                        false, 
                        this.txCount,
                        this.sigObject.signature,
                        {from: bob, value: money.eth('1')}
                    ),
                    'CrowdSale:sign incorrect');
            });
            it('FRAUD test - ESW should not be sold to bob', async function () {                
                await expectRevert(crowdSale.buyWithETHSign(
                        alice,
                        this.ZEROref,
                        money.ether('1'), 
                        false, 
                        this.txCount + 1,
                        this.sigObject.signature,
                        {from: alice, value: money.eth('1')}
                    ),
                    'CrowdSale:sign incorrect');
            });
            it('FRAUD test - ESW should not be sold to alice with changed params - less ETH', async function () {
                await expectRevert(crowdSale.buyWithETHSign(
                    alice,
                    this.ZEROref,
                    money.ether('0.5'), 
                    false, 
                    this.txCount,
                    this.sigObject.signature,
                    {from: alice, value: money.eth('0.5')}
                ),
                'CrowdSale:sign incorrect');
            });
            it('FRAUD test - ESW should not be sold to alice with changed params - more ETH', async function () {
                await expectRevert(crowdSale.buyWithETHSign(
                    alice,
                    this.ZEROref,
                    money.ether('1.5'),
                    false, 
                    this.txCount,
                    this.sigObject.signature,
                    {from: alice, value: money.eth('1.5')}
                ),
                'CrowdSale:sign incorrect');
            });
            it('FRAUD test - ESW should not be sold to alice with changed params - changed ETH value', async function () {
                await expectRevert(crowdSale.buyWithETHSign(
                    alice,
                    this.ZEROref,
                    money.ether('1'),
                    false, 
                    this.txCount,
                    this.sigObject.signature,
                    {from: alice, value: money.eth('0.075')}
                ),
                'Sale:ETH needed');
            });
            it('FRAUD test - ESW should not be sold to alice with changed params - changed referral -> bob', async function () {            
                await expectRevert(crowdSale.buyWithETHSign(
                    alice,
                    bob,
                    money.ether('1'),
                    false, 
                    this.txCount,
                    this.sigObject.signature,
                    {from: alice, value: money.eth('1')}
                ),
                'CrowdSale:sign incorrect');
            });
        });
    });
});