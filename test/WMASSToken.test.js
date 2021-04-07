
const { BN, constants, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
// const { ZERO_ADDRESS } = constants;
const { expect, use } = require('chai');
const { solidity } = require("ethereum-waffle");
use(solidity);

const WMASSToken = artifacts.require('WMASSToken');

contract('WMASSToken', (accounts) => {

    const CAP = new BN("100000000000"); // 1000 tokens

    beforeEach(async function () {
        this.instance = await WMASSToken.new(CAP);
        this.alice = accounts[0] // owner
        this.bob = accounts[1]
        this.carol = accounts[2]
    });

    it("should have correct name and symbol and decimal", async function () {
        const name = await this.instance.name();
        const symbol = await this.instance.symbol();
        const decimals = await this.instance.decimals();
        expect(name, "token name").to.equal("Wrapped MASS");
        expect(symbol, "token symbol").to.equal("WMASS");
        expect(decimals.toNumber(), "token decimals").to.equal(8);
    });

    it("should only allow owner to mint token", async function () {
        await this.instance.mint(this.alice, "100");
        await this.instance.mint(this.bob, "1000");
        await expect(this.instance.mint(this.carol, "1000", {
            from: this.bob
        })).to.be.revertedWith("Ownable: caller is not the owner");

        const totalSupply = await this.instance.totalSupply();
        const aliceBal = await this.instance.balanceOf(this.alice);
        const bobBal = await this.instance.balanceOf(this.bob);
        const carolBal = await this.instance.balanceOf(this.carol);
        expect(totalSupply.toString()).to.equal("1100");
        expect(aliceBal.toString()).to.equal("100");
        expect(bobBal.toString()).to.equal("1000");
        expect(carolBal.toString()).to.equal("0");
    });

    it("should fail if try to mint token exceed CAP", async function () {
        await this.instance.mint(this.alice, CAP);
        await expect(this.instance.mint(this.alice, 1)).to.be.revertedWith("ERC20Capped: cap exceeded");
        const totalSupply = await this.instance.totalSupply();
        expect(totalSupply.toString()).to.equal(CAP.toString());
    });

    it("should only allow owner to burn token", async function () {
        await this.instance.mint(this.alice, "1000");
        await expect(this.instance.burn("1", {
            from: this.bob
        })).to.be.revertedWith("Ownable: caller is not the owner");
        await this.instance.burn("1");

        const totalSupply = await this.instance.totalSupply();
        const aliceBal = await this.instance.balanceOf(this.alice);
        expect(totalSupply.toString()).to.equal("999");
        expect(aliceBal.toString()).to.equal("999");
    });

    it("should only allow owner to pause", async function () {
        await this.instance.mint(this.alice, "1000");
        await expect(this.instance.pause({
            from: this.bob
        })).to.be.revertedWith("Ownable: caller is not the owner");
        await this.instance.burn("1");
        await this.instance.transfer(this.carol, "1");

        const totalSupply = await this.instance.totalSupply();
        const aliceBal = await this.instance.balanceOf(this.alice);
        const carolBal = await this.instance.balanceOf(this.carol);
        expect(totalSupply.toString()).to.equal("999");
        expect(aliceBal.toString()).to.equal("998");
        expect(carolBal.toString()).to.equal("1");

        // owner pause
        await this.instance.pause();
        await expect(this.instance.mint(this.bob, "100")).to.be.revertedWith("ERC20Pausable: token transfer while paused");
        await expect(this.instance.burn("1")).to.be.revertedWith("ERC20Pausable: token transfer while paused");
        await expect(this.instance.transfer(this.carol, "1")).to.be.revertedWith("ERC20Pausable: token transfer while paused");
    });

    it("should only allow owner to unpause", async function () {
        await this.instance.pause();
        await expect(this.instance.unpause({
            from: this.bob
        })).to.be.revertedWith("Ownable: caller is not the owner");
        await expect(this.instance.mint(this.carol, "100")).to.be.revertedWith("ERC20Pausable: token transfer while paused");

        await this.instance.unpause();
        await this.instance.mint(this.carol, "100");

        const totalSupply = await this.instance.totalSupply();
        const carolBal = await this.instance.balanceOf(this.carol);
        expect(totalSupply.toString()).to.equal("100");
        expect(carolBal.toString()).to.equal("100");
    });

    it("should supply token transfers properly", async function () {
        await this.instance.mint(this.alice, "100");
        await this.instance.mint(this.bob, "1000");
        await this.instance.transfer(this.carol, "10");
        await this.instance.transfer(this.carol, "100", {
            from: this.bob,
        });
        const totalSupply = await this.instance.totalSupply();
        const aliceBal = await this.instance.balanceOf(this.alice);
        const bobBal = await this.instance.balanceOf(this.bob);
        const carolBal = await this.instance.balanceOf(this.carol);
        expect(totalSupply.toString()).to.equal("1100");
        expect(aliceBal.toString()).to.equal("90");
        expect(bobBal.toString()).to.equal("900");
        expect(carolBal.toString()).to.equal("110");
    });

    it("should fail if you try to do bad transfers", async function () {
        await this.instance.mint(this.alice, "100");
        await expect(this.instance.transfer(this.carol, "101")).to.be.revertedWith("ERC20: transfer amount exceeds balance");
        await expect(this.instance.transfer(this.carol, "1", { from: this.bob })).to.be.revertedWith(
            "ERC20: transfer amount exceeds balance"
        );
    });

});