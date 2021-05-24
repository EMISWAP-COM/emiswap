// eslint-disable-next-line no-unused-vars
const { accounts, defaultSender } = require('@openzeppelin/test-environment');
const { ether, time, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { default: BigNumber } = require('bignumber.js');
const { assert } = require('chai');
const { contract } = require('./twrapper');

const UniswapV2Factory = contract.fromArtifact('UniswapV2Factory');
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
let emiFactory;
let oneSplitFactory;
let emiRouter;
let uniswapPair;
let uPair;
let usdx;
let usdx4;
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

        usdx = await MockUSDX.new();
        usdy = await MockUSDY.new();
        usdz = await MockUSDZ.new();
        usdzz = await MockUSDZ.new();
        usdx4 = await MockUSDX.new();
        akita = await MockUSDY.new();
        weth = await MockWETH.new();
        wbtc = await MockWBTC.new();
        price = await EmiPrice.new();

        uniswapFactory = await UniswapV2Factory.new(TestOwner);
        emiFactory = await EmiFactory.new(TestOwner);
        emiRouter = await EmiRouter.new(emiFactory.address, weth.address);
        oneSplitFactory = await OneSplitFactory.new();

        await price.initialize(emiFactory.address, uniswapFactory.address, oneSplitFactory.address, emiRouter.address);

        /* USDX - USDZ pair (DAI - USDC) */
        await uniswapFactory.createPair(weth.address, usdz.address);

        const pairAddress = await uniswapFactory.getPair(weth.address, usdz.address);
        uniswapPair = await UniswapV2Pair.at(pairAddress);

        /* USDX - WETH pair (DAI - ETH) */
        await uniswapFactory.createPair(usdx.address, weth.address);

        const pairAddressUSDX_WETH = await uniswapFactory.getPair(usdx.address, weth.address);
        uniswapPairUSDX_WETH = await UniswapV2Pair.at(pairAddressUSDX_WETH);

        const wethToPair = new BN(100).mul(new BN(10).pow(new BN(await usdx.decimals()))).toString();
        const usdzToPair = new BN(101).mul(new BN(10).pow(new BN(await usdz.decimals()))).toString();
    
        const usdxToPair_USDXWETH = new BN(400).mul(new BN(10).pow(new BN(await usdx.decimals()))).toString();
        const wethToPair_USDXWETH = new BN(1).mul(new BN(10).pow(new BN(await weth.decimals()))).toString();

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
        // pairs with 4 links: z-x, zz-x, y-zz, y-wbtc, try to get price for z-wbtc
        await emiFactory.deploy(usdz.address, usdx.address);
        await emiFactory.deploy(usdzz.address, usdx.address);
        await emiFactory.deploy(usdy.address, usdzz.address);
        await emiFactory.deploy(usdy.address, wbtc.address);

        let esp1 = await Emiswap.at(await emiFactory.pools(usdz.address, usdx.address));
                                                          
        await usdx.approve(esp1.address, money.usdx('1000000000'));
        await usdz.approve(esp1.address, money.usdc('1000000000'));
        await esp1.deposit([money.usdx('1'), money.usdc('23')],[money.zero, money.zero], ZERO_ADDRESS);

        let esp2 = await Emiswap.at(await emiFactory.pools(usdzz.address, usdx.address));
        await usdzz.approve(esp2.address, money.usdc('1000000000'));
        await usdx.approve(esp2.address, money.usdx('1000000000'));
        await esp2.deposit([money.usdx('12'), money.usdc('400')],[money.zero, money.zero], ZERO_ADDRESS);

        let esp3 = await Emiswap.at(await emiFactory.pools(usdy.address, usdzz.address));
        await usdzz.approve(esp3.address, money.usdc('1000000000'));
        await usdy.approve(esp3.address, money.usdy('1000000000'));
        await esp3.deposit([money.usdc('41'), money.usdy('3')],[money.zero, money.zero], ZERO_ADDRESS);


        let esp4 = await Emiswap.at(await emiFactory.pools(usdy.address, wbtc.address));
        await wbtc.approve(esp4.address, money.wbtc('1000000000'));
        await usdy.approve(esp4.address, money.usdy('1000000000'));
        await esp4.deposit([money.usdy('2'), money.wbtc('591')],[money.zero, money.zero], ZERO_ADDRESS);
    });
    describe('get prices of coins', ()=> {
      it('should get Uniswap prices successfully', async function () {
        let b = await price.getCoinPrices([usdx.address, usdz.address, wbtc.address], [usdx.address, usdz.address, wbtc.address], 1);
        console.log('Got price results: %s, %s', b[0].toString(), b[1].toString());        

        let p0 = parseFloat(b[0].toString(10));
        let p1 = parseFloat(b[1].toString(10));

        console.log('Price calc: %f, %f', p0, p1);

        assert.equal(b.length, 3);
        assert.isAbove(p0, 0);
        assert.isAtLeast(p1, 0);
      });
      it('should get Mooniswap prices successfully', async function () {
        let b = await price.getCoinPrices([usdx.address, wbtc.address], [usdx.address, usdz.address, wbtc.address], 2);
        console.log('Got price results: %s, %s', b[0].toString(), b[1].toString());        

        let p0 = parseFloat(b[0].toString(10));
        let p1 = parseFloat(b[1].toString(10));

        console.log('Price calc: %f, %f', p0, p1);

        assert.equal(b.length, 2);
        assert.isAbove(p0, 0);
        assert.isAtLeast(p1, 0);
      });
      it('should get our prices successfully', async function () {
        let b = await price.getCoinPrices([usdx.address, usdz.address, weth.address], [usdx.address, usdz.address], 0);
        console.log('Got price results: %s, %s, %s', b[0].toString(), b[1].toString(), b[2].toString());

        let p0 = parseFloat(b[0].toString(10));
        let p1 = parseFloat(b[1].toString(10));
        let p2 = parseFloat(b[2].toString(10));

        console.log('Price calc: %f, %f, %f', p0, p1, p2);

        assert.equal(b.length, 3);
        assert.isAbove(p0, 0);
        assert.isAtLeast(p1, 0);
      });
      it('should get base token prices successfully', async function () {
        let b = await price.getCoinPrices([usdx.address, usdz.address], [usdx.address, usdz.address], 0);
        console.log('Got price results: %s, %s', b[0].toString(), b[1].toString());        

        let p0 = parseFloat(b[0].toString(10));
        let p1 = parseFloat(b[1].toString(10));

        console.log('Price calc: %f, %f', p0, p1);

        assert.equal(b.length, 2);
        assert.isAbove(p0, 0);
        assert.isAtLeast(p1, 0);
      });
      it('should get prices through 4 pairs successfully', async function () {
        let b = await price.getCoinPrices([usdz.address],[wbtc.address], 0);
        console.log('Got price results: %s', b[0].toString());

        let p0 = parseFloat(b[0].toString(10));

        console.log('Price calc: %f', p0);

        assert.equal(b.length, 1);
        assert.isAbove(p0, 0);
      });
      it('should get AKITA price successfully', async function () {
        let b = await price.getCoinPrices([akita.address], [usdx.address, usdz.address], 0);
        console.log('Got price results: %s', b[0].toString());

        let p0 = parseFloat(b[0].toString(10));

        console.log('Price calc: %f', p0);

        assert.equal(b.length, 1);
        assert.isAbove(p0, 0);
      });
    });
});
