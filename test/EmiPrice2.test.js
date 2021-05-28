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

	await time.increase(60 * 10); // increase time to 10 minutes

        // pairs with 4 links: z-x, zz-x, y-zz, y-wbtc, try to get price for z-wbtc
        await emiFactory.deploy(usdz.address, usdx.address);
        await emiFactory.deploy(usdzz.address, usdx.address);
        await emiFactory.deploy(usdy.address, usdzz.address);
        await emiFactory.deploy(usdy.address, wbtc.address);
        await emiFactory.deploy(usdzz.address, weth.address);

        let esp1 = await Emiswap.at(await emiFactory.pools(usdz.address, usdx.address));
                                                          
        await usdx.approve(esp1.address, money.usdx('1000000000'));
        await usdz.approve(esp1.address, money.usdc('1000000000'));
        console.log('Pair Z-X: USDX balance: %s, trying to deposit: %s', web3.utils.fromWei(await usdx.balanceOf(defaultSender)),
          web3.utils.fromWei(money.usdx('23')));
        console.log('Pair Z-X: USDZ balance: %s, trying to deposit: %s', await usdz.balanceOf(defaultSender),
          money.usdc('11'));

        if (usdz.address < usdx.address) {
          await esp1.deposit([money.usdc('11'), money.usdx('23')], [money.zero, money.zero], ZERO_ADDRESS);
        } else {
          await esp1.deposit([money.usdx('23'), money.usdc('11')], [money.zero, money.zero], ZERO_ADDRESS);
        }

	await time.increase(60 * 10); // increase time to 10 minutes

        let esp2 = await Emiswap.at(await emiFactory.pools(usdzz.address, usdx.address));
        await usdzz.approve(esp2.address, money.usdc('1000000000'));
        await usdx.approve(esp2.address, money.usdx('1000000000'));
        console.log('Pair ZZ-X: USDX balance: %s, trying to deposit: %s', web3.utils.fromWei(await usdx.balanceOf(defaultSender)),
          web3.utils.fromWei(money.usdx('400')));
        console.log('Pair ZZ-X: USDZZ balance: %s, trying to deposit: %s', await usdzz.balanceOf(defaultSender),
          money.usdc('12'));

        if (usdzz.address < usdx.address) {
          await esp2.deposit([money.usdc('12'), money.usdx('400')], [money.zero, money.zero], ZERO_ADDRESS);
        } else {
          await esp2.deposit([money.usdx('400'), money.usdc('12')], [money.zero, money.zero], ZERO_ADDRESS);
        }

	await time.increase(60 * 10); // increase time to 10 minutes

        let esp3 = await Emiswap.at(await emiFactory.pools(usdy.address, usdzz.address));
        await usdzz.approve(esp3.address, money.usdc('1000000000'));
        await usdy.approve(esp3.address, money.usdy('1000000000'));
        console.log('Pair ZZ-Y: USDY balance: %s, trying to deposit: %s', await usdy.balanceOf(defaultSender),
          money.usdy('41'));
        console.log('Pair ZZ-Y: USDZZ balance: %s, trying to deposit: %s', await usdzz.balanceOf(defaultSender),
          money.usdc('12'));

        if (usdzz.address < usdy.address) {
          await esp3.deposit([money.usdc('3'), money.usdy('41')], [money.zero, money.zero], ZERO_ADDRESS);
        } else {
          await esp3.deposit([money.usdy('41'), money.usdc('3')], [money.zero, money.zero], ZERO_ADDRESS);
        }

	await time.increase(60 * 10); // increase time to 10 minutes

        let esp4 = await Emiswap.at(await emiFactory.pools(usdy.address, wbtc.address));
        await wbtc.approve(esp4.address, money.wbtc('1000000000'));
        await usdy.approve(esp4.address, money.usdy('1000000000'));
        console.log('Pair WBTC-Y: USDY balance: %s, trying to deposit: %s', await usdy.balanceOf(defaultSender),
          money.usdy('2'));
        console.log('Pair WBTC-Y: WBTC balance: %s, trying to deposit: %s', await wbtc.balanceOf(defaultSender),
          money.wbtc('59'));

        if (wbtc.address < usdy.address) {
          await esp4.deposit([money.wbtc('59'), money.usdy('2')], [money.zero, money.zero], ZERO_ADDRESS);
        } else {
          await esp4.deposit([money.usdy('2'), money.wbtc('59')], [money.zero, money.zero], ZERO_ADDRESS);
        }

	await time.increase(60 * 10); // increase time to 10 minutes

        await weth.deposit({ value: money.weth('100') });

        let esp5 = await Emiswap.at(await emiFactory.pools(usdzz.address, weth.address));
        await weth.approve(esp5.address, money.weth('1000000000'));
        await usdzz.approve(esp5.address, money.usdc('1000000000'));

        console.log('Pair ZZ-WETH: WETH balance: %s, trying to deposit: %s', web3.utils.fromWei(await weth.balanceOf(defaultSender)),
          web3.utils.fromWei(money.weth('5')));
        console.log('Pair ZZ-WETH: USDZZ balance: %s, trying to deposit: %s', await usdzz.balanceOf(defaultSender),
          money.usdc('2'));

        if (weth.address < usdzz.address) {
          await esp5.deposit([money.weth('5'), money.usdc('2')], [money.zero, money.zero], ZERO_ADDRESS);
        } else {
          await esp5.deposit([money.usdc('2'), money.weth('5')], [money.zero, money.zero], ZERO_ADDRESS);
        }

	await time.increase(60 * 10); // increase time to 10 minutes

        // Init AKITA pair
        await emiFactory.deploy(akita.address, weth.address);

        await weth.deposit({ value: money.weth('10') });

        let akitaPair = await Emiswap.at(await emiFactory.pools(akita.address, weth.address));
        await weth.approve(akitaPair.address, money.weth('10000000000000'));
        await akita.approve(akitaPair.address, money.usdy('10000000000000'));
        if (weth.address < akita.address) {
          await akitaPair.deposit([money.weth('1'), money.usdy('33')], [money.zero, money.zero], ZERO_ADDRESS);
        } else {
          await akitaPair.deposit([money.usdy('33'), money.weth('1')], [money.zero, money.zero], ZERO_ADDRESS);
        }
	await time.increase(60 * 10); // increase time to 10 minutes
    });
    describe('get prices of coins', ()=> {
      it('should get Uniswap prices successfully', async function () {
        let b = await price.getCoinPrices([usdx.address, usdz.address, weth.address], [weth.address], 1);
        console.log('Got price results: %s, %s, %s', b[0].toString(), b[1].toString(), b[2].toString());

        let p0 = parseFloat(web3.utils.fromWei(b[0]));
        let p1 = parseFloat(web3.utils.fromWei(b[1]));
        let p2 = parseFloat(web3.utils.fromWei(b[2]));

        console.log('Price calc: %f, %f, %f', p0, p1, p2);

        assert.equal(b.length, 3);
        assert.isAtLeast(p0, 0.0025);
        assert.isAbove(p1, 0.99);
        assert.isAtLeast(p2, 0.9999);
      });
      it('should get Mooniswap prices successfully', async function () {
        let b = await price.getCoinPrices([usdx.address, wbtc.address], [usdx.address], 2);
        console.log('Got price results: %s, %s', b[0].toString(), b[1].toString());        

        let p0 = parseFloat(web3.utils.fromWei(b[0]));
        let p1 = parseFloat(web3.utils.fromWei(b[1]));

        console.log('Price calc: %f, %f', p0, p1);

        assert.equal(b.length, 2);
        assert.isAbove(p0, 319.999);
        assert.isAbove(p1, 0);
      });
      it('should get our prices successfully', async function () {
        console.log('Tokens: USDZ %s, USDX %s, USDZZ %s, USDY %s, WBTC %s', usdz.address, usdx.address, usdzz.address, usdy.address, wbtc.address);

        let route = await price.calcRoute(usdz.address, wbtc.address);
        console.log('Route to USDZ from WBTC: ', route);
        let b = await price.getCoinPrices([usdx.address, usdz.address, weth.address], [usdx.address, usdz.address], 0);
        console.log('Got price results: %s, %s, %s', b[0].toString(), b[1].toString(), b[2].toString());

        let p0 = parseFloat(web3.utils.fromWei(b[0]));
        let p1 = parseFloat(web3.utils.fromWei(b[1]));
        let p2 = parseFloat(web3.utils.fromWei(b[2]));

        console.log('Price calc: %f, %f, %f', p0, p1, p2);

        assert.equal(b.length, 3);
        assert.isAbove(p0, 0);
        assert.isAtLeast(p1, 0);
        assert.isAbove(p0, 0);
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
        let p = await price.calcRoute(usdz.address, wbtc.address);
        console.log('Route to USDZ from WBTC: ', p);

        let amt = await emiRouter.getAmountsOut(money.usdc('1'), p);
        console.log(amt);

        let b = await price.getCoinPrices([usdz.address],[wbtc.address], 0);
        console.log('Got price results: %s', b[0].toString());

        let p0 = parseFloat(web3.utils.fromWei(b[0]));

        console.log('Price calc: %f', p0);

        assert.equal(b.length, 1);
        assert.isAbove(p0, 0);
      });
      it('should get AKITA price successfully', async function () {
        console.log('Tokens: USDZ %s, USDX %s, USDZZ %s, USDY %s, WBTC %s, AKITA %s, WETH %s', usdz.address, usdx.address, usdzz.address, usdy.address, wbtc.address, akita.address, weth.address);

        let p = await price.calcRoute(akita.address, usdx.address);
        console.log('Route to AKITA from USDX: ', p);

        let b = await price.getCoinPrices([akita.address], [usdx.address], 0);
        console.log('Got price results: %s', b[0].toString());

        let amt = await emiRouter.getAmountsOut(money.usdy('1'), p);
        console.log(amt);

        let p0 = parseFloat(web3.utils.fromWei(b[0]));

        console.log('Price calc: %f', p0);

        assert.equal(b.length, 1);
        assert.isAbove(p0, 0);
      });
    });
});
