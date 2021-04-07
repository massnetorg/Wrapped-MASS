const fs = require("fs");
const { exit } = require("process");
const file = fs.createWriteStream("../log-interactions.txt", { 'flags': 'a' });
let logger = new console.Console(file, file);

const { BN } = require('@openzeppelin/test-helpers');

const WMASSAirdrop = artifacts.require('WMASSAirdrop');

module.exports = async () => {

    let network = process.argv[5];
    let AirdropAddress = process.argv[6];
    let method = process.argv[7];  // "add" or "set"
    let lpaddress = process.argv[8];
    let allocpoint = new BN(process.argv[9]);

    if (method != "add" && method != "set") {
        logger.error("unknown method: " + method);
        exit(1);
    }

    logger.log("\n================= Manage LP Token =================");
    logger.log("Network:       " + network);
    logger.log("Contract:      " + AirdropAddress);
    logger.log("Method:        " + method);
    logger.log("LP:            " + lpaddress);
    logger.log("Alloc Point:   " + allocpoint);
    logger.log("Time:          " + new Date().toLocaleString());

    let instance = await WMASSAirdrop.at(AirdropAddress);
    if (method == "add") {
        await instance.addLpToken(lpaddress, allocpoint);
        logger.log("add lp token " + lpaddress + " with alloc point " + allocpoint.toString());
        console.log("add lp token " + lpaddress + " with alloc point " + allocpoint.toString());
    } else {
        await instance.setLpToken(lpaddress, allocpoint);
        logger.log("set lp token " + lpaddress + " with alloc point " + allocpoint.toString());
        console.log("set lp token " + lpaddress + " with alloc point " + allocpoint.toString());
    }
    exit(0);
};