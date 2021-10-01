global.debug = global.debug || (typeof v8debug === 'object' || /--debug|--inspect/.test(process.execArgv.join(' ')));
global.blockchainConnection = require("./blockchainConnection");
global.assert = require("assert");
global.assert.equal = assert.strictEqual;
global.utilities = require("./utilities");
global.knowledgeBase = require("./knowledgeBase.json");
global.compile = require("./compile");
global.onTheFly = require("./onTheFly");
global.abi = new(require('ethers')).utils.AbiCoder();

global.catchCall = async function catchCall(funct, message, print) {
    var done = false;
    try {
        if (funct.send) {
            await funct.send(blockchainConnection.getSendingOptions());
        } else if (funct.then) {
            await funct;
        } else {
            var f = funct();
            f.then && await f();
        }
        done = true;
    } catch (e) {
        print && console.error(e);
        (!message || message.toLowerCase() === 'revert') && assert.strictEqual((e.message || e).indexOf('revert'), (e.message || e).length - ('revert'.length), e.message || e);
        message && message.toLowerCase() !== 'revert' && assert.notStrictEqual((e.message || e).toLowerCase().indexOf(message.toLowerCase()), -1, e.message || e);
        return await web3.eth.getTransactionReceipt(e.hashes[0]);
    }
    assert(!done, "This shouldn't happen");
};

global.onCompilation = function onCompilation(contract) {
    if (!global.web3Util) {
        var Web3 = require('web3');
        global.web3Util = new Web3();
    }
    (global.contractsInfo = global.contractsInfo || {})[global.web3Util.utils.sha3(JSON.stringify(contract.abi))] = contract;
}

function setupTransactionDebugger(web3) {
    var path = require('path');
    var fs = require('fs');
    var buildPath = path.resolve(__dirname, '../build');
    try {
        fs.mkdirSync(buildPath);
    } catch (e) {}
    var jsonPath = path.resolve(buildPath, 'dump.json');
    try {
        fs.unlinkSync(jsonPath);
    } catch (e) {}
    require('./ganache-transactionDebugger');
    global.transactionDebugger = require('./transactionDebugger')(web3);
    var OldContract = web3.eth.Contract;
    web3.eth.Contract = function Contract(abi, address) {
        var contract;
        try {
            contract = global.contractsInfo[web3.utils.sha3(JSON.stringify(abi))];
        } catch (e) {}
        var oldContract = new OldContract(abi, address);
        if (contract) {
            oldContract.name = contract.contractName;
            oldContract.abi = contract.abi;
            var oldDeploy = oldContract.deploy;
            oldContract.deploy = function deploy() {
                var compiledInfo = {
                    name: this.name,
                    abi: this.abi
                };
                var dep = oldDeploy.apply(this, arguments);
                var oldSend = dep.send;
                dep.send = function send() {
                    return oldSend.apply(this, arguments).then(deployedContract => {
                        var address = deployedContract.options.address;
                        var set = async() => {
                            try {
                                var key = web3.utils.sha3(await web3.eth.getCode(address));
                                if(!key) {
                                    setTimeout(set);
                                }
                                (global.compiledContracts = global.compiledContracts || {})[key] = compiledInfo;
                            } catch (e) {}
                        };
                        setTimeout(set);
                        return deployedContract;
                    });
                };
                return dep;
            };
        }
        return oldContract;
    };
}

async function dumpBlocks() {
    var transactions = await global.transactionDebugger.debugBlocks(global.blockchainConnection.forkBlock, (await global.web3.eth.getBlock('latest')).number);
    var wellknownAddresses = {};
    global.accounts.forEach((it, i) => wellknownAddresses[it] = `Ganache Account ${i}`);
    var path = require('path');
    var fs = require('fs');
    var buildPath = path.resolve(__dirname, '../build');
    try {
        fs.mkdirSync(buildPath);
    } catch (e) {}
    var jsonPath = path.resolve(buildPath, 'dump.json');
    try {
        fs.unlinkSync(jsonPath);
    } catch (e) {}
    try {
        fs.writeFileSync(jsonPath, JSON.stringify({ transactions, compiledContracts: global.compiledContracts, wellknownAddresses }, null, 4));
    } catch (e) {
        console.error(e);
    }
}

exports.mochaHooks = {
    beforeAll(done) {
        Promise.all([
            blockchainConnection.init.then(setupTransactionDebugger)
        ]).then(() => done()).catch(done);
    },
    afterAll(done) {
        Promise.all([
            dumpBlocks()
        ]).then(() => done()).catch(done);
    }
};