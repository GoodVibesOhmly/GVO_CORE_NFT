var compile = require("../util/compile");
var blockchainConnection = require("../util/blockchainConnection");
var mainInterfaceAddress = "0x915A22A152654714FcecA3f4704fCf6bd314624c";
var dynamicUriResolverAddress;
var ItemProjectionFactoryContract;
var NativeProjection;
var mainInterface;

async function deployNativeProjection(nativeProjectionAddress = utilities.voidEthereumAddress) {
  await blockchainConnection.init;

  var MainInterface = await compile("model/IItemMainInterface");
  mainInterface = new web3.eth.Contract(
    MainInterface.abi,
    mainInterfaceAddress
  );
  
  if(nativeProjectionAddress == utilities.voidEthereumAddress){
    NativeProjection = await compile("projection/native/NativeProjection");
    var nativeProjectionContract = await new web3.eth.Contract(
      NativeProjection.abi
    )
      .deploy({ data: NativeProjection.bin, arguments: ["0x"] })
      .send(blockchainConnection.getSendingOptions());

    var model = nativeProjectionContract.options.address;

    return model;
  }
  return nativeProjectionAddress
}

async function deploy(host, plainUri, nativeProjectionAddress = utilities.voidEthereumAddress) {

  var model = await deployNativeProjection(nativeProjectionAddress)

  dynamicUriResolverAddress = await mainInterface.methods
    .dynamicUriResolver()
    .call();

  var ItemProjectionFactory = await compile(
    "projection/factory/impl/ItemProjectionFactory"
  );

  var dataParam = web3.eth.abi.encodeParameters(
    ["address"],
    [mainInterfaceAddress]
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

  ItemProjectionFactoryContract = await new web3.eth.Contract(
    ItemProjectionFactory.abi
  )
    .deploy({ data: ItemProjectionFactory.bin, arguments: [dataParam] })
    .send(blockchainConnection.getSendingOptions());

  return model;
}

async function initialization(
  zeroDecimals,
  collectionId,
  header,
  item,
  host,
  plainUri,
  nativeProjectionAddress = utilities.voidEthereumAddress
) {
  await deploy(host, plainUri, nativeProjectionAddress);

  var isDecimals = zeroDecimals;

  var deployParam = abi.encode(["bool"], [isDecimals]);

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

  var transaction = await ItemProjectionFactoryContract.methods
    .deploy(deployParam)
    .send(blockchainConnection.getSendingOptions());

  return new web3.eth.Contract(
    NativeProjection.abi,
    transaction.events.Deployed.returnValues.deployedAddress
  );
}

async function createCollection(host, itemsToMint) {
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

module.exports = {
  initialization,
  deployNativeProjection,
  deploy,
  createCollection,
};
