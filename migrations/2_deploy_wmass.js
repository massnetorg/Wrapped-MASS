const fs = require("fs");
const file = fs.createWriteStream("../log-deploy.txt", { 'flags': 'a' });
let logger = new console.Console(file, file);
const { BN } = require('@openzeppelin/test-helpers');

const WMASSToken = artifacts.require('WMASSToken');
const WMASSAirdrop = artifacts.require('WMASSAirdrop');

module.exports = async (deployer, network, accounts) => {
    let wmassAddress;

    switch (process.argv[6]) {
        case '0':   // token
            // argv[7] cap in WMASS
            let cap = new BN(process.argv[7]).mul(new BN(100000000));

            logger.log("\n============= Deploy WMASSToken =============");
            logger.log("Network: " + network);
            logger.log("Cap:     " + cap.toString() + " MAXWELL");
            logger.log("Time:    " + new Date().toLocaleString());

            await deployer.deploy(WMASSToken, cap);
            logger.log("WMASSToken Address: ", WMASSToken.address);
            break;
        case '1':   // airdrop
            // argv[7] WMASS address
            // argv[8] period
            wmassAddress = process.argv[7];
            let period = process.argv[8];

            logger.log("\n============= Deploy WMASSAirdrop =============");
            logger.log("Network:         " + network);
            logger.log("WMASS Address:   " + wmassAddress);
            logger.log("Period:          " + period + " blocks");
            logger.log("Time:            " + new Date().toLocaleString());

            await deployer.deploy(WMASSAirdrop, wmassAddress, period);
            logger.log("WMASSAirdrop Address: ", WMASSAirdrop.address);    
            break;
        default:
            logger.error("unknown contract: " + process.argv[6]);
            console.error("unknown contract: " + process.argv[6]);
    }
    return;
};