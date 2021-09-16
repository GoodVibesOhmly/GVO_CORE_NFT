var itemsv2 = require('../resources/itemsv2');

var MainInterface
var mainInterface
describe("Item V2 Projections - Native", () => {
  before(async () => {
    MainInterface = await compile('model/IItemMainInterface');
    mainInterface = new web3.eth.Contract(MainInterface.abi, knowledgeBase.mainInterfaceAddress);
  });
  it("#0", async () => {
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;

    var collectionHeader = [accounts[1], 'Item1', 'I1', 'uriItem1'];

    var items = [
      [[utilities.voidEthereumAddress, '', '', ''], collectionId, 0, [accounts[1]], [10000]]
    ];
    try {
      var native = await itemsv2.initialization(zeroDecimals, collectionId, collectionHeader, items, accounts[1], "URI");
      console.log("Native", native.options.address);
      assert.equal(await native.methods.decimals(0).call(), zeroDecimals ? '0' : '18');
    } catch(e) {
      console.error(e);
    }
  });

  it("#619 Alternative Initialization", async () => {
    
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;

    var nativeProjectionAddress = await itemsv2.deployNativeProjection();

    var items = [];

    var collectionId = (await itemsv2.createCollection(nativeProjectionAddress, items))['collectionId']
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;

    var collectionHeader = [nativeProjectionAddress, 'Collection', 'COL', 'uri'];

    var native = await itemsv2.initialization(zeroDecimals, collectionId, collectionHeader, items, nativeProjectionAddress, "URI", nativeProjectionAddress);
    assert.equal(await native.methods.decimals(0).call(), zeroDecimals ? '0' : '18');
  });

  it("#620 Change Collection Metadata", async () => {
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;

    var collectionHeader = [accounts[1], 'Collection1', 'COL1', 'uri1'];
    var newCollectionHeader = [accounts[1], 'Collection2', 'COL2', 'uri2'];

    var items = [
      [[utilities.voidEthereumAddress, '', '', ''], collectionId, 0, [accounts[1]], [10000]]
    ];
    var native = await itemsv2.initialization(zeroDecimals, collectionId, collectionHeader, items, accounts[1], "URI");
    
    console.log("Native", native.options.address);
    assert.equal(await native.methods.decimals(0).call(), zeroDecimals ? '0' : '18');
    console.log(await native.methods.collectionId().call())
    console.log(await native.methods.mainInterface().call())
    console.log(await native.methods.setHeader(newCollectionHeader).send(blockchainConnection.getSendingOptions({ from: accounts[1] })));
  });

  // it("#621 Change Collection Metadata", async () => {
  //   var zeroDecimals = false;
  //   var collectionId = utilities.voidBytes32;

  //   var collectionHeader = [accounts[1], 'Collection1', 'COL1', 'uri1'];
  //   var newCollectionHeader = [accounts[2], 'Collection2', 'COL2', 'uri2'];

  //   var items = [
  //     [[utilities.voidEthereumAddress, '', '', ''], collectionId, 0, [accounts[1]], [10000]]
  //   ];
  //   var native = await itemsv2.initialization(zeroDecimals, collectionId, collectionHeader, items, accounts[1], "URI");
    
  //   console.log("Native", native.options.address);
  //   assert.equal(await native.methods.decimals(0).call(), zeroDecimals ? '0' : '18');

  //   console.log(native.methods.setHeader(newCollectionHeader).send(blockchainConnection.getSendingOptions({ from: accounts[1] })));
  // });

  // it("#622 Change Collection Metadata", async () => {
  //   var zeroDecimals = false;
  //   var collectionId = utilities.voidBytes32;

  //   var collectionHeader = [accounts[1], 'Collection1', 'COL1', 'uri1'];

  //   var items = [
  //     [[utilities.voidEthereumAddress, '', '', ''], collectionId, 0, [accounts[1]], [10000]]
  //   ];
  //   var native = await itemsv2.initialization(zeroDecimals, collectionId, collectionHeader, items, accounts[1], "URI");
  //   var newCollectionHeader = [native.options.address, 'Collection2', 'COL2', 'uri2'];

  //   console.log("Native", native.options.address);
  //   assert.equal(await native.methods.decimals(0).call(), zeroDecimals ? '0' : '18');

  //   console.log(native.methods.setHeader(newCollectionHeader).send(blockchainConnection.getSendingOptions({ from: accounts[1] })));
  //   await mainInterface.methods.setCollectionsMetadata([collection], [newCollectionHeader]).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

  // });

  // it("#623 Change Collection Metadata", async () => {
  //   var zeroDecimals = false;
  //   var collectionId = utilities.voidBytes32;

  //   var collectionHeader = [accounts[1], 'Collection1', 'COL1', 'uri1'];
  //   var newCollectionHeader = [accounts[2], 'Collection2', 'COL2', 'uri2'];

  //   var items = [
  //     [[utilities.voidEthereumAddress, '', '', ''], collectionId, 0, [accounts[1]], [10000]]
  //   ];
  //   var native = await itemsv2.initialization(zeroDecimals, collectionId, collectionHeader, items, accounts[1], "URI");
    
  //   console.log("Native", native.options.address);
  //   assert.equal(await native.methods.decimals(0).call(), zeroDecimals ? '0' : '18');

  //   console.log(native.methods.setItemsMetadata(newCollectionHeader).send(blockchainConnection.getSendingOptions({ from: accounts[1] })));
  // });
});
