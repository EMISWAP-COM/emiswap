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
  const MockUSDX = contract.fromArtifact('MockUSDX');
  const Timelock = contract.fromArtifact('Timelock');
  
  let emiVote, usdx, timelock;
  
  describe('EmiVoting contract', () => {
    const initialOwner = accounts[0];
    const tokenPool = accounts[1];
    const userBob = accounts[2];
    const userAlice = accounts[3];
    let r = { logs:'' };
  
    beforeEach(async function () {
      this.usdx = await MockUSDY.new();
      this.usdx.transfer(userBob, ether(3000000));
      this.timelock = await Timelock.new();
      this.emiVote = await EmiVoting.new(this.timelock.address, this.usdx.address, initialOwner);
    });
  
    describe('From ground zero we', async function () {  
      it('Can start new voting as admin', async function () {
          r = await this.emiVote.propose([this.timelock.address],[0],['Signature'],['0x1111'],'Test proposal', 40);
          expectEvent.inLogs(r.logs,'ProposalCreated');
      });
  
      it('Can view voting as generic user', async function () {
        r = await this.emiVote.propose([this.timelock.address],[0],['Signature'],['0x1111'],'Test proposal', 40);
        expectEvent.inLogs(r.logs,'ProposalCreated');
        let b = await this.emiVote.state(r.logs.topics[1]);
        console.log(b);
        assert.equal(b[0], 1);
      });
    
      it('Can get voting result after time passes', async function () {
        let releaseTime = (await time.latest()).add(time.duration.minutes(30));
        let h = Math.floor(Math.random() * 1000000);                      
        r = await this.emiVote.propose([this.timelock.address],[0],['Signature'],['0x1111'],'Test proposal', 40);
        expectEvent.inLogs(r.logs,'ProposalCreated');
        await this.emiVote.caseVote(r.logs.topics[1], true, {from: userBob});
        await time.increaseTo(releaseTime.add(time.duration.minutes(30)));
        let b = await this.emiVote.getVoting(r.logs.topics[1]);
        console.log(b);
        assert.equal(b[0], 3);
      });
  
      it('Can get voting results', async function () {
        let releaseTime = (await time.latest()).add(time.duration.minutes(30));
        let h = Math.floor(Math.random() * 1000000);                      
        r = await this.emiVote.propose([this.timelock.address],[0],['Signature'],['0x1111'],'Test proposal', 40);
        expectEvent.inLogs(r.logs,'ProposalCreated');
        await this.emiVote.caseVote(r.logs.topics[1], true, {from: userBob});
        await time.increaseTo(releaseTime.add(time.duration.minutes(30)));
        let b = await this.emiVote.getVotingResult(r.logs.topics[1]);
        console.log(b);
        assert.equal(b, this.timelock.address);
      });
    });
  });