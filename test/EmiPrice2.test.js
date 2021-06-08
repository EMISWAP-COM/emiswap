// eslint-disable-next-line no-unused-vars
const { accounts, defaultSender } = require('@openzeppelin/test-environment');
const { ether, time, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { default: BigNumber } = require('bignumber.js');
const { assert } = require('chai');
const { contract } = require('./twrapper');

const UniswapV2Factory = contract.fromArtifact('UniswapV2Factory');
const UniswapV2Router = contract.fromArtifact('UniswapV2Router02');
const UniswapV2Pair = contract.fromArtifact('UniswapV2Pair');
const EmiFactory = contract.fromArtifact('EmiFactory');
const Emiswap = contract.fromArtifact('Emiswap');
const OneSplitFactory = contract.fromArtifact('OneSplitMock');
const EmiRouter = contract.fromArtifact('EmiRouter');
const MockUSDX = contract.fromArtifact('MockUSDX');
const MockUSDY = contract.fromArtifact('MockUSDY');
const MockUSDZ = contract.fromArtifact('MockUSDZ');
const MockWETH = contract.fromArtifact('MockWETH');
const MockWBTC = contract.fromArtifact('MockWBTC');
const EmiPrice = contract.fromArtifact('EmiPrice2');

const { web3 } = MockUSDX;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

MockUSDX.numberFormat = 'String';

// eslint-disable-next-line import/order
const { BN } = web3.utils;

let uniswapFactory;
let uniswapRouter;
let emiFactory;
let oneSplitFactory;
let emiRouter;
let uniswapPair;
let uPair;
let usdx;
let akita;
let usdy;
let usdz;
let usdzz;
let weth;
let wbtc;
let vamp;

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

describe('EmiPrice2 test', function () {
    const [TestOwner, alice, bob, clarc, dave, eve, george, henry, ivan] = accounts;

    beforeEach(async function () {

        usdxunk = await MockUSDX.new();

        usdx = await MockUSDX.new();
        usdy = await MockUSDY.new();
        usdz = await MockUSDZ.new();
        usdzz = await MockUSDZ.new();
        akita = await MockUSDY.new();
        weth = await MockWETH.new();
        wbtc = await MockWBTC.new();
        price = await EmiPrice.new();

        uniswapFactory = await UniswapV2Factory.new(TestOwner);
        emiFactory = await EmiFactory.new(TestOwner);
        emiRouter = await EmiRouter.new(emiFactory.address, weth.address);
        oneSplitFactory = await OneSplitFactory.new();
        uniswapRouter = await UniswapV2Router.new(uniswapFactory.address, weth.address);

        //console.log('init code', await uniswapFactory.getInitHash());

        await price.initialize(emiFactory.address, uniswapFactory.address, oneSplitFactory.address, emiRouter.address, uniswapRouter.address);

        /* USDX - USDZ pair (DAI - USDC) */
        await uniswapFactory.createPair(weth.address, usdz.address);

        const pairAddress = await uniswapFactory.getPair(weth.address, usdz.address);
        uniswapPair = await UniswapV2Pair.at(pairAddress);

        /* USDX - WETH pair (DAI - ETH) */
        await uniswapFactory.createPair(usdx.address, weth.address);

        const pairAddressUSDX_WETH = await uniswapFactory.getPair(usdx.address, weth.address);
        uniswapPairUSDX_WETH = await UniswapV2Pair.at(pairAddressUSDX_WETH);

        const wethToPair = new BN(1000).mul(new BN(10).pow(new BN(await weth.decimals()))).toString();
        const usdzToPair = new BN(4010).mul(new BN(10).pow(new BN(await usdz.decimals()))).toString();

        const usdxToPair_USDXWETH = new BN(400000).mul(new BN(10).pow(new BN(await usdx.decimals()))).toString();
        const wethToPair_USDXWETH = new BN(1000).mul(new BN(10).pow(new BN(await weth.decimals()))).toString();

        await weth.deposit({ value: wethToPair });
        await weth.transfer(uniswapPair.address, wethToPair);
        await usdz.transfer(uniswapPair.address, usdzToPair);
        await uniswapPair.mint(alice);
        let ttt = new BN(wethToPair);
        let ttt2 = new BN(usdzToPair);
        await weth.deposit({ value: ttt.toString()});
        await weth.transfer(uniswapPair.address, ttt.toString());
        await usdz.transfer(uniswapPair.address, ttt2.toString());
        await uniswapPair.mint(bob);

        await weth.deposit({ value: ttt.toString() });
        await weth.transfer(uniswapPair.address, ttt.toString());
        await usdz.transfer(uniswapPair.address, ttt2.toString());
        await uniswapPair.mint(dave);

        await usdx.transfer(bob, usdxToPair_USDXWETH);
        await usdx.transfer(uniswapPairUSDX_WETH.address, usdxToPair_USDXWETH);
        await weth.deposit({ value: wethToPair_USDXWETH });
        await weth.transfer(uniswapPairUSDX_WETH.address, wethToPair_USDXWETH);
        await uniswapPairUSDX_WETH.mint(alice);

        // pairs with 4 links: z-x,   zz-x,   y-zz, y-wbtc, try to get price for z-wbtc
        // pairs with 4 links: 11:23, 12:400, 41:3, 2:59,   try to get price for z-wbtc

        // usdz-usdx Add liquidity (11:23)
        await usdz.approve(emiRouter.address, money.usdc('1000000000'));
        await usdx.approve(emiRouter.address, money.usdx('1000000000'));
        await emiRouter.addLiquidity(
          usdz.address,
          usdx.address, 
          money.usdc('11'),
          money.usdx('23'),
          money.zero,
          money.zero,
          ZERO_ADDRESS);

        // usdzz-usdx Add liquidity (12:400)
        await usdzz.approve(emiRouter.address, money.usdc('1000000000'));
        await usdx.approve(emiRouter.address, money.usdx('1000000000'));
        await emiRouter.addLiquidity(
          usdzz.address, 
          usdx.address,
          money.usdc('12'),
          money.usdx('400'),
          money.zero,
          money.zero,
          ZERO_ADDRESS);

        // usdzz-usdy Add liquidity (3:41)
        await usdzz.approve(emiRouter.address, money.usdc('1000000000'));
        await usdy.approve(emiRouter.address, money.usdy('1000000000'));
        await emiRouter.addLiquidity(
          usdzz.address, 
          usdy.address,
          money.usdc('3'),
          money.usdy('41'),
          money.zero,
          money.zero,
          ZERO_ADDRESS);

        // wbtc-usdy Add liquidity (59:2)
        await wbtc.approve(emiRouter.address, money.wbtc('1000000000'));
        await usdy.approve(emiRouter.address, money.usdy('1000000000'));
        await emiRouter.addLiquidity(
          wbtc.address, 
          usdy.address,
          money.wbtc('59'),
          money.usdy('2'),
          money.zero,
          money.zero,
          ZERO_ADDRESS);

        // weth-usdzz Add liquidity (5:2)
        await weth.deposit({ value: money.weth('100') });
        await weth.approve(emiRouter.address, money.weth('1000000000'));
        await usdzz.approve(emiRouter.address, money.usdc('1000000000'));
        await emiRouter.addLiquidity(
          weth.address, 
          usdzz.address,
          money.weth('5'),
          money.usdc('2'),
          money.zero,
          money.zero,
          ZERO_ADDRESS);

        // Init AKITA pair

        // weth-usdzz Add liquidity (1:33)
        await weth.deposit({ value: money.weth('10') });
        await weth.approve(emiRouter.address, money.weth('1000000000'));
        await akita.approve(emiRouter.address, money.usdy('1000000000'));
        await emiRouter.addLiquidity(
          weth.address, 
          akita.address,
          money.weth('1'),
          money.usdy('33'),
          money.zero,
          money.zero,
          ZERO_ADDRESS);

	await time.increase(60 * 10); // increase time to 10 minutes
    });
    describe('get prices of coins', ()=> {
      it('should get Uniswap prices successfully', async function () {
        /* console.log('USDZ-WETH:');
        let amt = await uniswapRouter.getAmountsOut(money.usdc('1'), [usdz.address, weth.address]);
        amt.forEach(element => {
          console.log('amt', element.toString())
        }) */
        console.log('USDX-WETH:');
        amt = await uniswapRouter.getAmountsOut(money.usdx('1'), [usdx.address, weth.address]);
        amt.forEach(element => {
          console.log('amt', element.toString())
        })

        let b = await price.getCoinPrices([usdx.address, usdz.address, weth.address], [weth.address], 1);
        console.log('Got price results: %s, %s, %s', b[0].toString(), b[1].toString(), b[2].toString());

        let tt = await uniswapPair.getReserves();
        console.log('WETH-USDZ reserves: %s, %s', tt[0].toString(10), tt[1].toString(10));

        let p0 = parseFloat(web3.utils.fromWei(b[0]));
        let p1 = parseFloat(web3.utils.fromWei(b[1]));
        let p2 = parseFloat(web3.utils.fromWei(b[2]));

        console.log('Price calc: %f, %f, %f', p0, p1, p2);

        assert.equal(b.length, 3);
        assert.isAbove(p0, 0.0024);
        assert.isBelow(p0, 0.0025);
        assert.isAbove(p1, 0.24);
        assert.isBelow(p1, 0.25);
        assert.equal(p2, 1);
      });
      it('should get Mooniswap prices successfully', async function () {
        let b = await price.getCoinPrices([usdx.address, wbtc.address], [usdx.address], 2);
        console.log('Got price results: %s, %s', b[0].toString(), b[1].toString());

        let p0 = parseFloat(web3.utils.fromWei(b[0]));
        let p1 = parseFloat(web3.utils.fromWei(b[1]));

        console.log('Price calc: %f, %f', p0, p1);

        assert.equal(b.length, 2);
        assert.equal(p0, 320);
        assert.equal(p1, 3.2e-8);
      });
      it('should get our prices successfully', async function () {
        console.log('Tokens: USDZ %s, USDX %s, USDZZ %s, USDY %s, WETH %s', usdz.address, usdx.address, usdzz.address, usdy.address, weth.address);

        let route = await price.calcRoute(weth.address, usdx.address);
        console.log('Route to WETH from USDX: ', route);
        route = await price.calcRoute(weth.address, usdz.address);
        console.log('Route to WETH from USDZ: ', route);
        
        // take base token list by order, if first not found take next
        let b = await price.getCoinPrices([usdx.address, usdz.address, weth.address], [usdxunk.address /*token unknown*/, usdx.address], 0);
        console.log('Got price results: %s, %s, %s', b[0].toString(), b[1].toString(), b[2].toString());

        let p0 = parseFloat(web3.utils.fromWei(b[0]));
        let p1 = parseFloat(web3.utils.fromWei(b[1]));
        let p2 = parseFloat(web3.utils.fromWei(b[2]));

        console.log('Price calc: %f, %f, %f', p0, p1, p2);

        assert.equal(b.length, 3);
        assert.equal(p0, 1);
        assert.isAbove(p1, 1.91);
        assert.isBelow(p1, 1.917);
        assert.isAbove(p2, 10.81);
        assert.isBelow(p2, 10.811);
      });
      it('should get our direct prices successfully', async function () {
        let route = await price.calcRoute(usdzz.address, usdx.address);
        console.log('Route to USDZZ from USDX: ', route);
        
        // take base token list by order, if first not found take next
        let b = await price.getCoinPrices([usdx.address], [usdzz.address], 0);
        console.log('Got price results: %s', b[0].toString());

        let p0 = parseFloat(web3.utils.fromWei(b[0]));

        console.log('Price calc: %f', p0);

        assert.equal(b.length, 1);
        assert.isAbove(p0, 0.029);
        assert.isBelow(p0, 0.03);
      });

      it('should get base token prices successfully', async function () {
        let b = await price.getCoinPrices([usdx.address, usdz.address], [usdx.address, usdz.address], 0);
        console.log('Got price results: %s, %s', b[0].toString(), b[1].toString());

        let p0 = parseFloat(web3.utils.fromWei(b[0]));
        let p1 = parseFloat(web3.utils.fromWei(b[1]));

        console.log('Price calc: %f, %f', p0, p1);

        assert.equal(b.length, 2);
        assert.isAbove(p0, 0);
        assert.isAtLeast(p1, 0);
      });
      it('should get prices through 4 pairs successfully', async function () {
        console.log('Tokens: USDZ %s, USDX %s, USDZZ %s, USDY %s, WETH %s', usdz.address, usdx.address, usdzz.address, usdy.address, weth.address);
        let p = await price.calcRoute(usdz.address, wbtc.address);
        console.log('Route to USDZ from WBTC: ', p);

        let amt = await emiRouter.getAmountsOut(money.usdc('1'), p);
        amt.forEach(element => {
          console.log('amt', element.toString())
        })

        let b = await price.getCoinPrices([usdz.address], [wbtc.address], 0);
        console.log('Got price results: %s', b[0].toString());

        let p0 = parseFloat(web3.utils.fromWei(b[0]));

        console.log('Price calc: %f', p0);

        assert.equal(b.length, 1);
        assert.isAbove(p0, 16.36);
        assert.isBelow(p0, 16.37);
      });
      it('should get AKITA price successfully', async function () {
        console.log('Tokens: USDZ %s, USDX %s, USDZZ %s, USDY %s, WBTC %s, AKITA %s, WETH %s', usdz.address, usdx.address, usdzz.address, usdy.address, wbtc.address, akita.address, weth.address);

        let p = await price.calcRoute(akita.address, usdx.address);
        console.log('Route from AKITA to USDX: ', p);

        let b = await price.getCoinPrices([akita.address], [usdx.address], 0);
        console.log('Got price results: %s', b[0].toString());

        let amt = await emiRouter.getAmountsOut(money.usdy('1'), p);
        amt.forEach(element => {
          console.log('amt', element.toString())
        })

        let p0 = parseFloat(web3.utils.fromWei(b[0]));

        console.log('Price calc: %f', p0);

        assert.equal(b.length, 1);
        assert.isAbove(p0, 0.38);
        assert.isBelow(p0, 0.39);
      });
    });
});
