var compile = require("../util/compile");
var itemsv2 = require("../resources/itemsv2");
var blockchainConnection = require("../util/blockchainConnection");
const { isCommunityResourcable } = require("@ethersproject/providers");
var mainInterfaceAddress = "0x915A22A152654714FcecA3f4704fCf6bd314624c";
var mainInterface;
var noneBalance = [];

async function createNoneBal(address, items) {
  for (let i = 0; i < items.length; i++) {
    var items = { balances: [], totalSupplies: [] };
    items.balances.push(Array(address[i].length).fill(0));
    items.totalSupplies.push(Array(1).fill(0));
    noneBalance.push(items);
    return noneBalance;
  }
}

async function execFunct(funct) {
  var tx;
  try {
    if (funct.send) {
      tx = await funct.send(blockchainConnection.getSendingOptions());
    } else if (funct.then) {
      tx = await funct;
    } else {
      var f = funct();
      tx = f.then && (await f());
    }
    return tx;
  } catch (e) {
    console.error(e);
  }
}

async function getItemIdFromLog(transaction) {
  var logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash))
    .logs;
  return logs
    .filter(
      (it) =>
        it.topics[0] ===
        web3.utils.sha3("CollectionItem(bytes32,bytes32,uint256)")
    )
    .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));
}

async function assertTransferBalance(
  fromAddress,
  toAddress,
  itemids,
  transferAmount,
  checkBalFrom,
  checkBalTo
) {
  var expectedBalanceFrom = await Promise.all(
    checkBalFrom["balances"].map(async (item, index) => {
      return await Promise.all(
        item.map((it, i) => {
          return it.sub(transferAmount[index]);
        })
      );
    })
  );
  var expectedBalanceTo = await Promise.all(
    checkBalTo["balances"].map(async (item, index) => {
      return await Promise.all(
        item.map((it, i) => {
          return it.add(transferAmount[index]);
        })
      );
    })
  );

  var expectedTotalSupplies = checkBalFrom["totalSupplies"];

  await itemsv2.checkBalances(
    fromAddress,
    itemids,
    expectedBalanceFrom,
    expectedTotalSupplies
  );
  await itemsv2.checkBalances(
    toAddress,
    itemids,
    expectedBalanceTo,
    expectedTotalSupplies
  );
}

async function assertBurnBalance(checkBal, burnAmount, burnAddress, idItems) {
  var expectedBalance = await Promise.all(
    checkBal["balances"].map(async (item, index) => {
      return await Promise.all(
        item.map((it, i) => {
          return it.sub(burnAmount[index][i]);
        })
      );
    })
  );

  var expectedSupply = await Promise.all(
    checkBal["totalSupplies"].map(async (item, index) => {
      return await Promise.all(
        item.map((it, i) => {
          return it.sub(burnAmount[index][i]);
        })
      );
    })
  );

  await Promise.all(
    idItems.map(async (item, index) => {
      await itemsv2.checkBalances(
        burnAddress[index],
        [idItems[index]],
        expectedBalance[index],
        expectedSupply[index]
      );
    })
  );
}

async function assertCheckBalanceSupply(
  funct,
  createItem
) {
  var MainInterface = await compile("model/IItemMainInterface");
  mainInterface = new web3.eth.Contract(
    MainInterface.abi,
    mainInterfaceAddress
  );
  var idItems = createItem.map((it) => it.id);
  var amounts = createItem.map((it) => it.amounts);
  var accounts = createItem.map((it) => it.accounts);

  createNoneBal(accounts, idItems);
  var checkBal =
    idItems[0] == 0
      ? noneBalance
      : await Promise.all(
          accounts.map(async (it, i) => {
            return await itemsv2.checkBalances(
              it,
              Array(it.length).fill(idItems[i])
            );
          })
        );
  var transaction = await execFunct(funct);
  if (idItems == 0) {
    idItems = await getItemIdFromLog(transaction);
  }

  var expectedBalance = checkBal.map((it, i) => {
    return it["balances"].map((item, index) => {
      return item.map((element, indexEl) => {
        return element.add(amounts[i][indexEl]);
      });
    });
  });

  var expectedSupply = checkBal.map((it, i) => {
    return it["totalSupplies"].map((item, index) => {
      return item.map((element, indexEl) => {
        return element.add(amounts[i].reduce((total, arg) => total.add(arg), 0));
      });
    });
  });

  await Promise.all(
    idItems.map(async (event, index) => {
      await itemsv2.checkBalances(
        accounts[index],
        Array(accounts[index].length).fill(event),
        expectedBalance[0][index],
        expectedSupply[0][index]
      );
    })
  );

  return transaction;
}

async function assertCheckBalance(checkBal, CreateItem, itemids) {
  if (!Array.isArray(itemids)) {
    itemids = [itemids];
  }
  var expectedBalance = await Promise.all(
    checkBal.map(async (bal, index) => {
      return await Promise.all(
        bal["balances"].map(async (b, i) => {
          return b[0].add(CreateItem[index]["amounts"][i]);
        })
      );
    })
  );

  var expectedSupply = await Promise.all(
    checkBal.map(async (bal, index) => {
      return await Promise.all(
        bal["totalSupplies"].map(async (b, i) => {
          return b[0].add(
            CreateItem[index]["amounts"].reduce(
              (total, arg) => total.add(arg),
              0
            )
          );
        })
      );
    })
  );

  await Promise.all(
    CreateItem.map(async (it, i) => {
      await itemsv2.checkBalances(
        it.accounts,
        Array(it.accounts.length).fill(itemids[i]),
        expectedBalance[i],
        expectedSupply[i]
      );
    })
  );
}

async function assertDecimals(funct, zeroDecimals) {
  assert.equal(await execFunct(funct), zeroDecimals ? "0" : "18");
}

async function assertNotEqualCollection(funct, coll) {
  assert.notEqual(await execFunct(funct), coll);
}

async function assertEqualCollection(funct, coll) {
  assert.equal(await execFunct(funct), coll);
}

async function assertEqualHeaderHost(host1, host2) {
  assert.equal(host1, host2);
}

async function assertEqualHeaderUri(funct, uri) {
  assert.equal(await execFunct(funct), uri);
}

async function assertCheckHeader(header, funct) {
  var newHeader = await execFunct(funct);
  checkHeader(header, newHeader);
}

async function assertCheckFinalized(funct, finalized) {
  assert.equal(await execFunct(funct), finalized);
}

async function assertCheckIsApprovedForAll(funct, approved) {
  assert.equal(await execFunct(funct), approved);
}

function checkHeader(h1, h2) {
  /**
   * check that 2 object Header are equal
   */
  Object.keys(h1).forEach(
    (key) => isNaN(parseInt(key)) && assert.equal(h1[key], h2[key], key)
  );
  Object.keys(h2).forEach(
    (key) => isNaN(parseInt(key)) && assert.equal(h1[key], h2[key], key)
  );
}

function checkItem(h1, h2) {
  /**
   * check that 2 object CreateItem are equal
   */
  assert.equal(h1["collectionId"], h2["collectionId"]);
  checkHeader(h1.header, h2.header);
}

async function assertCheckCollection(items, collectionId) {
  items.map(async (item, index) => {
    assert.equal(
      await itemMainInterface.methods.collection(item).call(),
      collectionId
    );
  });
}

module.exports = {
  assertCheckBalanceSupply,
  assertCheckHeader,
  checkHeader,
  checkItem,
  assertCheckCollection,
  getItemIdFromLog,
  assertDecimals,
  assertNotEqualCollection,
  assertEqualCollection,
  assertEqualHeaderHost,
  assertEqualHeaderUri,
  assertCheckFinalized,
  assertCheckIsApprovedForAll,
  assertTransferBalance,
  assertBurnBalance,
  assertCheckBalance,
  createNoneBal,
};
