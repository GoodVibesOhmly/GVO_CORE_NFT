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
      var native = (await itemsv2.initialization(zeroDecimals, collectionId, collectionHeader, items, accounts[1], "URI"))['native'];
      console.log("Native", native.options.address);
      assert.equal(await native.methods.decimals(0).call(), zeroDecimals ? '0' : '18');
      assert.notEqual(await native.methods.collectionId().call(), utilities.voidBytes32);
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

    var collectionHeader = [nativeProjectionAddress, 'Collection', 'COL', 'uri'];
    var native = (await itemsv2.initialization(zeroDecimals, collectionId, collectionHeader, items, accounts[1], "URI"))['native'];
    assert.equal(await native.methods.decimals(0).call(), zeroDecimals ? '0' : '18');
    assert.equal(await native.methods.collectionId().call(), collectionId);
  });

  it("#620 Change Collection Metadata", async () => {
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;

    var collectionHeader = [utilities.voidEthereumAddress, 'Collection1', 'COL1', 'uri1'];
    var newCollectionHeader = [accounts[1], 'Collection2', 'COL2', 'uri2'];

    var items = [
      [[utilities.voidEthereumAddress, '', '', ''], collectionId, 0, [accounts[1]], [10000]]
    ];
    var native = (await itemsv2.initialization(zeroDecimals, collectionId, collectionHeader, items, accounts[1], "URI"))['native'];
    
    console.log("Native", native.options.address);
    assert.equal(await native.methods.decimals(0).call(), zeroDecimals ? '0' : '18');
    await catchCall(native.methods.setHeader(newCollectionHeader).send(blockchainConnection.getSendingOptions({ from: accounts[2] })), 'Unauthorized');
    await native.methods.setHeader(newCollectionHeader).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    assert.equal(await native.methods.uri().call(), 'uri2');
  });

  it("#621 Change Collection host", async () => {
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;

    var collectionHeader = [utilities.voidEthereumAddress, 'Collection1', 'COL1', 'uri1'];
    var newCollectionHeader = [accounts[1], 'Collection2', 'COL2', 'uri2'];

    var items = [
      [[utilities.voidEthereumAddress, '', '', ''], collectionId, 0, [accounts[1]], [10000]]
    ];
    var native = (await itemsv2.initialization(zeroDecimals, collectionId, collectionHeader, items, accounts[1], "URI"))['native'];
    
    console.log("Native", native.options.address);
    assert.equal(await native.methods.decimals(0).call(), zeroDecimals ? '0' : '18');
    await catchCall(native.methods.setHeader(newCollectionHeader).send(blockchainConnection.getSendingOptions({ from: accounts[2] })), 'Unauthorized');
    await native.methods.setHeader(newCollectionHeader).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    assert.equal(await native.methods.uri().call(), 'uri2');
    await catchCall(native.methods.setHeader(newCollectionHeader).send(blockchainConnection.getSendingOptions({ from: accounts[1] })), 'Unauthorized');
  });

  it("#622 Change Collection host and reset it", async () => {
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;

    var collectionHeader = [utilities.voidEthereumAddress, 'Collection1', 'COL1', 'uri1'];
    var newCollectionHeader = [accounts[1], 'Collection2', 'COL2', 'uri2'];

    var items = [
      [[utilities.voidEthereumAddress, '', '', ''], collectionId, 0, [accounts[1]], [10000]]
    ];
    var native = (await itemsv2.initialization(zeroDecimals, collectionId, collectionHeader, items, accounts[1], "URI"))['native'];
    
    var resetCollectionHeader = [native.options.address, 'Collection2', 'COL2', 'uri2'];

    console.log("Native", native.options.address);
    assert.equal(await native.methods.decimals(0).call(), zeroDecimals ? '0' : '18');
    await catchCall(native.methods.setHeader(newCollectionHeader).send(blockchainConnection.getSendingOptions({ from: accounts[2] })), 'Unauthorized');
    await native.methods.setHeader(newCollectionHeader).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    assert.equal(await native.methods.uri().call(), 'uri2');
    await catchCall(native.methods.setHeader(newCollectionHeader).send(blockchainConnection.getSendingOptions({ from: accounts[1] })), 'Unauthorized');
    await mainInterface.methods.setCollectionsMetadata([await native.methods.collectionId().call()], [resetCollectionHeader]).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    await native.methods.setHeader(newCollectionHeader).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
  });

  it("#623 Change the Metadata of Items", async () => {
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;

    var collectionHeader = [accounts[1], 'Collection1', 'COL1', 'uri1'];

    var items = [
      [[utilities.voidEthereumAddress, '', '', ''], collectionId, 0, [accounts[1]], [10000]]
    ];
    var res = await itemsv2.initialization(zeroDecimals, collectionId, collectionHeader, items, accounts[1], "URI");
    var native = res['native'];
    var itemids = res['itemIds']

    var newCollectionHeader = [native.options.address, 'Collection2', 'COL2', 'uri2'];
  
    await native.methods.setItemsMetadata(itemids, [newCollectionHeader]).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
  });

  it("#624 Change the host of Items", async () => {
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;

    var collectionHeader = [accounts[1], 'Collection1', 'COL1', 'uri1'];

    var items = [
      [[utilities.voidEthereumAddress, '', '', ''], collectionId, 0, [accounts[1]], [10000]]
    ];
    var res = await itemsv2.initialization(zeroDecimals, collectionId, collectionHeader, items, accounts[1], "URI");
    var native = res['native'];
    var itemids = res['itemIds']

    var newCollectionHeader = [accounts[9], 'Collection2', 'COL2', 'uri2'];
  
    await native.methods.setItemsMetadata(itemids, [newCollectionHeader]).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    await catchCall(native.methods.setItemsMetadata(itemids, [collectionHeader]).send(blockchainConnection.getSendingOptions({ from: accounts[2] })), 'Unauthorized');
  });

  it("#625 Change the Collection of Items", async () => {
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;

    var collectionHeader = [accounts[1], 'Collection1', 'COL1', 'uri1'];
    var collectionHeader2 = [accounts[1], 'Collection2', 'COL2', 'uri2'];

    var items = [
      [[utilities.voidEthereumAddress, '', '', ''], collectionId, 0, [accounts[1]], [10000]]
    ];

    var itemsCollection2 = [];

    var res = await itemsv2.initialization(zeroDecimals, collectionId, collectionHeader2, itemsCollection2, accounts[1], "URI");
    var native = res['native'];
    var itemids = res['itemIds']

    var resCollection2 = await itemsv2.initialization(zeroDecimals, collectionId, collectionHeader, items, accounts[1], "URI");
    var nativeCollection2 = resCollection2['native'];

    await native.methods.setItemsCollection(itemids, [await nativeCollection2.methods.collectionId().call()]).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    await catchCall(native.methods.setItemsMetadata(itemids, [collectionHeader2]).send(blockchainConnection.getSendingOptions({ from: accounts[1] })), 'revert');
  });

  it("#626 Change the Collection of Items and reset it", async () => {
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;

    var collectionHeader = [accounts[1], 'Collection1', 'COL1', 'uri1'];
    var collectionHeader2 = [accounts[1], 'Collection2', 'COL2', 'uri2'];

    var items = [
      [[utilities.voidEthereumAddress, '', '', ''], collectionId, 0, [accounts[1]], [10000]]
    ];

    var itemsCollection2 = [];

    var res = await itemsv2.initialization(zeroDecimals, collectionId, collectionHeader2, itemsCollection2, accounts[1], "URI");
    var native = res['native'];
    var itemids = res['itemIds'];

    var resCollection2 = await itemsv2.initialization(zeroDecimals, collectionId, collectionHeader, items, accounts[1], "URI");
    var nativeCollection2 = resCollection2['native'];

    await native.methods.setItemsCollection(itemids, [await nativeCollection2.methods.collectionId().call()]).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    await catchCall(native.methods.setItemsMetadata(itemids, [collectionHeader2]).send(blockchainConnection.getSendingOptions({ from: accounts[1] })), 'revert');

    await nativeCollection2.methods.setItemsCollection(itemids, [await native.methods.collectionId().call()]).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    native.methods.setItemsMetadata(itemids, [collectionHeader2]).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

  });
});
