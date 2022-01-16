global.debug = global.debug || (typeof v8debug === 'object' || /--debug|--inspect/.test(process.execArgv.join(' ')));
global.blockchainConnection = require("./blockchainConnection");
global.assert = require("assert");
global.assert.equal = assert.strictEqual;
global.utilities = require("./utilities");
global.knowledgeBase = require("./knowledgeBase.json");
global.compile = require("./compile");
global.onTheFly = require("./onTheFly");
global.abi = new(require('ethers')).utils.AbiCoder();

global.evmErrors = {
    0x01 : "Using assert",
    0x11 : "SafeMath over-/under-flows",
    0x12 : "Divide by 0",
    0x21 : "Conversion into non-existent enum type",
    0x22: "Incorrectly encoded storage byte array",
    0x31: "pop() on an empty array",
    0x32: "Index out of bounds exception",
    0x41: "Allocating too much memory or creating a too large array",
    0x51: "Calling a zero-initialized variable of internal function type"
}

global.onStep = function onStep(evt) {
    if(!evt) {
        return;
    }
    evt = evt.data;
    if(!evt || (evt.opcode.name !== 'REVERT' && evt.opcode.name !== 'INVALID')) {
        return;
    }
    if(evt.opcode.name === 'INVALID') {
        return global.latestError = 'INVALID OPCODE'
    }
    var start = parseInt("0x" + evt.stack[evt.stack.length - 1].toString('hex'));
    global.latestError = evt.memory.slice(
        start,
        start + parseInt("0x" + evt.stack[evt.stack.length - 2].toString('hex'))
    ).toString("hex");

    if(global.latestError.toLowerCase().indexOf('08c379a0') === 0) {
        global.latestError = web3.eth.abi.decodeParameter("string", global.latestError.substring(8));
    }

    if(global.latestError.toLowerCase().indexOf('4e487b71') === 0) {
        global.latestError = parseInt(web3.eth.abi.decodeParameter("uint256", global.latestError.substring(8)));
        global.latestError = global.evmErrors[global.latestError] ? global.evmErrors[global.latestError] : global.latestError;
    }

    console.error(global.latestError);
}

global.catchCall = async function catchCall(funct, message, print) {
    global.latestError = null;
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
        global.latestError && (e.message = global.latestError);
        print && console.error(e);
        (!message || message.toLowerCase() === 'revert') && assert.strictEqual((e.message || e).indexOf('revert'), (e.message || e).length - ('revert'.length), e.message || e);
        message && message.toLowerCase() !== 'revert' && assert.notStrictEqual((e.message || e).toLowerCase().indexOf(message.toLowerCase()), -1, e.message || e);
        return e.receipt || await web3.eth.getTransactionReceipt(e.hashes[0]);
    }
    assert(!done, "This shouldn't happen");
};

global.onCompilation = function onCompilation(contract) {
    if (!global.web3Util) {
        var Web3 = require('web3');
        global.web3Util = new Web3();
    }
    (global.compiledContracts = global.compiledContracts || {})[global.web3Util.utils.sha3("0x" + contract['bin-runtime'])] = {
        name: contract.contractName,
        abi: contract.abi
    };
    (global.contractsInfo = global.contractsInfo || {})[global.web3Util.utils.sha3(JSON.stringify(contract.abi))] = contract;
}

var startBlock;
var testBatteryTitle;
var currentTestTitle;

function setupTransactionDebugger(web3) {
    web3.currentProvider.on("ganache:vm:tx:step", global.onStep);
    var provider = web3.currentProvider;
    function instrumentMethod(provider, methodName, instrumentedFunction) {
        if(!provider[methodName]) {
            return;
        }
        var oldMethod = provider[methodName];
        provider[methodName] = function() {
            return instrumentedFunction(provider, oldMethod, arguments);
        }
    }
    instrumentMethod(provider, 'send', tryManageSendTransaction);
    instrumentMethod(provider, 'sendAsync', tryManageSendTransaction);
    instrumentMethod(provider, 'request', tryManageSendTransaction);
    instrumentMethod(provider, 'requestAsync', tryManageSendTransaction);
    function tryManageSendTransaction(provider, originalMethod, originalArguments) {
        var batteryTitle = testBatteryTitle;
        var testTitle = currentTestTitle;
        var key = batteryTitle + " - " + (testTitle || "");
        var args = originalArguments[0];
        if ((args.method !== 'eth_sendTransaction' && args.method !== 'eth_sendSignedTransaction') || !startBlock || (global.transactionLabels = global.transactionLabels || {})[key]) {
            return originalMethod.apply(provider, originalArguments);
        }
        global.transactionLabels[key] = true;
        var callback = originalArguments[1];
        function newCallback(error, response) {
            response && (response.result || typeof response === 'string') && (global.transactionLabels[key] = response.result || response);
            callback && callback(error, response);
            if(!callback && error) {
                throw error;
            }
            return response;
        };
        if(callback) {
            originalArguments = [...originalArguments];
            originalArguments[1] = newCallback;
            return originalMethod.apply(provider, originalArguments);
        }
        try {
            var response = originalMethod.apply(provider, originalArguments);
            if(!response.then) {
                return newCallback(undefined, response);
            }
            return response.then(r => newCallback(undefined, r)).catch(newCallback)
        } catch(e) {
            return newCallback(e);
        }
    };
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
    //require('./ganache-transactionDebugger');
    global.transactionDebugger = require('./transactionDebugger')(web3);
    var OldContract = web3.eth.Contract;
    web3.eth.Contract = function Contract(abi, address) {
        var contract = (global.contractsInfo = global.contractsInfo || {})[web3.utils.sha3(JSON.stringify(abi))];
        var oldContract = new OldContract(...arguments);
        try {
            oldContract.name = contract.contractName;
            oldContract.abi = contract.abi;
            address && web3.eth.getCode(address).then(code => {
                var key = web3.utils.sha3(code);
                (global.compiledContracts = global.compiledContracts || {})[key] = {
                    name: oldContract.name,
                    abi: oldContract.abi
                };
            });
            var oldDeploy = oldContract.deploy;
            oldContract.deploy = function deploy() {
                var dep = oldDeploy.apply(oldContract, arguments);
                var oldSend = dep.send;
                dep.send = function send() {
                    return oldSend.apply(oldContract, arguments).then(deployedContract => {
                        var address = deployedContract.options.address;
                        var set = async() => {
                            try {
                                var key = web3.utils.sha3(await web3.eth.getCode(address));
                                if (!key) {
                                    setTimeout(set);
                                }
                                (global.compiledContracts = global.compiledContracts || {})[key] = {
                                    name: oldContract.name,
                                    abi: oldContract.abi
                                };
                            } catch (e) {}
                        };
                        setTimeout(set);
                        return deployedContract;
                    });
                };
                return dep;
            };
        } catch (e) {}
        return oldContract;
    };
}

async function initDFOHubManager() {
    /*global.dfoManager = require('./dfo');
    global.dfoHubManager = require('./dfoHub');
    await global.dfoHubManager.init;*/
    startBlock = parseInt((await global.web3.eth.getBlock('latest')).number) + 1;
}

async function dumpBlocks() {
    var transactions = await global.transactionDebugger.debugBlocks(startBlock, (await global.web3.eth.getBlock('latest')).number);
    transactions = transactions.filter(it => !global.bypassedTransactions || !global.bypassedTransactions[it.transactionHash]);
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
        fs.writeFileSync(jsonPath, JSON.stringify({ transactions, compiledContracts: global.compiledContracts, wellknownAddresses, transactionLabels : global.transactionLabels }, null, 4));
    } catch (e) {
        console.error(e);
    }
}

exports.mochaHooks = {
    beforeAll(done) {
        testBatteryTitle = undefined;
        currentTestTitle = undefined;
        Promise.all([
            blockchainConnection.init.then(setupTransactionDebugger).then(initDFOHubManager)
        ]).then(() => done()).catch(done);
    },
    afterAll(done) {
        Promise.all([
            dumpBlocks()
        ]).then(() => done()).catch(done);
    },
    beforeEach() {
        testBatteryTitle = this.currentTest.parent.title;
        currentTestTitle = this.currentTest.title;
        global.transactionLabels && global.transactionLabels["undefined - "] && (global.transactionLabels[testBatteryTitle + " - "] = global.transactionLabels["undefined - "]);
        global.transactionLabels && delete global.transactionLabels["undefined - "];
    }
};