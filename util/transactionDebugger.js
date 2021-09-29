var utilities = require('./utilities');

var callbacks = {
    STATICCALL(step, currentStep, web3) {
        var data = step.sliceMemory(parseInt(step.stack[2]), parseInt(step.stack[3]));
        var { method, params } = extractMethodAndParams(data);
        currentStep.steps.push({
            type: step.op,
            parent: currentStep,
            gas: toNumberString(step.stack[0]),
            gasCost: utilities.numberToString(step.gasCost),
            from: step.from,
            to: web3.eth.abi.decodeParameter("address", step.stack[1]),
            value: '0',
            data,
            steps: [],
            logs: [],
            result: "0x",
            success: true,
            method,
            params
        });
        return currentStep.steps[currentStep.steps.length - 1];
    },
    DELEGATECALL(step, currentStep, web3) {
        var data = step.sliceMemory(parseInt(step.stack[2]), parseInt(step.stack[3]));
        var { method, params } = extractMethodAndParams(data);
        currentStep.steps.push({
            type: step.op,
            parent: currentStep,
            gas: toNumberString(step.stack[0]),
            gasCost: utilities.numberToString(step.gasCost),
            from: step.from,
            to: web3.eth.abi.decodeParameter("address", step.stack[1]),
            value: '0',
            data,
            steps: [],
            logs: [],
            result: "0x",
            success: true,
            method,
            params
        });
        return currentStep.steps[currentStep.steps.length - 1];
    },
    CALL(step, currentStep, web3, tx) {
        var data = step.sliceMemory(parseInt(step.stack[3]), parseInt(step.stack[4]));
        var { method, params } = extractMethodAndParams(data);
        currentStep.steps.push({
            type: !tx.incomplete && (!data || data === '0x') ? 'TRANSFER' : step.op,
            parent: currentStep,
            gas: toNumberString(step.stack[0]),
            gasCost: utilities.numberToString(step.gasCost),
            from: step.from,
            to: web3.eth.abi.decodeParameter("address", step.stack[1]),
            value: toNumberString(step.stack[2]),
            data,
            steps: [],
            logs: [],
            result: "0x",
            success: true,
            method,
            params
        });
        return currentStep.steps[currentStep.steps.length - 1];
    },
    CALLCODE(step, currentStep, web3) {
        var data = step.sliceMemory(parseInt(step.stack[3]), parseInt(step.stack[4]));
        var { method, params } = extractMethodAndParams(data);
        currentStep.steps.push({
            type: step.op,
            parent: currentStep,
            gas: toNumberString(step.stack[0]),
            gasCost: utilities.numberToString(step.gasCost),
            from: step.from,
            to: web3.eth.abi.decodeParameter("address", step.stack[1]),
            value: toNumberString(step.stack[2]),
            data,
            steps: [],
            logs: [],
            result: "0x",
            success: true,
            method,
            params
        });
        return currentStep.steps[currentStep.steps.length - 1];
    },
    CREATE(step, currentStep) {
        currentStep.steps.push({
            type: step.op,
            parent: currentStep,
            gasCost: utilities.numberToString(step.gasCost),
            from: step.from,
            value: toNumberString(step.stack[0]),
            data: step.sliceMemory(parseInt(step.stack[1]), parseInt(step.stack[2])),
            steps: [],
            logs: [],
            result: '0x',
            success: true
        });
        return currentStep.steps[currentStep.steps.length - 1];
    },
    CREATE2(step, currentStep) {
        currentStep.steps.push({
            type: step.op,
            parent: currentStep,
            gasCost: utilities.numberToString(step.gasCost),
            from: step.from,
            value: toNumberString(step.stack[0]),
            data: step.sliceMemory(parseInt(step.stack[1]), parseInt(step.stack[2])),
            salt: step.stack[3],
            steps: [],
            logs: [],
            result: '0x',
            success: true
        });
        return currentStep.steps[currentStep.steps.length - 1];
    },
    LOG0(step, currentStep, _, tx) {
        currentStep.logs.push({
            blockHash: tx.blockHash,
            transactionHash: tx.transactionHash,
            blockNumber: tx.blockNumber,
            address: step.from,
            topics: [],
            data: step.sliceMemory(parseInt(step.stack[0]), parseInt(step.stack[1]))
        });
        return currentStep;
    },
    LOG1(step, currentStep, _, tx) {
        currentStep.logs.push({
            blockHash: tx.blockHash,
            transactionHash: tx.transactionHash,
            blockNumber: tx.blockNumber,
            address: step.from,
            topics: [
                step.stack[2]
            ],
            data: step.sliceMemory(parseInt(step.stack[0]), parseInt(step.stack[1]))
        });
        return currentStep;
    },
    LOG2(step, currentStep, _, tx) {
        currentStep.logs.push({
            blockHash: tx.blockHash,
            transactionHash: tx.transactionHash,
            blockNumber: tx.blockNumber,
            address: step.from,
            topics: [
                step.stack[2],
                step.stack[3]
            ],
            data: step.sliceMemory(parseInt(step.stack[0]), parseInt(step.stack[1]))
        });
        return currentStep;
    },
    LOG3(step, currentStep, _, tx) {
        currentStep.logs.push({
            blockHash: tx.blockHash,
            transactionHash: tx.transactionHash,
            blockNumber: tx.blockNumber,
            address: step.from,
            topics: [
                step.stack[2],
                step.stack[3],
                step.stack[4]
            ],
            data: step.sliceMemory(parseInt(step.stack[0]), parseInt(step.stack[1]))
        });
        return currentStep;
    },
    LOG4(step, currentStep, _, tx) {
        currentStep.logs.push({
            blockHash: tx.blockHash,
            transactionHash: tx.transactionHash,
            blockNumber: tx.blockNumber,
            address: step.from,
            topics: [
                step.stack[2],
                step.stack[3],
                step.stack[4],
                step.stack[5]
            ],
            data: step.sliceMemory(parseInt(step.stack[0]), parseInt(step.stack[1]))
        });
        return currentStep;
    },
    STOP(_, currentStep, _1, tx) {
        var parent = currentStep.parent;
        delete currentStep.parent;
        return parent || tx;
    },
    RETURN(step, currentStep, web3, tx, stackTrace) {
        currentStep.type !== 'CREATE' && currentStep.type !== 'CREATE2' && (currentStep.result = step.sliceMemory(parseInt(step.stack[0]), parseInt(step.stack[1])));
        try {
            (currentStep.type === 'CREATE' || currentStep.type === 'CREATE2') && stackTrace[step.i + 1] && (currentStep.to = web3.eth.abi.decodeParameter("address", stackTrace[step.i + 1].stack[stackTrace[step.i + 1].stack.length - 1]));
        } catch(e) {
        }
        var parent = currentStep.parent;
        delete currentStep.parent;
        return parent || tx;
    },
    REVERT(step, currentStep, _, tx) {
        currentStep.success = false;
        currentStep.errorData = step.sliceMemory(parseInt(step.stack[0]), parseInt(step.stack[1]));
        var parent = currentStep.parent;
        delete currentStep.parent;
        return parent || tx;
    }
};

function toHexString(subject) {
    return subject.indexOf && subject.indexOf('0x') === 0 ? subject : '0x' + subject.toString('hex');
};

function toNumberString(subject) {
    return utilities.numberToString(parseInt(toHexString(subject)));
}

function extractMethodAndParams(data) {
    return {
        method: '0x' + (data === '0x' ? '' : data.substring(2, 10)),
        params: '0x' + (data.length > 10 ? data.substring(10) : '')
    };
};

var bytecodeCache = {};

async function cleanAndGetBytecodes(web3, step) {
    if(!step) {
        return "0x";
    }
    if((typeof step).toLowerCase() === 'string') {
        var bytecodeHash = bytecodeCache[step];
        if(bytecodeHash === undefined) {
            bytecodeCache[step] = bytecodeHash = web3.utils.sha3((await web3.eth.getCode(step)).split(step.toLowerCase()).join('0000000000000000000000000000000000000000'));
        }
        return bytecodeHash || "0x";
    }

    delete step.parent;

    step.fromCodeHash = await cleanAndGetBytecodes(web3, step.from && (step.from = web3.utils.toChecksumAddress(step.from)));
    step.toCodeHash = await cleanAndGetBytecodes(web3, step.to && (step.to = web3.utils.toChecksumAddress(step.to)));

    if(step.steps && step.steps.length > 0) {
        for(var i in step.steps) {
            step.steps[i] = await cleanAndGetBytecodes(web3, step.steps[i]);
        }
    }

    if(step.logs && step.logs.length > 0) {
        for(var i in step.logs) {
            try {
                step.logs[i].addressCodeHash = await cleanAndGetBytecodes(web3, step.logs[i].address = web3.utils.toChecksumAddress(step.logs[i].address || step.to));
            } catch(e) {
            }
        }
    }

    return step;
}

function instrumentStep(step, i, currentStep) {
    return step = {
        ...step,
        i,
        from: currentStep.to,
        originalStack: step.stack,
        stack: step.stack.map(it => "0x" + it).reverse(),
        originalMemory: step.memory,
        memory: step.memory ? step.memory.join('') : '',
        sliceMemory: (offset, length) => "0x" + (length === 0 || step.memory === '' ? '' : step.memory.substring((offset * 2), ((offset * 2) + (length * 2))))
    }
}

async function onTransaction(transaction, web3) {
    var data = transaction.input || transaction.data;
    var incomplete = data && data.length > 80000;
    var stackTrace = await new Promise(async function(ok, ko) {
        await web3.currentProvider.sendAsync({
            "id": new Date().getTime(),
            "jsonrpc": "2.0",
            "method": "debug_traceTransaction",
            "params": [transaction.hash || transaction.transactionHash, {
                disableStorage: true,
                disableMemory: incomplete
            }]
        }, async function(err, response) {
            if (err) {
                return ko(err);
            }
            return ok(response.result);
        });
    });

    var tx;
    var currentStep;
    currentStep = tx = {
        blockNumber: transaction.blockNumber,
        blockHash: transaction.blockHash,
        transactionHash: transaction.hash || transaction.transactionHash,
        type: transaction.contractAddress ? 'CREATE' : (data && data != '0x') ? 'CALL' : 'TRANSFER',
        gasLimit: utilities.numberToString(transaction.gas),
        gasPrice: utilities.numberToString(transaction.gasPrice),
        gas: utilities.numberToString(stackTrace.gas),
        from: transaction.from,
        to: transaction.to || transaction.contractAddress,
        data: transaction.contractAddress ? '0x' : data,
        value: utilities.numberToString(transaction.value),
        result: stackTrace.returnValue || '0x',
        success: true,
        steps: [],
        logs: []
    };
    var { method, params } = extractMethodAndParams(tx.data);
    tx.method = method;
    tx.params = params;
    incomplete && (tx.incomplete = true);

    stackTrace = stackTrace.structLogs;

    for (var i in stackTrace) {
        var step = stackTrace[i];
        callbacks[step.op] && (currentStep = callbacks[step.op](instrumentStep(step, parseInt(i), currentStep), currentStep, web3, tx, stackTrace) || currentStep);
    }

    /*tx.amountSpent = toNumberString(transactionVerdict.amountSpent);
    tx.gasUsed = toNumberString(transactionVerdict.execResult.gasUsed);
    tx.gasRefund = toNumberString(transactionVerdict.execResult.gasRefund);
    tx.gas = toNumberString(transactionVerdict.execResult.gas);*/

    return await cleanAndGetBytecodes(web3, tx);
}

module.exports = function transactionDebugger(web3, callback) {
    var dumpBlock = function dumpBlock(blockNumber, callback) {
        web3.eth.getBlock(blockNumber).then(block => Promise.all(block.transactions.map(transactionHash => web3.eth.getTransaction(transactionHash).then(transaction => web3.eth.getTransactionReceipt(transactionHash).then(transactionReceipt => onTransaction({...transaction, ...transactionReceipt }, web3))))).then(callback)).catch(console.error);
    };
    callback && web3.eth.subscribe('newBlockHeaders').on('data', data => dumpBlock(data.number, callback));
    return function dumpBlocks(fromBlock, toBlock) {
        var blockArray = [parseInt(fromBlock)];
        if (toBlock) {
            for (var i = parseInt(fromBlock) + 1; i <= parseInt(toBlock); i++) {
                blockArray.push(i);
            }
        }
        var transactions = [];
        return new Promise(function(ok) {
            var callback = function callback(txns) {
                transactions.push(...txns);
                return blockArray.length === 0 ? ok(transactions) : dumpBlock(blockArray.shift(), callback);
            }
            dumpBlock(blockArray.shift(), callback);
        });
    }
};