const fs = require("fs");
const { exit } = require("process");
const file = fs.createWriteStream("../log-interactions.txt", { 'flags': 'a' });
let logger = new console.Console(file, file);

const { BN } = require('@openzeppelin/test-helpers');

const WMASSToken = artifacts.require('WMASSToken');

module.exports = async () => {

    let network = process.argv[5];
    let WMASSAddress = process.argv[6];
    let user = process.argv[7];
    let amount = new BN(process.argv[8]).mul(new BN(100000000));

    logger.log("\n============= Mint WMASS =============");
    logger.log("Network:   " + network);
    logger.log("WMASS:     " + WMASSAddress);
    logger.log("To:        " + user);
    logger.log("Amount:    " + amount.toString() + " MAXWELL");
    logger.log("Time:      " + new Date().toLocaleString());

    let instance = await WMASSToken.at(WMASSAddress);
    await instance.mint(user, amount);
    logger.log("mint " + amount.toString() + " MAXWELL to " + user);
    console.log("mint " + amount.toString() + " MAXWELL to " + user);
    exit(0);
};