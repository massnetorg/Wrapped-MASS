const { BN, time } = require('@openzeppelin/test-helpers');
const { expect, use } = require('chai');
const { solidity } = require("ethereum-waffle");
use(solidity);

const LPMockToken = artifacts.require('ERC20Mock');
const WMASSToken = artifacts.require('WMASSToken');
const WMASSAirdrop = artifacts.require('WMASSAirdrop');

contract('WMASSAirdrop', (accounts) => {
    before(async function () {
        this.alice = accounts[0] // owner
        this.bob = accounts[1]
        this.carol = accounts[2]
    });

    context("With WMASS/LP token added to the field", function () {

        const ONE_BILLION = new BN("1000000000");
        const AIRDROP_PERIOD = new BN("20");

        beforeEach(async function () {
            this.wmass = await WMASSToken.new(ONE_BILLION);
            await this.wmass.mint(this.alice, "1000")
            await this.wmass.mint(this.bob, "1000")
            await this.wmass.mint(this.carol, "1000")

            this.lp = await LPMockToken.new("LPToken", "LP", ONE_BILLION)
            await this.lp.transfer(this.alice, "1000")
            await this.lp.transfer(this.bob, "1000")
            await this.lp.transfer(this.carol, "1000")

            this.airdrop = await WMASSAirdrop.new(this.wmass.address, AIRDROP_PERIOD);
        });

        it("should have correct initial states", async function () {
            const wmass = await this.airdrop.wmass();
            const wmassPerBlock = await this.airdrop.wmassPerBlock();
            const period = await this.airdrop.period();
            const startBlock = await this.airdrop.startBlock();
            const endBlock = await this.airdrop.endBlock();
            const totalAllocPoint = await this.airdrop.totalAllocPoint();
            const remaining = await this.airdrop.remainingAmount();

            expect(wmass, "WMASS LP").to.equal(this.wmass.address);
            expect(wmassPerBlock.toString(), "wmassPerBlock").to.equal("0");
            expect(period.toString(), "period").to.equal("20");
            expect(startBlock.toString(), "startBlock").to.equal("0");
            expect(endBlock.toString(), "endBlock").to.equal("0");
            expect(totalAllocPoint.toString(), "totalAllocPoint").to.equal("0");
            expect(remaining.toString(), "remaining").to.equal("0");
        });

        // ======== new airdrop ========

        it("should fail with incorrect amount or last airdrop not over", async function () {
            await this.wmass.approve(this.airdrop.address, "100000");
            await this.wmass.mint(this.alice, "3999"); // total 4999
            await expect(this.airdrop.newAirdrop("5000", "250", "100")).to.be.revertedWith("ERC20: transfer amount exceeds balance");
            await expect(this.airdrop.newAirdrop("4999", "250", "100")).to.be.revertedWith("Airdrop: too small amount");

            await this.wmass.mint(this.alice, "5001"); // total 10000
            await this.airdrop.newAirdrop("5000", "250", "100");
            let endBlock = await this.airdrop.endBlock();
            expect(endBlock.toString()).to.equal("120");

            await expect(this.airdrop.newAirdrop("5000", "250", "100")).to.be.revertedWith("Airdrop: last airdrop not over yet");
        });

        it("withdraw remaining airdrop amount when no LP pools", async function () {
            await this.wmass.approve(this.airdrop.address, "100000");
            await this.wmass.mint(this.alice, "9000"); // total 10000
            let cur = await time.latestBlock();
            await this.airdrop.newAirdrop("5000", "250", cur.addn(2)); // cur+1, start=cur+2, end=cur+22
            await time.advanceBlockTo(cur.addn(20));
            let remaining = await this.airdrop.getRemainingAmount();
            let aliceBalance = await this.wmass.balanceOf(this.alice);
            let airdropBalance = await this.wmass.balanceOf(this.airdrop.address);
            expect(remaining.toNumber()).to.equal(5000);
            expect(aliceBalance.toNumber()).to.equal(5000);
            expect(airdropBalance.toNumber()).to.equal(5000);
            await expect(this.airdrop.withdrawRemaining({ from: this.bob })).to.be.revertedWith("Ownable: caller is not the owner"); // cur+21
            await expect(this.airdrop.withdrawRemaining()).to.be.revertedWith("Airdrop: airdrop not over yet"); // cur+22

            await this.airdrop.withdrawRemaining(); // cur+23
            remaining = await this.airdrop.getRemainingAmount();
            aliceBalance = await this.wmass.balanceOf(this.alice);
            airdropBalance = await this.wmass.balanceOf(this.airdrop.address);
            expect(remaining.toNumber()).to.equal(0);
            expect(aliceBalance.toNumber()).to.equal(10000);
            expect(airdropBalance.toNumber()).to.equal(0);
        });

        // ======== LpToken existence ========

        it("add lp token normally", async function () {
            await this.airdrop.addLpToken(this.wmass.address, "100");
            let poolLength = await this.airdrop.poolLength();
            let totalAllocPoint = await this.airdrop.totalAllocPoint();
            expect(poolLength.toNumber()).to.equal(1);
            expect(totalAllocPoint.toNumber()).to.equal(100);

            await this.airdrop.addLpToken(this.lp.address, "100");
            poolLength = await this.airdrop.poolLength();
            totalAllocPoint = await this.airdrop.totalAllocPoint();
            expect(poolLength.toNumber()).to.equal(2);
            expect(totalAllocPoint.toNumber()).to.equal(200);

            let wmassPid = await this.airdrop.getPid(this.wmass.address);
            let lpPid = await this.airdrop.getPid(this.lp.address);
            expect(wmassPid.toNumber()).to.equal(0);
            expect(lpPid.toNumber()).to.equal(1);
        });

        it("set lp token normally", async function () {
            // set wmass
            await this.airdrop.addLpToken(this.wmass.address, "100");
            let wmassPool = await this.airdrop.poolInfos(0);
            let totalAllocPoint = await this.airdrop.totalAllocPoint();
            expect(totalAllocPoint.toNumber()).to.equal(100);
            expect(wmassPool.allocPoint.toNumber()).to.equal(100);
            expect(wmassPool.lpToken).to.equal(this.wmass.address);

            await this.airdrop.setLpToken(this.wmass.address, "200");
            wmassPool = await this.airdrop.poolInfos(0);
            totalAllocPoint = await this.airdrop.totalAllocPoint();
            expect(totalAllocPoint.toNumber()).to.equal(200);
            expect(wmassPool.allocPoint.toNumber()).to.equal(200);

            // set lp
            await this.airdrop.addLpToken(this.lp.address, "200");
            let lpPool = await this.airdrop.poolInfos(1);
            totalAllocPoint = await this.airdrop.totalAllocPoint();
            expect(totalAllocPoint.toNumber()).to.equal(400);
            expect(lpPool.allocPoint.toNumber()).to.equal(200);
            expect(lpPool.lpToken).to.equal(this.lp.address);

            await this.airdrop.setLpToken(this.lp.address, "300");
            lpPool = await this.airdrop.poolInfos(1);
            totalAllocPoint = await this.airdrop.totalAllocPoint();
            expect(totalAllocPoint.toNumber()).to.equal(500);
            expect(lpPool.allocPoint.toNumber()).to.equal(300);
        });

        it("should fail if add existing lp token", async function () {
            await this.airdrop.addLpToken(this.wmass.address, "100");
            await expect(this.airdrop.addLpToken(this.wmass.address, "200")).to.be.revertedWith("Airdrop: LP token already exist");

            await this.airdrop.addLpToken(this.lp.address, "100");
            await expect(this.airdrop.addLpToken(this.lp.address, "200")).to.be.revertedWith("Airdrop: LP token already exist");
        });

        it("should fail if lp token not exist", async function () {
            await expect(this.airdrop.setLpToken(this.wmass.address, "100")).to.be.revertedWith("Airdrop: LP token not exist");
            await expect(this.airdrop.getPid(this.wmass.address)).to.be.revertedWith("Airdrop: LP token not exist");
            await expect(this.airdrop.getUserLpBalance(this.wmass.address, this.alice)).to.be.revertedWith("Airdrop: LP token not exist");
            await expect(this.airdrop.getPendingReward(this.lp.address, this.alice)).to.be.revertedWith("Airdrop: LP token not exist");
            await expect(this.airdrop.deposit(this.wmass.address, "100", { from: this.bob })).to.be.revertedWith("Airdrop: LP token not exist");
            await expect(this.airdrop.withdraw(this.lp.address, "100", { from: this.bob })).to.be.revertedWith("Airdrop: LP token not exist");
            await expect(this.airdrop.withdrawAll(this.lp.address, { from: this.bob })).to.be.revertedWith("Airdrop: LP token not exist");
            await expect(this.airdrop.emergencyWithdraw(this.lp.address)).to.be.revertedWith("Airdrop: LP token not exist");
            await expect(this.airdrop.claim(this.wmass.address)).to.be.revertedWith("Airdrop: LP token not exist");
        });

        // ======== withdraw & claim ========

        it("should allow emergency withdraw", async function () {
            // wmass
            await this.airdrop.addLpToken(this.wmass.address, "100");
            await this.wmass.approve(this.airdrop.address, "1000", { from: this.bob });
            await this.airdrop.deposit(this.wmass.address, "100", { from: this.bob });
            expect((await this.wmass.balanceOf(this.bob)).toString()).to.equal("900")
            await this.airdrop.emergencyWithdraw(this.wmass.address, { from: this.bob })
            expect((await this.wmass.balanceOf(this.bob)).toString()).to.equal("1000")
            // other lp
            await this.airdrop.addLpToken(this.lp.address, "100");
            await this.lp.approve(this.airdrop.address, "1000", { from: this.carol });
            await this.airdrop.deposit(this.lp.address, "100", { from: this.carol });
            expect((await this.lp.balanceOf(this.carol)).toString()).to.equal("900")
            await this.airdrop.emergencyWithdraw(this.lp.address, { from: this.carol })
            expect((await this.lp.balanceOf(this.carol)).toString()).to.equal("1000")
        });

        it("withdraw all", async function () {
            await this.airdrop.addLpToken(this.wmass.address, "200");
            await this.wmass.approve(this.airdrop.address, "100000");
            await this.wmass.mint(this.alice, "4000"); // total 5000 (plus beforeEach)

            // 100 WMASS per block
            let cur = await time.latestBlock();
            await this.airdrop.newAirdrop("2000", "100", cur.addn(2)); // cur+1, start=cur+2, end=cur+22
            await this.airdrop.deposit(this.wmass.address, "10"); // cur+2
            await this.airdrop.addLpToken(this.lp.address, "100"); // cur+3
            let alicePending = await this.airdrop.getPendingReward(this.wmass.address, this.alice);
            let bobPending;
            expect(alicePending.toNumber()).to.equal(100);
            let remaining = await this.airdrop.getRemainingAmount();
            expect(remaining.toNumber()).to.equal(1900);

            await this.lp.approve(this.airdrop.address, "100000", { from: this.bob }); // cur+4, bob has 1000 LPs
            alicePending = await this.airdrop.getPendingReward(this.wmass.address, this.alice);
            bobPending = await this.airdrop.getPendingReward(this.lp.address, this.bob);
            expect(alicePending.toNumber()).to.equal(166);
            expect(bobPending.toNumber()).to.equal(0);
            remaining = await this.airdrop.getRemainingAmount();
            expect(remaining.toNumber()).to.equal(1834);

            await this.airdrop.deposit(this.lp.address, "10", { from: this.bob }); // cur+5
            alicePending = await this.airdrop.getPendingReward(this.wmass.address, this.alice);
            bobPending = await this.airdrop.getPendingReward(this.lp.address, this.bob);
            expect(alicePending.toNumber()).to.equal(233);
            expect(bobPending.toNumber()).to.equal(0);
            remaining = await this.airdrop.getRemainingAmount();
            expect(remaining.toNumber()).to.equal(1767);

            await time.advanceBlockTo(cur.addn(6));
            alicePending = await this.airdrop.getPendingReward(this.wmass.address, this.alice);
            bobPending = await this.airdrop.getPendingReward(this.lp.address, this.bob);
            expect(alicePending.toNumber()).to.equal(300);
            expect(bobPending.toNumber()).to.equal(33);
            remaining = await this.airdrop.getRemainingAmount();
            expect(remaining.toNumber()).to.equal(1667);

            await this.airdrop.withdrawAll(this.wmass.address); // cur+7
            alicePending = await this.airdrop.getPendingReward(this.wmass.address, this.alice);
            bobPending = await this.airdrop.getPendingReward(this.lp.address, this.bob);
            expect(alicePending.toNumber()).to.equal(0);
            expect(bobPending.toNumber()).to.equal(66);
            let aliceBalance = await this.wmass.balanceOf(this.alice);
            expect(aliceBalance.toNumber()).to.equal(3366);
            remaining = await this.airdrop.getRemainingAmount();
            expect(remaining.toNumber()).to.equal(1568);
        });

        it("claim pending rewards", async function () {
            await this.airdrop.addLpToken(this.wmass.address, "200");
            await this.wmass.approve(this.airdrop.address, "100000");
            await this.wmass.mint(this.alice, "4000"); // total 5000 (plus beforeEach)

            // 100 WMASS per block
            let cur = await time.latestBlock();
            await this.airdrop.newAirdrop("2000", "100", cur.addn(2)); // cur+1, start=cur+2, end=cur+22
            await this.airdrop.deposit(this.wmass.address, "10"); // cur+2
            await this.airdrop.addLpToken(this.lp.address, "100"); // cur+3

            await this.lp.approve(this.airdrop.address, "100000"); // cur+4, bob has 1000 LPs
            let alicePending = await this.airdrop.getPendingReward(this.wmass.address, this.alice);
            let aliceLpPending = await this.airdrop.getPendingReward(this.lp.address, this.alice);
            expect(alicePending.toNumber()).to.equal(166);
            expect(aliceLpPending.toNumber()).to.equal(0);

            await this.airdrop.deposit(this.lp.address, "10"); // cur+5

            await time.advanceBlockTo(cur.addn(6));
            alicePending = await this.airdrop.getPendingReward(this.wmass.address, this.alice);
            aliceLpPending = await this.airdrop.getPendingReward(this.lp.address, this.alice);
            expect(alicePending.toNumber()).to.equal(300);
            expect(aliceLpPending.toNumber()).to.equal(33);
            let remaining = await this.airdrop.getRemainingAmount();
            expect(remaining.toNumber()).to.equal(1667);

            // claim
            await this.airdrop.claim(this.wmass.address); // cur+7
            alicePending = await this.airdrop.getPendingReward(this.wmass.address, this.alice);
            aliceLpPending = await this.airdrop.getPendingReward(this.lp.address, this.alice);
            expect(alicePending.toNumber()).to.equal(0);
            expect(aliceLpPending.toNumber()).to.equal(66);
            let aliceBalance = await this.wmass.balanceOf(this.alice);
            expect(aliceBalance.toNumber()).to.equal(3356); // 2990 + 366
            remaining = await this.airdrop.getRemainingAmount();
            expect(remaining.toNumber()).to.equal(1568);

            await time.advanceBlockTo(cur.addn(8));
            alicePending = await this.airdrop.getPendingReward(this.wmass.address, this.alice);
            aliceLpPending = await this.airdrop.getPendingReward(this.lp.address, this.alice);
            expect(alicePending.toNumber()).to.equal(66);
            expect(aliceLpPending.toNumber()).to.equal(100);


            // claim all
            await this.airdrop.claimAll(); // cur+9
            alicePending = await this.airdrop.getPendingReward(this.wmass.address, this.alice);
            aliceLpPending = await this.airdrop.getPendingReward(this.lp.address, this.alice);
            expect(alicePending.toNumber()).to.equal(0);
            expect(aliceLpPending.toNumber()).to.equal(0);
            aliceBalance = await this.wmass.balanceOf(this.alice);
            expect(aliceBalance.toNumber()).to.equal(3622); // 2990 + 366 + 266
        });

        // ======== distribute ========

        it("should not distribute WMASSs if no one deposit WMASS", async function () {
            await this.airdrop.addLpToken(this.wmass.address, "100");
            await this.wmass.approve(this.airdrop.address, "100000");
            await this.wmass.approve(this.airdrop.address, "100000", { from: this.bob });
            await this.wmass.mint(this.alice, "4000"); // total 5000 (plus beforeEach)
            await this.wmass.mint(this.bob, "4000"); // total 5000 (plus beforeEach)

            let cur = await time.latestBlock();
            // 100 WMASS per block
            await this.airdrop.newAirdrop("2000", "100", cur.addn(2)); // cur+1
            expect((await this.wmass.balanceOf(this.airdrop.address)).toString()).to.equal("2000");
            let bobPending = await this.airdrop.getPendingReward(this.wmass.address, this.bob);
            expect(bobPending.toNumber()).to.equal(0);
            await time.advanceBlockTo(cur.addn(2));   // cur+2, start

            bobPending = await this.airdrop.getPendingReward(this.wmass.address, this.bob);
            expect(bobPending.toNumber()).to.equal(0);
            await time.advanceBlockTo(cur.addn(3));   // cur+3, start+1

            bobPending = await this.airdrop.getPendingReward(this.wmass.address, this.bob);
            expect(bobPending.toNumber()).to.equal(0);

            await this.airdrop.deposit(this.wmass.address, "10", { from: this.bob }); // cur+4, start+2
            bobPending = await this.airdrop.getPendingReward(this.wmass.address, this.bob);
            expect(bobPending.toNumber()).to.equal(0);
            expect((await this.wmass.balanceOf(this.bob)).toString()).to.equal("4990");
            expect((await this.wmass.balanceOf(this.airdrop.address)).toString()).to.equal("2010");

            await time.advanceBlockTo(cur.addn(5));   // cur+5, start+3
            bobPending = await this.airdrop.getPendingReward(this.wmass.address, this.bob);
            expect(bobPending.toNumber()).to.equal(100);

            await this.airdrop.withdraw(this.wmass.address, "10", { from: this.bob }); // cur+6, start+4
            expect((await this.wmass.balanceOf(this.bob)).toString()).to.equal("5200");
            expect((await this.wmass.balanceOf(this.airdrop.address)).toString()).to.equal("1800");
            expect((await time.latestBlock()).toNumber()).to.equal(cur.addn(6).toNumber());
        });

        it("should not distribute WMASSs if no one deposit LP", async function () {
            await this.airdrop.addLpToken(this.lp.address, "100");
            await this.wmass.approve(this.airdrop.address, "100000");
            await this.wmass.mint(this.alice, "1000"); // total 2000 (plus beforeEach)
            await this.lp.approve(this.airdrop.address, "100000", { from: this.bob });
            await this.lp.transfer(this.bob, "4000"); // total 5000 (plus beforeEach)

            let cur = await time.latestBlock();
            // 100 WMASS per block
            await this.airdrop.newAirdrop("2000", "100", cur.addn(2)); // cur+1
            expect((await this.wmass.balanceOf(this.airdrop.address)).toString()).to.equal("2000");
            expect((await this.wmass.balanceOf(this.alice)).toString()).to.equal("0");
            let bobPending = await this.airdrop.getPendingReward(this.lp.address, this.bob);
            expect(bobPending.toNumber()).to.equal(0);
            await time.advanceBlockTo(cur.addn(2));   // cur+2, start

            bobPending = await this.airdrop.getPendingReward(this.lp.address, this.bob);
            expect(bobPending.toNumber()).to.equal(0);
            await time.advanceBlockTo(cur.addn(3));   // cur+3, start+1

            bobPending = await this.airdrop.getPendingReward(this.lp.address, this.bob);
            expect(bobPending.toNumber()).to.equal(0);

            await this.airdrop.deposit(this.lp.address, "30", { from: this.bob }); // cur+4, start+2
            bobPending = await this.airdrop.getPendingReward(this.lp.address, this.bob);
            expect(bobPending.toNumber()).to.equal(0);
            expect((await this.lp.balanceOf(this.bob)).toString()).to.equal("4970");
            expect((await this.lp.balanceOf(this.airdrop.address)).toString()).to.equal("30");

            await time.advanceBlockTo(cur.addn(5));   // cur+5, start+3
            bobPending = await this.airdrop.getPendingReward(this.lp.address, this.bob);
            // 100 * 1e12 / 30 * 30 / 1e12
            expect(bobPending.toNumber()).to.equal(99);

            let remaining = await this.airdrop.getRemainingAmount();
            expect(remaining.toNumber()).to.equal(1900); // !!! not 1901
            expect((await this.wmass.balanceOf(this.alice)).toNumber()).to.equal(0);

            await this.airdrop.withdraw(this.lp.address, "30", { from: this.bob }); // cur+6, start+4
            expect((await this.lp.balanceOf(this.bob)).toString()).to.equal("5000");
            // bobPending is : 2 * 100 * 1e12 / 30 * 30 / 1e12
            expect((await this.wmass.balanceOf(this.bob)).toString()).to.equal("1199"); // plus mint in beforeEach
            expect((await this.wmass.balanceOf(this.airdrop.address)).toString()).to.equal("1801");
            expect((await time.latestBlock()).toNumber()).to.equal(cur.addn(6).toNumber());

            await time.advanceBlockTo(cur.addn(30));
            await this.airdrop.withdrawRemaining();
            expect((await this.wmass.balanceOf(this.alice)).toNumber()).to.equal(1800);
        });

        it("should stop giving bonus WMASSs after the bonus period ends (WMASS)", async function () {
            await this.airdrop.addLpToken(this.wmass.address, "100");
            await this.wmass.approve(this.airdrop.address, "100000");
            await this.wmass.approve(this.airdrop.address, "100000", { from: this.bob });
            await this.wmass.mint(this.alice, "4000"); // total 5000 (plus beforeEach)
            await this.wmass.mint(this.bob, "4000"); // total 5000 (plus beforeEach)

            let cur = await time.latestBlock();
            // 100 WMASS per block
            await this.airdrop.newAirdrop("2000", "100", cur.addn(2)); // cur+1, start=cur+2, end=cur+22
            await time.advanceBlockTo(cur.addn(17));   // cur+17, start+15

            await this.airdrop.deposit(this.wmass.address, "10", { from: this.bob }); // cur+18, start+16
            expect((await this.wmass.balanceOf(this.bob)).toString()).to.equal("4990");
            expect((await this.wmass.balanceOf(this.airdrop.address)).toString()).to.equal("2010");

            await time.advanceBlockTo(cur.addn(30));   // cur+30
            bobPending = await this.airdrop.getPendingReward(this.wmass.address, this.bob);
            expect(bobPending.toNumber()).to.equal(400);
            let remaining = await this.airdrop.getRemainingAmount();
            expect(remaining.toNumber()).to.equal(1600);

            await this.airdrop.withdraw(this.wmass.address, "10", { from: this.bob }); // cur+31
            expect((await this.wmass.balanceOf(this.bob)).toString()).to.equal("5400");
            expect((await this.wmass.balanceOf(this.airdrop.address)).toString()).to.equal("1600");
            expect((await time.latestBlock()).toNumber()).to.equal(cur.addn(31).toNumber());
            remaining = await this.airdrop.getRemainingAmount();
            expect(remaining.toNumber()).to.equal(1600);
        });

        it("should stop giving bonus WMASSs after the bonus period ends (LP)", async function () {
            await this.airdrop.addLpToken(this.lp.address, "100");
            await this.wmass.approve(this.airdrop.address, "100000");
            await this.wmass.mint(this.alice, "1000"); // total 2000 (plus beforeEach)
            await this.lp.approve(this.airdrop.address, "100000", { from: this.bob });
            await this.lp.transfer(this.bob, "4000"); // total 5000 (plus beforeEach)

            let cur = await time.latestBlock();
            // 100 WMASS per block
            await this.airdrop.newAirdrop("2000", "100", cur.addn(2)); // cur+1, start=cur+2, end=cur+22
            await time.advanceBlockTo(cur.addn(17));   // cur+17

            await this.airdrop.deposit(this.lp.address, "30", { from: this.bob }); // cur+18
            expect((await this.lp.balanceOf(this.bob)).toString()).to.equal("4970");
            expect((await this.lp.balanceOf(this.airdrop.address)).toString()).to.equal("30");

            await time.advanceBlockTo(cur.addn(21));   // cur+22
            bobPending = await this.airdrop.getPendingReward(this.lp.address, this.bob);
            expect(bobPending.toNumber()).to.equal(300); // 3 * 100 * 1e12 / 30 * 30 / 1e12

            await time.advanceBlockTo(cur.addn(22));   // cur+22
            bobPending = await this.airdrop.getPendingReward(this.lp.address, this.bob);
            expect(bobPending.toNumber()).to.equal(399); // 4 * 100 * 1e12 / 30 * 30 / 1e12

            await time.advanceBlockTo(cur.addn(30));   // cur+30
            bobPending = await this.airdrop.getPendingReward(this.lp.address, this.bob);
            expect(bobPending.toNumber()).to.equal(399); // 4 * 100 * 1e12 / 30 * 30 / 1e12

            let remaining = await this.airdrop.getRemainingAmount();
            expect(remaining.toNumber()).to.equal(1600); // !!! not 1601
            expect((await this.wmass.balanceOf(this.alice)).toNumber()).to.equal(0);

            await this.airdrop.withdraw(this.lp.address, "30", { from: this.bob }); // cur+31
            expect((await this.lp.balanceOf(this.bob)).toString()).to.equal("5000");
            expect((await this.wmass.balanceOf(this.bob)).toString()).to.equal("1399"); // plus mint in beforeEach
            expect((await this.wmass.balanceOf(this.airdrop.address)).toString()).to.equal("1601");
            expect((await time.latestBlock()).toNumber()).to.equal(cur.addn(31).toNumber());

            await this.airdrop.withdrawRemaining();
            expect((await this.wmass.balanceOf(this.alice)).toNumber()).to.equal(1600);
        });

        it("giving bonus cross airdrops", async function () {
            await this.airdrop.addLpToken(this.wmass.address, "100");
            await this.wmass.approve(this.airdrop.address, "100000");
            await this.wmass.mint(this.alice, "4000"); // total 5000 (plus beforeEach)

            // 100 WMASS per block
            let cur = await time.latestBlock();
            await this.airdrop.newAirdrop("2000", "100", cur.addn(2)); // cur+1, start=cur+2, end=cur+22
            await time.advanceBlockTo(cur.addn(17));   // cur+17, start+15

            await this.airdrop.deposit(this.wmass.address, "10"); // cur+18, start+16
            expect((await this.wmass.balanceOf(this.alice)).toString()).to.equal("2990");
            expect((await this.wmass.balanceOf(this.airdrop.address)).toString()).to.equal("2010");

            await time.advanceBlockTo(cur.addn(22));   // cur+22
            let alicePending = await this.airdrop.getPendingReward(this.wmass.address, this.alice);
            expect(alicePending.toNumber()).to.equal(400);

            await time.advanceBlockTo(cur.addn(24));
            await this.airdrop.newAirdrop("2000", "100", cur.addn(26)); // cur+25, start=cur+26, end=cur+46
            alicePending = await this.airdrop.getPendingReward(this.wmass.address, this.alice);
            expect(alicePending.toNumber()).to.equal(400);

            await time.advanceBlockTo(cur.addn(28));   // cur+28
            alicePending = await this.airdrop.getPendingReward(this.wmass.address, this.alice);
            expect(alicePending.toNumber()).to.equal(600);
        });

        it("giving bonus cross airdrops (LP)", async function () {
            await this.airdrop.addLpToken(this.lp.address, "100");
            await this.wmass.approve(this.airdrop.address, "100000");
            await this.wmass.mint(this.alice, "4000"); // total 5000 (plus beforeEach)
            await this.lp.approve(this.airdrop.address, "100000", { from: this.bob });

            // 100 WMASS per block
            let cur = await time.latestBlock();
            await this.airdrop.newAirdrop("2000", "100", cur.addn(2)); // cur+1, start=cur+2, end=cur+22
            await time.advanceBlockTo(cur.addn(17));   // cur+17, start+15

            await this.airdrop.deposit(this.lp.address, "10", { from: this.bob }); // cur+18, start+16
            expect((await this.lp.balanceOf(this.bob)).toString()).to.equal("990");
            expect((await this.lp.balanceOf(this.airdrop.address)).toString()).to.equal("10");
            expect((await this.wmass.balanceOf(this.airdrop.address)).toString()).to.equal("2000");

            await time.advanceBlockTo(cur.addn(22));   // cur+22
            let bobPending = await this.airdrop.getPendingReward(this.lp.address, this.bob);
            expect(bobPending.toNumber()).to.equal(400);

            let remaining = await this.airdrop.getRemainingAmount();
            expect(remaining.toNumber()).to.equal(1600); 

            await time.advanceBlockTo(cur.addn(24));
            await this.airdrop.newAirdrop("2000", "100", cur.addn(26)); // cur+25, start=cur+26, end=cur+46
            bobPending = await this.airdrop.getPendingReward(this.lp.address, this.bob);
            expect(bobPending.toNumber()).to.equal(400);

            remaining = await this.airdrop.getRemainingAmount();
            expect(remaining.toNumber()).to.equal(3600); 

            await time.advanceBlockTo(cur.addn(28));   // cur+28
            bobPending = await this.airdrop.getPendingReward(this.lp.address, this.bob);
            expect(bobPending.toNumber()).to.equal(600);

            remaining = await this.airdrop.getRemainingAmount();
            expect(remaining.toNumber()).to.equal(3400); 
        });
    });
});