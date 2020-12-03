// eslint-disable-next-line no-unused-vars
const { BN,
    constants,
    expectEvent,
    expectRevert,
    time,
    ether } = require('@openzeppelin/test-helpers');
  const BigNumber = web3.BigNumber;
  
  const { assert } = require('chai');
  
  const should = require('chai')
    //.use(require('chai-bignumber')(BigNumber))
    .should();
  
  const { contract } = require('./twrapper');
  
  const EmiVoting = contract.fromArtifact('EmiVoting');
  const MockUSDY = contract.fromArtifact('MockUSDY');
  
  let emiVote, usdy;
  
  describe('EmiVoting contract', () => {
    const initialOwner = accounts[0];
    const tokenPool = accounts[1];
    const userBob = accounts[2];
    const userAlice = accounts[3];
    let r = { logs:'' };
  
    beforeEach(async function () {
      this.emiVote = await EmiVoting.new();
      await this.emiVote.initialize(initialOwner);
    });
  
    describe('From ground zero we', async function () {  
      it('Can start new voting as admin', async function () {
          let releaseTime = (await time.latest()).add(time.duration.minutes(2));
          let h = Math.floor(Math.random() * 1000000);                      
          r = await this.emiVote.newUpgradeVoting(userBob, userAlice, releaseTime, h);
          expectEvent.inLogs(r.logs,'VotingCreated');
      });
  
      it('Can view voting as generic user', async function () {
        let releaseTime = (await time.latest()).add(time.duration.minutes(2));
        let h = Math.floor(Math.random() * 1000000);                      
        r = await this.emiVote.newUpgradeVoting(userBob, userAlice, releaseTime, h);
        expectEvent.inLogs(r.logs,'VotingCreated');
        let b = await this.emiVote.getVoting(h);
        console.log(b);
        assert.equal(b[0], userBob);
      });
  
      it('Can get voting list by ourself', async function () {
        let endTime = (await time.latest()).add(time.duration.days(90));
        r = await this.emiVote.newUpgradeVoting(accounts[3], accounts[4], endTime, 126);
        expectEvent.inLogs(r.logs,'VotingCreated');
  
        let b = await this.emiVote.getVotingLen();
        assert.equal(b, 1);
  
        b = await this.emiVote.getVotingHash(0);
        assert.equal(b, 126);
  
        b = await this.emiVote.getVoting(b);
        let t = new Date(b[2] * 1000);
  
        console.log("Voting address from: %s, address to: %s, endTime: %s, status: %s", b[0], b[1], t.toString(), b[3]);
        assert.equal(b[3], 0);
      });
  
      it('Can get voting result after time passes', async function () {
        let releaseTime = (await time.latest()).add(time.duration.minutes(2));
        let h = Math.floor(Math.random() * 1000000);                      
        let r = await this.emiVote.newUpgradeVoting(userBob, userAlice, releaseTime, h);
        expectEvent.inLogs(r.logs,'VotingCreated');
        await time.increaseTo(releaseTime.add(time.duration.minutes(4)));
        let b = await this.emiVote.getVoting(h);
        console.log(b);
        assert.equal(b[0], userBob);
      });
  
      it('Can get voting results', async function () {
        let releaseTime = (await time.latest()).add(time.duration.minutes(2));
        let h = Math.floor(Math.random() * 1000000);                      
        r = await this.emiVote.newUpgradeVoting(userBob, userAlice, releaseTime, h);
        expectEvent.inLogs(r.logs,'VotingCreated');
        await time.increaseTo(releaseTime.add(time.duration.minutes(4)));
        r = await this.emiVote.calcVotingResult(h);
        expectEvent.inLogs(r.logs,'VotingFinished');
        let b = await this.emiVote.getVotingResult(h);
        console.log(b);
        assert.equal(b, userAlice);
      });
    });
  });