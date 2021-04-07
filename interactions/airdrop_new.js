const fs = require("fs");
const { exit } = require("process");
const file = fs.createWriteStream("../log-interactions.txt", { 'flags': 'a' });
let logger = new console.Console(file, file);

const { BN } = require('@openzeppelin/test-helpers');

const WMASSAirdrop = artifacts.require('WMASSAirdrop');
const WMASSToken = artifacts.require('WMASSToken');

module.exports = async () => {

    let network = process.argv[5];
    let AirdropAddress = process.argv[6];
    let amount = new BN(process.argv[7]).mul(new BN(100000000)); // in WMASS
    let perblock = new BN(process.argv[8]); // in MAXWELL
    let startblock = new BN(process.argv[9]);

    logger.log("\n================= New Airdrop =================");
    logger.log("Network:       " + network);
    logger.log("Contract:      " + AirdropAddress);
    logger.log("Amount:        " + amount.toString());
    logger.log("Per Block:     " + perblock.toString());
    logger.log("Start Block:   " + startblock.toString());
    logger.log("Time:          " + new Date().toLocaleString());

    let instanceAirdrop = await WMASSAirdrop.at(AirdropAddress);

    // check amount enough
    let period = await instanceAirdrop.period();
    let expectAmount = perblock.mul(period);
    if (expectAmount.cmp(amount) > 0) {
        logger.error("airdrop amount is too less: expected " + expectAmount.toString() + ", actual " + amount.toString());
        console.error("failed for amount not enough: expected " + expectAmount.toString() + ", actual " + amount.toString());
        exit(1);
    }
    
    let wmassAddress = await instanceAirdrop.wmass();
    let instanceWmass = await WMASSToken.at(wmassAddress);
    
    // approve
    console.log("approve " + AirdropAddress + " with " + amount.toString());
    await instanceWmass.approve(AirdropAddress, amount);
    // new
    console.log("call newAirdrop...");
    await instanceAirdrop.newAirdrop(amount, perblock, startblock);

    logger.log("new airdrop: amount " + amount.toString() + ", wmassPerBlock " + perblock.toString() + ", startBlock " + startblock.toString());
    console.log("new airdrop: amount " + amount.toString() + ", wmassPerBlock " + perblock.toString() + ", startBlock " + startblock.toString());

    exit(0);
};