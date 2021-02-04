// eslint-disable-next-line no-unused-vars
const { accounts, defaultSender } = require('@openzeppelin/test-environment');
const { ether, time, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { default: BigNumber } = require('bignumber.js');
const { assert } = require('chai');
const { contract } = require('./twrapper');

const EmiFactory = contract.fromArtifact('EmiFactory');
const Emiswap = contract.fromArtifact('Emiswap');
const EmiRouter = contract.fromArtifact('EmiRouter');
const UniswapV2Factory = contract.fromArtifact('UniswapV2Factory');
const UniswapV2Pair = contract.fromArtifact('UniswapV2Pair');
const MockUSDX = contract.fromArtifact('MockUSDX');
const MockUSDY = contract.fromArtifact('MockUSDY');
const MockUSDZ = contract.fromArtifact('MockUSDZ');
const MockWBTC = contract.fromArtifact('MockWBTC');
const EmiVamp = contract.fromArtifact('EmiVamp');
const Token = contract.fromArtifact('TokenMock');
const TokenWETH = contract.fromArtifact('MockWETH');
const EmiVoting = contract.fromArtifact('EmiVoting');
const Timelock = contract.fromArtifact('Timelock');

const { web3 } = MockUSDX;

MockUSDX.numberFormat = 'String';

// eslint-disable-next-line import/order
const { BN } = web3.utils;

let uniswapFactory;
let uniswapFactory2;
let uniswapPair;
let uniswapPairUSDX_WETH;
let uPair;
let usdx;
let usdy;
let usdz;
let weth;
let wbtc;
let vamp;
let emiVote;
let timelock;

const money = {
    ether,
    eth: ether,
    zero: ether('0'),
    weth: ether,
    dai: ether,
    usdx: ether,
    usdy: (value) => ether(value).div(new BN (1e10)),
    usdc: (value) => ether(value).div(new BN (1e12)),
    wbtc: (value) => ether(value).div(new BN (1e10)),
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

describe('EmiVamp test', function () {
    const [TestOwner, alice, bob, clarc, dave, eve, george, henry, ivan] = accounts;

    beforeEach(async function () {
        uniswapFactory = await UniswapV2Factory.new(TestOwner);
        uniswapFactory2 = await UniswapV2Factory.new(TestOwner);

        usdx = await MockUSDX.new();
        usdy = await MockUSDY.new();
        usdz = await MockUSDZ.new();
        weth = await TokenWETH.new();
        wbtc = await MockWBTC.new();
        vamp = await EmiVamp.new({from: henry});

        /* USDX - USDZ pair (DAI - USDC) */
        await uniswapFactory.createPair(weth.address, usdz.address);
        await uniswapFactory2.createPair(weth.address, usdz.address);

        const pairAddress = await uniswapFactory.getPair(weth.address, usdz.address);
        const pairAddress2 = await uniswapFactory2.getPair(weth.address, usdz.address);

        uniswapPair = await UniswapV2Pair.at(pairAddress);
        uPair2 = await UniswapV2Pair.at(pairAddress2);

        /* USDX - WETH pair (DAI - ETH) */
        await uniswapFactory.createPair(usdx.address, weth.address);
        await uniswapFactory2.createPair(usdx.address, weth.address);

        const pairAddressUSDX_WETH = await uniswapFactory.getPair(usdx.address, weth.address);
        uniswapPairUSDX_WETH = await UniswapV2Pair.at(pairAddressUSDX_WETH);

        const wethToPair = new BN(1).mul(new BN(10).pow(new BN(await weth.decimals()))).toString();
        const usdzToPair = new BN(40).mul(new BN(10).pow(new BN(await usdz.decimals()))).toString();
    
        const usdxToPair_USDXWETH = new BN(400).mul(new BN(10).pow(new BN(await usdx.decimals()))).toString();
        const wethToPair_USDXWETH = new BN(1).mul(new BN(10).pow(new BN(await weth.decimals()))).toString();

        await weth.deposit({ value: wethToPair });
        await weth.transfer(uPair2.address, wethToPair);
        await usdz.transfer(uPair2.address, usdzToPair);
        await uPair2.mint(bob);

        await weth.deposit({ value: wethToPair });
        await weth.transfer(uniswapPair.address, wethToPair);
        await usdz.transfer(uniswapPair.address, usdzToPair);
        await uniswapPair.mint(alice);
        let ttt = new BN(wethToPair);
        let ttt2 = new BN(usdzToPair);
        await weth.deposit({ value: ttt.mul(new BN(10)).toString()});
        await weth.transfer(uniswapPair.address, ttt.mul(new BN(10)).toString());
        await usdz.transfer(uniswapPair.address, ttt2.mul(new BN(10)).toString());
        await uniswapPair.mint(bob);

        await weth.deposit({ value: ttt.mul(new BN(30)).toString() });
        await weth.transfer(uniswapPair.address, ttt.mul(new BN(30)).toString());
        await usdz.transfer(uniswapPair.address, ttt2.mul(new BN(30)).toString());
        await uniswapPair.mint(dave);

        await usdx.transfer(bob, usdxToPair_USDXWETH);
        await usdx.transfer(uniswapPairUSDX_WETH.address, usdxToPair_USDXWETH);
        await weth.deposit({ value: wethToPair_USDXWETH });
        await weth.transfer(uniswapPairUSDX_WETH.address, wethToPair_USDXWETH);
        await uniswapPairUSDX_WETH.mint(alice); 
// Init router
        this.factory = await EmiFactory.new();

        await this.factory.setAdminGrant(TestOwner, true);
        await this.factory.setFee(money.weth('0.0030'), {from: TestOwner});
        //await this.factory.setAdminGrant(_owner, false);
        await this.factory.setFeeVault(money.weth('0.0005'), {from: TestOwner});
        await this.factory.setaddressVault(clarc, {from: TestOwner});

        this.router = await EmiRouter.new(this.factory.address, weth.address);
        this.timelock = await Timelock.new(TestOwner, 60*60*24*4);
        this.emiVote = await EmiVoting.new(this.timelock.address, usdx.address, TestOwner);

        await vamp.initialize([pairAddress, pairAddressUSDX_WETH], [0, 0], this.router.address, this.emiVote.address, {from:henry});
        await uniswapPair.approve(vamp.address, '1000000000000000000000000000', {from: alice});
        await uniswapPair.approve(this.router.address, '1000000000000000000000000000', {from: alice});
        await weth.approve(this.router.address, '1000000000000000000000000000', {from: alice});
        await usdz.approve(this.router.address, '1000000000000000000000000000', {from: alice});
        await usdx.approve(this.router.address, '1000000000000000000000000000', {from: alice});
        await weth.approve(vamp.address, '1000000000000000000000000000', {from: alice});
        await usdz.approve(vamp.address, '1000000000000000000000000000', {from: alice});
        await usdx.approve(vamp.address, '1000000000000000000000000000', {from: alice});
    });
    describe('Process allowed tokens lists', ()=> {
      it('should successfully get tokens list length under admin', async function () {
        let b = await vamp.getAllowedTokensLength({from: henry});
        console.log('We have %d allowed tokens', b);
        assert.equal(b, 0);
      });
      it('should successfully get tokens list length under non-admin wallet', async function () {
        let b = await vamp.getAllowedTokensLength();
        assert.equal(b, 0);
      });
      it('should successfully add tokens under admin', async function () {
        let tx = await vamp.addAllowedToken(weth.address, {from: henry});
        console.log('Adding allowed token gas used: %d', tx.receipt.gasUsed);
        await vamp.addAllowedToken(usdz.address, {from: henry});
        b = await vamp.getAllowedTokensLength({from: henry});
        console.log('Now we have %d allowed tokens', b);
        assert.equal(b, 2);
      });
      it('should successfully list tokens under admin', async function () {
        await vamp.addAllowedToken(weth.address, {from: henry});
        await vamp.addAllowedToken(usdz.address, {from: henry});
        b = await vamp.getAllowedTokensLength({from: henry});
        assert.equal(b, 2);
        b = await vamp.allowedTokens(0, {from: henry});
        assert.equal(b, weth.address);
        b = await vamp.allowedTokens(1, {from: henry});
        assert.equal(b, usdz.address);
      });
      it('should allow to list LP-tokens', async function () {
        let b = await vamp.lpTokensInfoLength();
        console.log(b);
        assert.equal(b, 2);
	b = await vamp.lpTokensInfo(0);
        assert.equal(b.lpToken, uniswapPair.address);
	b = await vamp.lpTokensInfo(1);
        assert.equal(b.lpToken, uniswapPairUSDX_WETH.address);
      });
      it('should succeed to list tokens under non-admin wallet', async function () {
        await vamp.addAllowedToken(usdz.address, {from: henry});
        let b = await vamp.allowedTokens(0);
        assert.equal(b, usdz.address);
      });
    });
    describe('Deposit LP-tokens to our contract', ()=> {
      it('should be transferring tokens successfully', async function () {
        let r = await uniswapPair.getReserves();
        console.log('Pair rsv: %d, %d', r[0].toString(), r[1].toString());
        let b = await uniswapPair.balanceOf(alice);
        console.log('Alice has %d LP-tokens', b);
        let tx = await vamp.deposit(0, 40000000, {from: alice});
        console.log('Gas used for LP-tokens transfer: ' + tx.receipt.gasUsed);
      });
    });
});
