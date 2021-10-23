var compile = require("../util/compile");
var blockchainConnection = require("../util/blockchainConnection");
const utilities = require("../util/utilities");
var dynamicUriResolverAddress;
var itemProjectionFactoryContract;
var NativeProjection;
var mainInterface;
var ItemInteroperableInterface;

function convertHeader(header) {
  return Object.values(header);
}

async function convertItem(item) {
  return await item.map(async doc => doc != "Header" ? Object.values(doc) : await convertHeader(doc));
}

async function deployNativeProjection(
  nativeProjectionAddress = utilities.voidEthereumAddress
) {
  await blockchainConnection.init;

  var MainInterface = await compile("model/IItemMainInterface");
  mainInterface = new web3.eth.Contract(
    MainInterface.abi,
    knowledgeBase.mainInterfaceAddress
  );

  if (nativeProjectionAddress == utilities.voidEthereumAddress) {
    NativeProjection = await compile("projection/native/NativeProjection");
    var nativeProjectionContract = await new web3.eth.Contract(
      NativeProjection.abi
    )
      .deploy({ data: NativeProjection.bin, arguments: ["0x"] })
      .send(blockchainConnection.getSendingOptions());

    var model = nativeProjectionContract.options.address;

    return model;
  }
  return nativeProjectionAddress;
}

async function deploy(
  host,
  plainUri,
  nativeProjectionAddress = utilities.voidEthereumAddress
) {
  var model = await deployNativeProjection(nativeProjectionAddress);

  dynamicUriResolverAddress = await mainInterface.methods
    .dynamicUriResolver()
    .call();

  var ItemProjectionFactory = await compile(
    "projection/factory/impl/ItemProjectionFactory"
  );

  var dataParam = web3.eth.abi.encodeParameters(
    ["address"],
    [knowledgeBase.mainInterfaceAddress]
  );

  dataParam = web3.eth.abi.encodeParameters(
    ["address", "bytes"],
    [model, dataParam]
  );

  dataParam = web3.eth.abi.encodeParameters(
    ["string", "address", "bytes"],
    [plainUri, dynamicUriResolverAddress, dataParam]
  );

  dataParam = web3.eth.abi.encodeParameters(
    ["address", "bytes"],
    [host, dataParam]
  );

  itemProjectionFactoryContract = await new web3.eth.Contract(
    ItemProjectionFactory.abi
  )
    .deploy({ data: ItemProjectionFactory.bin, arguments: [dataParam] })
    .send(blockchainConnection.getSendingOptions());

  return model;
}

async function initialization(
  collectionId,
  header,
  item,
  host,
  plainUri,
  nativeProjectionAddress = utilities.voidEthereumAddress,
  bool = []
) {
  header = await convertHeader(header);

  await deploy(host, plainUri, nativeProjectionAddress);

  var deployParam = abi.encode(["bool[]"], [bool]);
  
  deployParam = abi.encode(
    [
      "bytes32",
      "tuple(address,string,string,string)",
      "tuple(tuple(address,string,string,string),bytes32,uint256,address[],uint256[])[]",
      "bytes",
    ],
    [collectionId, header, item, deployParam]
  );

  deployParam = abi.encode(["address", "bytes"], [host, deployParam]);

  var transaction = await itemProjectionFactoryContract.methods
    .deploy(deployParam)
    .send(blockchainConnection.getSendingOptions());

  var logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash))
    .logs;
  var itemIds = logs
    .filter(
      (it) =>
        it.topics[0] ===
        web3.utils.sha3("CollectionItem(bytes32,bytes32,uint256)")
    )
    .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

  var native = new web3.eth.Contract(
    NativeProjection.abi,
    transaction.events.Deployed.returnValues.deployedAddress
  );
  
  if(itemIds.length > 0){
    await Promise.all(
      itemIds.map(async (it, index) => {
        var checkBal = await checkBalances(item[index][3][0], it)
        await Promise.all(checkBal["balances"].map(async(bal, ind) => {
          await Promise.all(bal.map((b, i) =>{
            assert.equal(b.sub(item[index][4][i]), '0')
          }))
        }))
      })
    );
  }
  return {
    native,
    itemIds,
  };
}

async function createCollection(host, itemsToMint) {
  var MainInterface = await compile("model/IItemMainInterface");
  mainInterface = new web3.eth.Contract(
    MainInterface.abi,
    knowledgeBase.mainInterfaceAddress
  );
  var collection = {
    host,
    name: "Collection",
    symbol: "COL",
    uri: "uri",
  };
  var items = !itemsToMint
    ? []
    : itemsToMint.map((it, i) => {
        return {
          header: {
            host,
            name: "Item_" + i,
            symbol: "IT_" + i,
            uri: "URI_" + i,
          },
          collectionId: utilities.voidBytes32,
          id: 0,
          accounts: Object.keys(it),
          amounts: Object.values(it),
        };
      });
  var transaction = await mainInterface.methods
    .createCollection(collection, items)
    .send(blockchainConnection.getSendingOptions());
  var logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash))
    .logs;
  var collectionId = web3.eth.abi.decodeParameter(
    "bytes32",
    logs.filter(
      (it) =>
        it.topics[0] === web3.utils.sha3("Collection(address,address,bytes32)")
    )[0].topics[3]
  );
  var itemIds = logs
    .filter(
      (it) =>
        it.topics[0] ===
        web3.utils.sha3("CollectionItem(bytes32,bytes32,uint256)")
    )
    .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));
  return {
    collectionId,
    itemIds,
  };
}

function asArray(item, asArray) {
  return !item
    ? []
    : (item instanceof Array ? item : [item]).map((it) =>
        it instanceof Array ? it : asArray ? [it] : it
      );
}

async function asInteroperableInterface(itemId) {
  ItemInteroperableInterface = await compile("impl/ItemInteroperableInterface");
  var itemInteroperableInterface = new web3.eth.Contract(
    ItemInteroperableInterface.abi,
    await mainInterface.methods.interoperableOf(itemId).call()
  );
  try {
    await blockchainConnection.unlockAccounts(
      itemInteroperableInterface.options.address
    );
  } catch (e) {}
  return itemInteroperableInterface;
}

async function checkBalances(
  owners,
  itemIds,
  expectedBalances,
  expectedTotalSupplies,
  native
) {
  itemIds = asArray(itemIds, (owners = asArray(owners)).length > 1);
  if (owners.length === 0 || itemIds.length === 0) {
    throw new Error("owners and itemIds are empty");
  }
  expectedBalances = asArray(expectedBalances, owners.length > 1);
  expectedTotalSupplies = asArray(expectedTotalSupplies, owners.length > 1);
  var balances = [owners.map(() => "0")];
  var totalSupplies = [owners.map(() => "0")];
  var checkStep = async function checkStep(
    owner,
    itemIds,
    expectedBalances,
    expectedTotalSupplies
  ) {
    var b = itemIds.map(() => "0");
    var t = itemIds.map(() => "0");
    await Promise.all(
      itemIds.map(async (_, i) => {
        var itemId = itemIds[i];
        var mainTotalSupply = (t[i] = await mainInterface.methods
          .totalSupply(itemId)
          .call());
        var interoperableInterface = await asInteroperableInterface(itemId);
        var interoperableTotalSupply = await interoperableInterface.methods
          .totalSupply()
          .call();
        assert.equal(
          mainTotalSupply,
          interoperableTotalSupply,
          `totalSupply mismatch for item #${itemId}`
        );

        if(native != null){
          var nativeTotalSupply = await native.methods.totalSupply(itemId).call();
          assert.equal(
            nativeTotalSupply,
            mainTotalSupply,
            `totalSupply mismatch between native and main interface for item #${itemId}`
          );
        }

        expectedTotalSupplies &&
          expectedTotalSupplies.length > 0 &&
          assert.equal(
            mainTotalSupply,
            expectedTotalSupplies[i],
            `expected totalSupply mismatch for item #${itemId}`
          );

        var mainBalance = (b[i] = await mainInterface.methods
          .balanceOf(owner, itemId)
          .call());
        var interoperableBalance = await interoperableInterface.methods
          .balanceOf(owner)
          .call();

        assert.equal(
          mainBalance,
          interoperableBalance,
          `balanceOf mismatch for owner ${owner} and item #${itemId}`
        );

        if(native != null){
          var nativeBalance = await native.methods.balanceOf(owner, itemId).call();
          assert.equal(
            mainBalance,
            nativeBalance,
            `balanceOf mismatch between native and main interface for owner ${owner} and item #${itemId}`
          );
        }
        expectedBalances &&
          expectedBalances.length > 0 &&
          assert.equal(
            mainBalance,
            expectedBalances[i],
            `expected balanceOf mismatch for owner ${owner} and item #${itemId}`
          );
      })
    );

    var balanceOfBatch = await mainInterface.methods
      .balanceOfBatch(
        itemIds.map(() => owner),
        itemIds
      )
      .call();
    assert.equal(
      JSON.stringify(b),
      JSON.stringify(balanceOfBatch),
      `balanceOfBatch mismatch for owner ${owner}`
    );
    expectedBalances &&
      expectedBalances.length > 0 &&
      assert.equal(
        JSON.stringify(expectedBalances),
        JSON.stringify(b),
        `expected balanceOfBatch mismatch for owner ${owner}`
      );
    expectedBalances &&
      expectedBalances.length > 0 &&
      assert.equal(
        JSON.stringify(expectedBalances),
        JSON.stringify(balanceOfBatch),
        `expected balanceOfBatch mismatch for owner ${owner}`
      );
    return [b, t];
  };
  await Promise.all(
    owners.map(async (_, i) => {
      var step = await checkStep(
        owners[i],
        owners.length === 1 ? itemIds : itemIds[i],
        owners.length === 1 ? expectedBalances : expectedBalances[i],
        owners.length === 1 ? expectedTotalSupplies : expectedTotalSupplies[i]
      );
      balances[i] = step[0];
      totalSupplies[i] = step[1];
    })
  );
  return {
    balances,
    totalSupplies,
  };
}

module.exports = {
  initialization,
  deployNativeProjection,
  deploy,
  createCollection,
  checkBalances,
  convertHeader,
  convertItem
};
