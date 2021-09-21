var compile = require("../util/compile");
var itemsv2 = require("../resources/itemsv2");
var blockchainConnection = require("../util/blockchainConnection");
var mainInterfaceAddress = "0x915A22A152654714FcecA3f4704fCf6bd314624c";
var mainInterface;
var noneBalance = { balances: [], totalSupplies: [] };
var balance = { balances: [], totalSupplies: [] };

async function createNoneBal(address, items) {
  for (let i = 0; i < items.length; i++) {
    noneBalance.balances.push(Array(address[i].length).fill(0));
    noneBalance.totalSupplies.push(Array(1).fill(0));
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

async function getBalance(idItems, accounts){
    await Promise.all(
        idItems.map(async (_, i) => {
            
          var idItem = idItems[i];
          balance.totalSupplies.push([
            await mainInterface.methods.totalSupply(idItem).call(),
          ]);
          await Promise.all(accounts[i].map(async (value, index) => {
            var bal = []
            bal.push(
              await mainInterface.methods.balanceOf(value, idItem).call()
            );
            balance.balances.push(bal);
          }));
          return balance;
        })
      );
      return balance
}

async function assertCheckBalanceSupply(funct, createItem, isBurn) {
  var MainInterface = await compile("model/IItemMainInterface");
  mainInterface = new web3.eth.Contract(
    MainInterface.abi,
    mainInterfaceAddress
  );
  var idItems = createItem.map((it) => it.id);
  // await mainInterface.methods.totalSupply(idItems[0]).call()
  var amounts = createItem.map((it) => it.amounts);
  var accounts = createItem.map((it) => it.accounts);
  createNoneBal(accounts, idItems);
  var checkBal =
    await idItems[0] == 0
      ? noneBalance
      : await getBalance(idItems, accounts)
  var transaction = await execFunct(funct);
  //TODO: fai funzione che restituisce itemid dal log
  if (idItems == 0) {
    var logs = (
      await web3.eth.getTransactionReceipt(transaction.transactionHash)
    ).logs;
    idItems = logs
      .filter(
        (it) =>
          it.topics[0] ===
          web3.utils.sha3("CollectionItem(bytes32,bytes32,uint256)")
      )
      .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));
  }

  var expectedBalance = checkBal["balances"].map((it, i) =>
    it.map((item, index) => {
      return isBurn 
      ? item.sub(amounts[i][index]) 
      : item.add(amounts[0][index]);
    })
  );
  var expectedSupply = checkBal["totalSupplies"].map((it, i) =>
    it.map((item, index) => {
      return isBurn
        ? item.sub(amounts[i][index])
        : item.add(amounts[i].reduce((total, arg) => total.add(arg), 0));
    })
  );
  await Promise.all(
    idItems.map(async (event, index) => {
      await itemsv2.checkBalances(
        accounts[index],
        Array(accounts[index].length).fill(event),
        expectedBalance[index],
        expectedSupply[index]
      );
    })
  );
}

function checkHeader(h1, h2) {
  /**
   * check that 2 object Header are equal
   */
  Object.keys(h1).forEach(key => isNaN(parseInt(key)) && assert.equal(h1[key], h2[key], key));
  Object.keys(h2).forEach(key => isNaN(parseInt(key)) && assert.equal(h1[key], h2[key], key));
}

function checkItem(h1, h2) {
  /**
   * check that 2 object CreateItem are equal
   */
  assert.equal(h1['collectionId'], h2['collectionId']);
  checkHeader(h1.header, h2.header);
}

module.exports = {
  assertCheckBalanceSupply,
  checkItem
};
