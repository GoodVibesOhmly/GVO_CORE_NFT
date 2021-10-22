var itemsv2 = require("../resources/itemsv2");
var itemProjection = require("../resources/itemProjection");
const blockchainConnection = require("../util/blockchainConnection");
const utilities = require("../util/utilities");

var MainInterface;
var mainInterface;
describe("Item V2 Projections - Native", () => {
  before(async () => {
    MainInterface = await compile("model/IItemMainInterface");
    mainInterface = new web3.eth.Contract(
      MainInterface.abi,
      knowledgeBase.mainInterfaceAddress
    );
  });

  it("#619 Alternative Initialization", async () => {
    /**
     * Authorized subjects:
     * -initializer address
     * Functions used in the test:
     * lazyInit
     *
     * Initialize the NativeProjection with a previously created Collection id and mint/create Items inside.
     * In this case a Collection is created through the Main interface with a certain host.
     * The NativeProjection is created but not inizialized.
     * The collection.host is set as NativeProjection address.
     * The NativeProjection is initialized passing the collectionId and some Items to mint and create
     */
    var collectionId = utilities.voidBytes32;

    var mainItems = [];

    collectionId = (await itemsv2.createCollection(accounts[1], mainItems))[
      "collectionId"
    ];

    var nativeProjectionAddress = await itemsv2.deployNativeProjection();

    var collectionHeader = {
      host: nativeProjectionAddress,
      name: "Collection",
      symbol: "COL",
      uri: "uri",
    };

    var items = [
      [
        [utilities.voidEthereumAddress, "Item1", "I1", "uriItem1"],
        collectionId,
        0,
        [accounts[1]],
        [10000],
      ],
      [
        [utilities.voidEthereumAddress, "Item2", "I2", "uriItem2"],
        collectionId,
        0,
        [accounts[1]],
        [10000],
      ],
    ];

    await mainInterface.methods
      .setCollectionsMetadata([collectionId], [itemsv2.convertHeader(collectionHeader)])
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    await itemProjection.assertCheckHeader(
      collectionHeader,
      mainInterface.methods.collection(collectionId).call()
    );

    var deployParam = abi.encode(
      [
        "bytes32",
        "tuple(address,string,string,string)",
        "tuple(tuple(address,string,string,string),bytes32,uint256,address[],uint256[])[]",
        "bytes",
      ],
      [collectionId, await itemsv2.convertHeader(collectionHeader), items, utilities.voidBytes32]
    );

    deployParam = abi.encode(
      ["address", "bytes"],
      [knowledgeBase.mainInterfaceAddress, deployParam]
    );

    deployParam = abi.encode(["address", "bytes"], [accounts[1], deployParam]);

    NativeProjection = await compile("projection/native/NativeProjection");

    var native = new web3.eth.Contract(
      NativeProjection.abi,
      nativeProjectionAddress
    );

    await native.methods
      .lazyInit(deployParam)
      .send(blockchainConnection.getSendingOptions());

    await itemProjection.assertCheckHeader(
      collectionHeader,
      mainInterface.methods
        .collection(await native.methods.collectionId().call())
        .call()
    );

    await itemProjection.assertDecimals(
      native.methods.decimals(0).call(),
      0
    );

    await itemProjection.assertEqualCollection(
      native.methods.collectionId().call(),
      collectionId
    );
    var collectionData = await mainInterface.methods
      .collection(collectionId)
      .call();

    await itemProjection.assertEqualHeaderHost(
      collectionData.host,
      native.options.address
    );
  });
  it("#639 Alternative Initialization #2", async () => {
    /**
     * Authorized subjects:
     * -initializer address
     * Functions used in the test:
     * lazyInit
     *
     * Initialize the NativeProjection with a previously created Collection id and mint/create Items inside.
     * In this case a Collection is created through the Main interface with a certain host.
     * The NativeProjection is created and initialized passing the previously created CollectionId
     * The collection.host is set as NativeProjection address.
     */
    var collectionId = utilities.voidBytes32;

    var headerCollection = {
      host: accounts[1],
      name: "Colection1",
      symbol: "C1",
      uri: "uriC1",
    };

    var mainItems = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: utilities.voidBytes32,
        id: 0,
        accounts: [accounts[1]],
        amounts: ["10000000000000000"],
      },
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: utilities.voidBytes32,
        id: 0,
        accounts: [accounts[1]],
        amounts: ["10000000000000000"],
      },
    ];

    var transaction = await mainInterface.methods
      .createCollection(headerCollection, mainItems)
      .send(blockchainConnection.getSendingOptions());
    var logs = (
      await web3.eth.getTransactionReceipt(transaction.transactionHash)
    ).logs;
    var collectionId = web3.eth.abi.decodeParameter(
      "bytes32",
      logs.filter(
        (it) =>
          it.topics[0] ===
          web3.utils.sha3("Collection(address,address,bytes32)")
      )[0].topics[3]
    );
    var itemIds = logs
      .filter(
        (it) =>
          it.topics[0] ===
          web3.utils.sha3("CollectionItem(bytes32,bytes32,uint256)")
      )
      .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

    var items = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId,
        id: itemIds[0],
        accounts: [accounts[1], accounts[2], accounts[3]],
        amounts: [
          "10000000000000",
          "2000000000000000",
          "30000000000000000",
        ],
      },
      {
        header: {
          host: accounts[1],
          name: "Item2",
          symbol: "I2",
          uri: "uriItem2",
        },
        collectionId,
        id: itemIds[1],
        accounts: [accounts[4], accounts[7], accounts[9]],
        amounts: [
          "10000000000000000",
          "100000000000",
          "300000000000000",
        ],
      },
    ].map(it => [Object.values(it.header), ...Object.entries(it).filter(it => it[0] !== 'header').map(it => it[1])]);

    //items = abi.encode(["tuple(tuple(address,string,string,string),bytes32,uint256,address[],uint256[])[]"], [items]);

    var collectionHeader = [accounts[1], "Collection", "COL", "uri"];

    await catchCall(
      itemsv2.initialization(
        collectionId,
        collectionHeader,
        items,
        accounts[1],
        "URI"
      ), 'unauthorized'
    );

    items = [];

    var native = (
      await itemsv2.initialization(
        collectionId,
        collectionHeader,
        items,
        accounts[1],
        "URI"
      )
    )["native"];

    collectionHeader = {
      host: native.options.address,
      name: "Collection",
      symbol: "COL",
      uri: "uri",
    };

    await mainInterface.methods
      .setCollectionsMetadata([collectionId], [collectionHeader])
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    await itemProjection.assertDecimals(
      native.methods.decimals(0).call(),
      0
    );
    await itemProjection.assertEqualCollection(
      native.methods.collectionId().call(),
      collectionId
    );

    var collectionData = await mainInterface.methods
      .collection(collectionId)
      .call();

    await itemProjection.assertEqualHeaderHost(
      collectionData.host,
      native.options.address
    );

    var CreateItem = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await native.methods.collectionId().call(),
        id: itemIds[0],
        accounts: [accounts[1], accounts[2], accounts[3]],
        amounts: [
          "10000000000000",
          "2000000000000000",
          "30000000000000000",
        ],
      },
      {
        header: {
          host: accounts[1],
          name: "Item2",
          symbol: "I2",
          uri: "uriItem2",
        },
        collectionId: await native.methods.collectionId().call(),
        id: itemIds[1],
        accounts: [accounts[4], accounts[7], accounts[9]],
        amounts: [
          "10000000000000000",
          "100000000000",
          "300000000000000",
        ],
      },
    ];

    var checkBal = await Promise.all(
      CreateItem.map(async (it, i) => {
        return await itemsv2.checkBalances(
          it.accounts,
          Array(it.accounts.length).fill(itemIds[i])
        );
      })
    );

    await native.methods
      .mintItems(CreateItem)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    await itemProjection.assertCheckBalance(checkBal, CreateItem, itemIds);
  });

  it("#649 Alternative initialization #3", async () => {
    /**
    * Authorized subjects:
    * -initializer address
    * Functions used in the test:
    * lazyInit
    *
    * Initialize the NativeProjection with a previously created Collection id and mint Items inside.
    * In this case a Collection, with some Items, is created through the Main interface with a certain host.
    * The NativeProjection is created but not inizialized.
    * The collection.host is set as NativeProjection address.
    * The NativeProjection is initialized passing the collectionId and some Items to mint and create
    * The mintItems function is called on the Native Projection minting the previously created Items
    */
    var collectionId = utilities.voidBytes32;
    var headerCollection = {
      host: accounts[1],
      name: "Colection1",
      symbol: "C1",
      uri: "uriC1",
    };

    var mainItems = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: collectionId,
        id: 0,
        accounts: [accounts[1]],
        amounts: ["10000000000000000"],
      },
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: collectionId,
        id: 0,
        accounts: [accounts[1]],
        amounts: ["10000000000000000"],
      },
    ];

    var transaction = await mainInterface.methods
      .createCollection(headerCollection, mainItems)
      .send(blockchainConnection.getSendingOptions());
    var logs = (
      await web3.eth.getTransactionReceipt(transaction.transactionHash)
    ).logs;
    var collectionId = web3.eth.abi.decodeParameter(
      "bytes32",
      logs.filter(
        (it) =>
          it.topics[0] ===
          web3.utils.sha3("Collection(address,address,bytes32)")
      )[0].topics[3]
    );
    var itemIds = logs
      .filter(
        (it) =>
          it.topics[0] ===
          web3.utils.sha3("CollectionItem(bytes32,bytes32,uint256)")
      )
      .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

    var nativeProjectionAddress = await itemsv2.deployNativeProjection();

    var expectedCollection = {
      host: nativeProjectionAddress,
      name: "Collection",
      symbol: "COL",
      uri: "uri",
    };

    var collectionHeader = 
    {
      host: nativeProjectionAddress,
      name: "Collection",
      symbol: "COL",
      uri: "uri",
    };

    var items = [];

    await mainInterface.methods
      .setCollectionsMetadata([collectionId], [itemsv2.convertHeader(collectionHeader)])
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    await itemProjection.assertCheckHeader(
      expectedCollection,
      mainInterface.methods.collection(collectionId).call()
    );

    var deployParam = abi.encode(
      [
        "bytes32",
        "tuple(address,string,string,string)",
        "tuple(tuple(address,string,string,string),bytes32,uint256,address[],uint256[])[]",
        "bytes",
      ],
      [collectionId, await itemsv2.convertHeader(collectionHeader), items, utilities.voidBytes32]
    );

    deployParam = abi.encode(
      ["address", "bytes"],
      [knowledgeBase.mainInterfaceAddress, deployParam]
    );

    deployParam = abi.encode(["address", "bytes"], [accounts[1], deployParam]);

    NativeProjection = await compile("projection/native/NativeProjection");

    var native = new web3.eth.Contract(
      NativeProjection.abi,
      nativeProjectionAddress
    );

    await native.methods
      .lazyInit(deployParam)
      .send(blockchainConnection.getSendingOptions());

    await itemProjection.assertCheckHeader(
      expectedCollection,
      mainInterface.methods
        .collection(await native.methods.collectionId().call())
        .call()
    );

    await itemProjection.assertDecimals(
      native.methods.decimals(0).call(),
      0
    );

    await itemProjection.assertEqualCollection(
      native.methods.collectionId().call(),
      collectionId
    );
    var collectionData = await mainInterface.methods
      .collection(collectionId)
      .call();

    await itemProjection.assertEqualHeaderHost(
      collectionData.host,
      native.options.address
    );
    var CreateItem = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await native.methods.collectionId().call(),
        id: itemIds[0],
        accounts: [accounts[1], accounts[2], accounts[3]],
        amounts: [
          "10000000000000000",
          "10000000000000000",
          "10000000000000000",
        ],
      },
      {
        header: {
          host: accounts[1],
          name: "Item2",
          symbol: "I2",
          uri: "uriItem2",
        },
        collectionId: await native.methods.collectionId().call(),
        id: itemIds[1],
        accounts: [accounts[4], accounts[7], accounts[9]],
        amounts: [
          "10000000000000000",
          "10000000000000000",
          "10000000000000000",
        ],
      },
    ];

    var checkBal = await Promise.all(
      CreateItem.map(async (it, i) => {
        return await itemsv2.checkBalances(
          it.accounts,
          Array(it.accounts.length).fill(itemIds[i])
        );
      })
    );

    await native.methods
      .mintItems(CreateItem)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    await itemProjection.assertCheckBalance(checkBal, CreateItem, itemIds);
  });

  it("#620 Change Collection Metadata", async () => {
    /**
     * Authorized subjects:
     * Collection host address
     * Functions used in the test:
     * lazyInit
     * setHeader(Header calldata value)
     *
     * Change the Metadata of the Collection (not the host)
     * must fail: cannot change the header from an unauthorized account
     */
    var collectionId = utilities.voidBytes32;

    var collectionHeader = {
      host: utilities.voidEthereumAddress,
      name: "Collection1",
      symbol: "COL1",
      uri: "uri1",
    };

    var newCollectionHeader = {
      host: accounts[1],
      name: "Collection2",
      symbol: "COL2",
      uri: "uri2",
    };

    var items = [
      [
        [utilities.voidEthereumAddress, "Item1", "I1", "uriItem1"],
        collectionId,
        0,
        [accounts[1]],
        [10000],
      ],
    ];
    
    var native = (
      await itemsv2.initialization(
        collectionId,
        collectionHeader,
        items,
        accounts[1],
        "URI"
      )
    )["native"];

    var expectedCollection = {
      host: native.options.address,
      name: "Collection1",
      symbol: "COL1",
      uri: "uri1",
    };

    var expectedNewCollection = {
      host: accounts[1],
      name: "Collection2",
      symbol: "COL2",
      uri: "uri2",
    };

    await itemProjection.assertCheckHeader(
      expectedCollection,
      mainInterface.methods
        .collection(await native.methods.collectionId().call())
        .call()
    );

    console.log("Native", native.options.address);
    await itemProjection.assertDecimals(
      native.methods.decimals(0).call(),
      0
    );

    await catchCall(
      native.methods
        .setHeader(newCollectionHeader)
        .send(blockchainConnection.getSendingOptions({ from: accounts[2] })),
      "Unauthorized"
    );

    await native.methods
      .setHeader(newCollectionHeader)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    await itemProjection.assertCheckHeader(
      expectedNewCollection,
      mainInterface.methods
        .collection(await native.methods.collectionId().call())
        .call()
    );

    await itemProjection.assertEqualHeaderUri(
      native.methods.uri().call(),
      "uri2"
    );
  });

  it("#621 Change Collection host", async () => {
    /**
     * Authorized subjects:
     * Collection host address
     * Functions used in the test:
     * lazyInit
     * setHeader(Header calldata value)
     *
     * Change the Metadata of the host of the Collection.
     * Changing the host means that the Projection address is no longer the host address and so it can't manage anymore the Collection.
     * must fail: cannot change the header from an unauthorized account
     */
    var collectionId = utilities.voidBytes32;

    var collectionHeader = {
      host: utilities.voidEthereumAddress,
      name: "Collection1",
      symbol: "COL1",
      uri: "uri1",
    };

    var newCollectionHeader = {
      host: accounts[3],
      name: "Collection2",
      symbol: "COL2",
      uri: "uri2",
    };

    var items = [
      [
        [utilities.voidEthereumAddress, "Item1", "I1", "uriItem1"],
        collectionId,
        0,
        [accounts[1]],
        [10000],
      ],
    ];
    var res = await itemsv2.initialization(
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );

    var native = res["native"];
    var itemIds = res["itemIds"];

    var expectedCollection = {
      host: native.options.address,
      name: "Collection1",
      symbol: "COL1",
      uri: "uri1",
    };

    var expectedNewCollection = {
      host: accounts[3],
      name: "Collection2",
      symbol: "COL2",
      uri: "uri2",
    };
    await itemProjection.assertCheckHeader(
      expectedCollection,
      mainInterface.methods
        .collection(await native.methods.collectionId().call())
        .call()
    );

    console.log("Native", native.options.address);

    await itemProjection.assertDecimals(
      native.methods.decimals(0).call(),
      0
    );
    await catchCall(
      native.methods
        .setHeader(newCollectionHeader)
        .send(blockchainConnection.getSendingOptions({ from: accounts[2] })),
      "Unauthorized"
    );

    await native.methods
      .setHeader(newCollectionHeader)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    await itemProjection.assertCheckHeader(
      expectedNewCollection,
      mainInterface.methods
        .collection(await native.methods.collectionId().call())
        .call()
    );
    collectionData = await mainInterface.methods
      .collection(await native.methods.collectionId().call())
      .call();

    await itemProjection.assertEqualHeaderHost(
      collectionData.host,
      accounts[3]
    );

    await itemProjection.assertEqualHeaderUri(
      native.methods.uri().call(),
      "uri2"
    );

    var CreateItem = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await native.methods.collectionId().call(),
        id: itemIds[0],
        accounts: [accounts[1], accounts[2], accounts[3]],
        amounts: [
          "10000000000000",
          "20000000000000000",
          "300000000000",
        ],
      },
    ];

    var checkBal = await Promise.all(
      CreateItem.map(async (it, i) => {
        return await itemsv2.checkBalances(
          it.accounts,
          Array(it.accounts.length).fill(itemIds[i])
        );
      })
    );

    await mainInterface.methods
      .mintItems(CreateItem)
      .send(blockchainConnection.getSendingOptions({ from: accounts[3] }));
    await itemProjection.assertCheckBalance(checkBal, CreateItem, itemIds);
  });

  it("#622 Change Collection host and reset it", async () => {
    /**
     * Authorized subjects:
     * Collection host address
     * Functions used in the test:
     * lazyInit
     * setHeader(Header calldata value)
     *
     * Change the host of the Collection.
     * Changing the host means that the Projection address is no longer the host address and so it can't manage anymore the Collection.
     * The Collection is managed by the new host.
     * The new host change it by setting the NativeProjection address again as host.
     * The Native Projection can manage the Collection another time
     * must fail: cannot change the header from an unauthorized account
     */
    var collectionId = utilities.voidBytes32;

    var collectionHeader =  {
      host: utilities.voidEthereumAddress,
      name: "Collection1",
      symbol: "COL1",
      uri: "uri1",
    };

    var newCollectionHeader = {
      host: accounts[3],
      name: "Collection2",
      symbol: "COL2",
      uri: "uri2",
    };

    var items = [
      [
        [utilities.voidEthereumAddress, "Item1", "I1", "uriItem1"],
        collectionId,
        0,
        [accounts[1]],
        [10000],
      ],
    ];
    var res = await itemsv2.initialization(
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );

    var native = res["native"];
    var itemIds = res["itemIds"];

    var expectedCollection = {
      host: native.options.address,
      name: "Collection1",
      symbol: "COL1",
      uri: "uri1",
    };

    var expectedNewCollection = {
      host: accounts[3],
      name: "Collection2",
      symbol: "COL2",
      uri: "uri2",
    };
    await itemProjection.assertCheckHeader(
      expectedCollection,
      mainInterface.methods
        .collection(await native.methods.collectionId().call())
        .call()
    );

    var resetCollectionHeader = {
      host: native.options.address,
      name: "Collection2",
      symbol: "COL2",
      uri: "uri2",
    };

    console.log("Native", native.options.address);
    await itemProjection.assertDecimals(
      native.methods.decimals(0).call(),
      0
    );

    await catchCall(
      native.methods
        .setHeader(newCollectionHeader)
        .send(blockchainConnection.getSendingOptions({ from: accounts[2] })),
      "Unauthorized"
    );

    await native.methods
      .setHeader(newCollectionHeader)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    await itemProjection.assertCheckHeader(
      expectedNewCollection,
      mainInterface.methods
        .collection(await native.methods.collectionId().call())
        .call()
    );
    await itemProjection.assertEqualHeaderUri(
      native.methods.uri().call(),
      "uri2"
    );

    await catchCall(
      native.methods
        .setHeader(newCollectionHeader)
        .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
      "Unauthorized"
    );

    await blockchainConnection.unlockAccounts(native.options.address);

    await catchCall(
      mainInterface.methods
      .setCollectionsMetadata(
        [await native.methods.collectionId().call()],
        [resetCollectionHeader]
      )
      .send(blockchainConnection.getSendingOptions({ from: native.options.address })),
      "Unauthorized"
    );

    await mainInterface.methods
      .setCollectionsMetadata(
        [await native.methods.collectionId().call()],
        [resetCollectionHeader]
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[3] }));

    await itemProjection.assertCheckHeader(
      resetCollectionHeader,
      mainInterface.methods
        .collection(await native.methods.collectionId().call())
        .call()
    );

    var CreateItem = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await native.methods.collectionId().call(),
        id: itemIds[0],
        accounts: [accounts[1], accounts[2], accounts[3]],
        amounts: [
          "10000000000000000",
          "10000000000000000",
          "10000000000000000",
        ],
      },
    ];

    var checkBal = await Promise.all(
      CreateItem.map(async (it, i) => {
        return await itemsv2.checkBalances(
          it.accounts,
          Array(it.accounts.length).fill(itemIds[i])
        );
      })
    );

    await native.methods
      .mintItems(CreateItem)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    await itemProjection.assertCheckBalance(checkBal, CreateItem, itemIds);
  });
  it("#623 Change the Metadata of Items", async () => {
    /**
     * Authorized subjects:
     * Collection host address
     * Functions used in the test:
     * lazyInit
     * setItemsMetadata(uint256[] calldata itemIds, Header[] calldata values)
     *
     * Change the Metadata of the Collection Items (not host).
     * must fail: an address different from the host can't change the Items Metadata
     */
    var collectionId = utilities.voidBytes32;

    var collectionHeader = {
      host: accounts[1],
      name: "Collection1",
      symbol: "COL1",
      uri: "uri1",
    };

    var items = [
      [
        [utilities.voidEthereumAddress, "Item1", "I1", "uriItem1"],
        collectionId,
        0,
        [accounts[1]],
        [10000],
      ],
    ];
    var res = await itemsv2.initialization(
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );
    var native = res["native"];
    var itemIds = res["itemIds"];

    var expectedCollection = {
      host: native.options.address,
      name: "Collection1",
      symbol: "COL1",
      uri: "uri1",
    };

    await itemProjection.assertCheckHeader(
      expectedCollection,
      mainInterface.methods
        .collection(await native.methods.collectionId().call())
        .call()
    );

    var newItemHeader = {
      host: native.options.address,
      name: "Item2",
      symbol: "I2",
      uri: "uri2",
    };

    await catchCall(
      native.methods
      .setItemsMetadata(itemIds, [newItemHeader])
      .send(blockchainConnection.getSendingOptions({ from: accounts[9] })),
      "unauthorized"
    );

    await native.methods
      .setItemsMetadata(itemIds, [newItemHeader])
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var ExpectedResult = {
      header: {
        host: utilities.voidEthereumAddress,
        name: "Item2",
        symbol: "I2",
        uri: "uri2",
      },
      collectionId: await native.methods.collectionId().call(),
      id: itemIds[0],
      accounts: [accounts[1]],
      amounts: [10000],
    };

    await itemProjection.checkItem(
      ExpectedResult,
      await mainInterface.methods.item(itemIds[0]).call()
    );
  });

  it("#624 Change the host of Items", async () => {
    /**
     * Authorized subjects:
     * Collection host address
     * Functions used in the test:
     * lazyInit
     * setItemsMetadata(uint256[] calldata itemIds, Header[] calldata values)
     *
     * Change the host of Items.
     * This operation cannot be performed because the host of an Item is ever equal to void address.
     * must fail: cannot change the header from an unauthorized account
     */
    var collectionId = utilities.voidBytes32;

    var collectionHeader = {
      host: accounts[1],
      name: "Collection1",
      symbol: "COL1",
      uri: "uri1",
    };

    var items = [
      [
        [utilities.voidEthereumAddress, "Item1", "I1", "uriItem1"],
        collectionId,
        0,
        [accounts[1]],
        [10000],
      ],
    ];
    var res = await itemsv2.initialization(
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );
    var native = res["native"];
    var itemIds = res["itemIds"];
    var expectedCollection = {
      host: native.options.address,
      name: "Collection1",
      symbol: "COL1",
      uri: "uri1",
    };
    await itemProjection.assertCheckHeader(
      expectedCollection,
      mainInterface.methods
        .collection(await native.methods.collectionId().call())
        .call()
    );

    var ItemHeader = {
      host: accounts[9],
      name: "Item2",
      symbol: "I2",
      uri: "uri2",
    };

    await native.methods
      .setItemsMetadata(itemIds, [ItemHeader])
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    await catchCall(
      native.methods
        .setItemsMetadata(itemIds, [collectionHeader])
        .send(blockchainConnection.getSendingOptions({ from: accounts[9] })),
      "Unauthorized"
    );
    var ExpectedResult = {
      header: {
        host: utilities.voidEthereumAddress,
        name: "Item2",
        symbol: "I2",
        uri: "uri2",
      },
      collectionId: await native.methods.collectionId().call(),
      id: itemIds[0],
      accounts: [accounts[1]],
      amounts: [10000],
    };

    await itemProjection.checkItem(
      ExpectedResult,
      await mainInterface.methods.item(itemIds[0]).call()
    );
  });

  it("#625 Change the Collection of Items", async () => {
    /**
     * Authorized subjects:
     * Collection host address
     * Functions used in the test:
     * lazyInit
     * setItemsCollection(uint256[] calldata itemIds, bytes32[] calldata collectionIds)
     *
     * Change the Collection of Items.
     * Changing the Collection id, the Items can be no longer managed by the Projection
     * must fail: an address different from the host can't change the Items Collection
     */
    var collectionId = utilities.voidBytes32;

    var collectionHeader = {
      host: accounts[1],
      name: "Collection1",
      symbol: "COL1",
      uri: "uri1",
    };
    var collectionHeader2 = {
      host: accounts[1],
      name: "Collection2",
      symbol: "COL2",
      uri: "uri2",
    };

    var items = [
      [
        [utilities.voidEthereumAddress, "Item1", "I1", "uriItem1"],
        collectionId,
        0,
        [accounts[1]],
        [10000],
      ],
      [
        [utilities.voidEthereumAddress, "Item2", "I2", "uriItem2"],
        collectionId,
        0,
        [accounts[1]],
        [10000],
      ],
    ];

    var itemsCollection2 = [];

    var res = await itemsv2.initialization(
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );
    var native = res["native"];
    var itemIds = res["itemIds"];

    var expectedCollection = {
      host: native.options.address,
      name: "Collection1",
      symbol: "COL1",
      uri: "uri1",
    };
    await itemProjection.assertCheckHeader(
      expectedCollection,
      mainInterface.methods
        .collection(await native.methods.collectionId().call())
        .call()
    );

    var resCollection2 = await itemsv2.initialization(
      collectionId,
      collectionHeader2,
      itemsCollection2,
      accounts[1],
      "URI"
    );
    var nativeCollection2 = resCollection2["native"];

    var collection2Id = await nativeCollection2.methods.collectionId().call();

    await catchCall(
      native.methods
        .setItemsCollection(itemIds, [collection2Id, collection2Id])
        .send(blockchainConnection.getSendingOptions({ from: accounts[9] })),
      "Unauthorized"
    );

    await native.methods
      .setItemsCollection(itemIds, [collection2Id, collection2Id])
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    await catchCall(
        native.methods
          .setItemsCollection(itemIds, [collection2Id, collection2Id])
          .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
        "Unauthorized"
    );

    await blockchainConnection.unlockAccounts(native.options.address);
    await catchCall(
      mainInterface.methods
        .setItemsCollection(itemIds, [collection2Id, collection2Id])
        .send(blockchainConnection.getSendingOptions({ from: native.options.address })),
      "Unauthorized"
  );

    await itemProjection.assertCheckCollection(items, collection2Id);
  });

  it("#626 Change the Collection of Items and reset it", async () => {
    /**
     * Authorized subjects:
     * Collection host address
     * Functions used in the test:
     * lazyInit
     * setItemsCollection(uint256[] calldata itemIds, bytes32[] calldata collectionIds)
     *
     * Change the Collection of Items.
     * Changing the Collection id, the Items can be no longer managed by the Projection.
     * The Items can be managed by the new Collection.
     * The new Collection host change the Collection by setting the NativeProjection Collection again as Collection.
     * The Items can be managed by the Projection another time.
     */
    var collectionId = utilities.voidBytes32;

    var collectionHeader = {
      host: accounts[1],
      name: "Collection1",
      symbol: "COL1",
      uri: "uri1",
    };
    var collectionHeader2 = {
      host: accounts[3],
      name: "Collection2",
      symbol: "COL2",
      uri: "uri2",
    };
    var collectionHeader3 = {
      host: accounts[5],
      name: "Collection3",
      symbol: "COL3",
      uri: "uri3",
    };

    var items = [
      [
        [utilities.voidEthereumAddress, "Item1", "I1", "uriItem1"],
        collectionId,
        0,
        [accounts[1]],
        [10000],
      ],
      [
        [utilities.voidEthereumAddress, "Item2", "I2", "uriItem2"],
        collectionId,
        0,
        [accounts[1]],
        [10000],
      ],
    ];

    var itemsCollection2 = [];
    var itemsCollection3 = [];

    var res = await itemsv2.initialization(
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );
    var native = res["native"];
    var itemIds = res["itemIds"];

    var expectedCollection = {
      host: native.options.address,
      name: "Collection1",
      symbol: "COL1",
      uri: "uri1",
    };
    await itemProjection.assertCheckHeader(
      expectedCollection,
      mainInterface.methods
        .collection(await native.methods.collectionId().call())
        .call()
    );

    var resCollection2 = await itemsv2.initialization(
      collectionId,
      collectionHeader2,
      itemsCollection2,
      accounts[1],
      "URI"
    );
    var nativeCollection2 = resCollection2["native"];

    var collection2Id = await nativeCollection2.methods.collectionId().call();
    var collection1Id = await native.methods.collectionId().call();

    var resCollection3 = await itemsv2.initialization(
      collectionId,
      collectionHeader3,
      itemsCollection3,
      accounts[1],
      "URI"
    );
    var nativeCollection3 = resCollection3["native"];

    var collection3Id = await nativeCollection3.methods.collectionId().call();

    await native.methods
      .setItemsCollection([itemIds[0]], [collection2Id])
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    await catchCall(
        native.methods
          .setItemsCollection([itemIds[0]], [collection2Id])
          .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
        "Unauthorized"
    );

    await blockchainConnection.unlockAccounts(native.options.address);
    await catchCall(
      mainInterface.methods
      .setItemsCollection([itemIds[0]], [collection2Id])
      .send(blockchainConnection.getSendingOptions({ from: native.options.address })),
      "Unauthorized"
  );

    await itemProjection.assertCheckCollection(items, collection2Id);

    await native.methods
      .setItemsCollection([itemIds[1]], [collection3Id])
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    await itemProjection.assertCheckCollection(items, collection3Id);

    await nativeCollection2.methods
      .setItemsCollection([itemIds[0]], [collection1Id])
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    await nativeCollection3.methods
      .setItemsCollection([itemIds[1]], [collection1Id])
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    items.map(async (it, index) => {
      await itemProjection.assertCheckCollection(it, collection1Id);
    });
  });

  it("#627 Create Items", async () => {
    /**
     * Authorized subjects:
     * Collection host address
     * Functions used in the test:
     * lazyInit
     * mintItems (CreateItem[] calldata items)
     *
     * Create new Items for different accounts and amounts calling the Native Projection mintItems functions.
     */
    var collectionId = utilities.voidBytes32;

    var collectionHeader = [accounts[1], "Collection1", "COL1", "uri1"];

    var items = [];

    var res = await itemsv2.initialization(
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );
    var native = res["native"];

    var CreateItem = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await native.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[1], accounts[2]],
        amounts: ["10000000000000000", "200000"],
      },
    ];

    await catchCall(
      native.methods
        .mintItems(CreateItem)
        .send(blockchainConnection.getSendingOptions({ from: accounts[6] })),
      "Unauthorized"
    );

    await itemProjection.assertCheckBalanceSupply(
      native.methods
        .mintItems(CreateItem)
        .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
      CreateItem,
    );
  });

  it("#628 Mint Items", async () => {
    /**
     * Authorized subjects:
     * Collection host address
     * Functions used in the test:
     * lazyInit
     * mintItems (CreateItem[] calldata items)
     *
     * Mint previously created Items for different accounts and amounts calling the Native Projection mintItems functions.
     * must fail: cannot mint items from unauthorized address
     */
    var collectionId = utilities.voidBytes32;

    var collectionHeader = {
      host: accounts[1],
      name: "Collection1",
      symbol: "COL1",
      uri: "uri1",
    };

    var items = [
      [
        [utilities.voidEthereumAddress, "Item1", "I1", "uriItem1"],
        collectionId,
        0,
        [accounts[1]],
        [10000],
      ],
      [
        [utilities.voidEthereumAddress, "Item2", "I2", "uriItem2"],
        collectionId,
        0,
        [accounts[1]],
        [10000],
      ],
    ];

    var res = await itemsv2.initialization(
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );
    var native = res["native"];
    var itemIds = res["itemIds"];

    var CreateItem = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await native.methods.collectionId().call(),
        id: itemIds[0],
        accounts: [accounts[1], accounts[2], accounts[3]],
        amounts: ["30000000000", "30000000000", "30000000000"],
      },
      {
        header: {
          host: accounts[1],
          name: "Item2",
          symbol: "I2",
          uri: "uriItem2",
        },
        collectionId: await native.methods.collectionId().call(),
        id: itemIds[1],
        accounts: [accounts[4], accounts[7], accounts[9]],
        amounts: ["30000000000", "30000000000", "30000000000"],
      },
    ];

    var checkBal = await Promise.all(
      CreateItem.map(async (it, i) => {
        return await itemsv2.checkBalances(
          it.accounts,
          Array(it.accounts.length).fill(itemIds[i])
        );
      })
    );

    await catchCall(
      native.methods
        .mintItems(CreateItem)
        .send(blockchainConnection.getSendingOptions({ from: accounts[8] })),
      "Unauthorized"
    );

    await native.methods
      .mintItems(CreateItem)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    await itemProjection.assertCheckBalance(checkBal, CreateItem, itemIds);
  });

  it("#630 Create Items for Collection ids and Items ids that don't exist", async () => {
    /**
     * Authorized subjects:
     * Collection host address
     * Functions used in the test:
     * lazyInit
     * mintItems (CreateItem[] calldata items)
     *
     * Create new Items for different accounts and amounts calling the Native Projection mintItems functions using wrong Collection ids and Item
     *ids
     * Using non-existent means that the Items cannot be created
     * must fail: I cannot create items from a non-existing collection/id
     */
    var collectionId = utilities.voidBytes32;

    var collectionHeader = {
      host: accounts[1],
      name: "Collection1",
      symbol: "COL1",
      uri: "uri1",
    };

    var items = [];

    var res = await itemsv2.initialization(
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );
    var native = res["native"];

    var CreateItem = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: web3.utils.sha3("lalelakelkl"),
        id: 697231,
        accounts: [accounts[1]],
        amounts: ["10000000000000000"],
      },
    ];

    await catchCall(
      native.methods
        .mintItems(CreateItem)
        .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
      "Unauthorized"
    );
  });

  it("#631 Create and mint Items with Collection ids and Items ids not controlled by the Projection", async () => {
    /**
    * Authorized subjects:
    * Collection host address
    * Functions used in the test:
    * lazyInit
    * mintItems (CreateItem[] calldata items)
    *
    * Mint new Items for different accounts and amounts calling the Native Projection mintItems functions using other Collection ids and Item
    *ids
    * Using a Collection id different from the one controlled by the Projection and Items ids belonging to that Collection means that the Items cannot be minted
    * must fail: cannot mint items with Collection ids and Items ids not controlled by the Projection
    */
    var collectionId = utilities.voidBytes32;

    var headerCollection = {
      host: accounts[1],
      name: "Colection1",
      symbol: "C1",
      uri: "uriC1",
    };

    var item = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: utilities.voidBytes32,
        id: 0,
        accounts: [accounts[1]],
        amounts: ["10000000000000000"],
      },
    ];

    var result = await mainInterface.methods
      .createCollection(headerCollection, item)
      .send(blockchainConnection.getSendingOptions());
    var res = result.events.CollectionItem.returnValues;

    var collectionIdMain = res["toCollectionId"];
    var idItemsMain = res["itemId"];

    var collectionHeader = [accounts[1], "Collection1", "COL1", "uri1"];

    var items = [
      [
        [utilities.voidEthereumAddress, "Item1", "I1", "uriItem1"],
        collectionIdMain,
        idItemsMain,
        [accounts[1]],
        [10000],
      ],
    ];

    var res = await itemsv2.initialization(
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );
    var native = res["native"];
    var itemIds = res["itemIds"][0];

    assert.notEqual(itemIds, idItemsMain);
    assert.notEqual(await native.methods.collectionId().call(), collectionId);

    var CreateItem = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: collectionIdMain,
        id: idItemsMain,
        accounts: [accounts[1]],
        amounts: ["10000000000000000"],
      },
    ];

    await catchCall(
      native.methods
        .mintItems(CreateItem)
        .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
      "Unauthorized"
    );

    var CreateNativeItem = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await native.methods.collectionId().call(),
        id: itemIds,
        accounts: [accounts[1]],
        amounts: ["10000000000000000"],
      },
    ];

    var checkBal = await Promise.all(
      CreateNativeItem.map(async (it, i) => {
        return await itemsv2.checkBalances(
          it.accounts,
          Array(it.accounts.length).fill(itemIds)
        );
      })
    );

    await native.methods
      .mintItems(CreateNativeItem)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    await itemProjection.assertCheckBalance(
      checkBal,
      CreateNativeItem,
      itemIds
    );
  });

  it("#632 Create and mint Items without passing the Header", async () => {
    /**
     * Authorized subjects:
     * Collection host address
     * Functions used in the test:
     * lazyInit
     * mintItems (CreateItem[] calldata items)
     *
     * Create and Mint new Items for different accounts and amounts calling the Native Projection mintItems functions without passing the Header.
     * The data are automatically taken from the Collection Header.
     */
    var collectionId = utilities.voidBytes32;

    var collectionHeader = {
      host: accounts[1],
      name: "Collection1",
      symbol: "COL1",
      uri: "uri1",
    };

    var items = [
      [
        [utilities.voidEthereumAddress, "", "", ""],
        collectionId,
        0,
        [accounts[1]],
        [10000],
      ],
    ];

    var res = await itemsv2.initialization(
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );
    var native = res["native"];
    var itemIds = res["itemIds"][0];

    var CreateItem = [
      {
        header: {
          host: utilities.voidEthereumAddress,
          name: "",
          symbol: "",
          uri: "",
        },
        collectionId: await native.methods.collectionId().call(),
        id: itemIds,
        accounts: [accounts[1]],
        amounts: ["10000000000000000"],
      },
    ];

    var checkBal = await Promise.all(
      CreateItem.map(async (it, i) => {
        return await itemsv2.checkBalances(
          it.accounts,
          Array(it.accounts.length).fill(itemIds)
        );
      })
    );

    await native.methods
      .mintItems(CreateItem)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    await itemProjection.assertCheckBalance(checkBal, CreateItem, itemIds);

    var ExpectedResult = {
      header: {
        host: utilities.voidEthereumAddress,
        name: "Collection1",
        symbol: "COL1",
        uri: "uri1",
      },
      collectionId: await native.methods.collectionId().call(),
      id: itemIds,
      accounts: [accounts[1]],
      amounts: ["10000000000000000"],
    };

    await itemProjection.checkItem(
      ExpectedResult,
      await mainInterface.methods.item(itemIds).call()
    );
  });


  it("#632/2 Create Items without passing the Header", async () => {
    /**
     * Authorized subjects:
     * Collection host address
     * Functions used in the test:
     * lazyInit
     * mintItems (CreateItem[] calldata items)
     *
     * Create and Mint new Items for different accounts and amounts calling the Native Projection mintItems functions without passing the Header.
     * The data are automatically taken from the Collection Header.
     */
    var collectionId = utilities.voidBytes32;

    var collectionHeader = {
      host: accounts[1],
      name: "Collection1",
      symbol: "COL1",
      uri: "uri1",
    };

    var items = [];

    var res = await itemsv2.initialization(
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );
    var native = res["native"];

    var CreateItem = [
      {
        header: {
          host: utilities.voidEthereumAddress,
          name: "",
          symbol: "",
          uri: "",
        },
        collectionId: await native.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[1]],
        amounts: ["10000000000000000"],
      },
    ];

    var tx = await itemProjection.assertCheckBalanceSupply(
      native.methods
        .mintItems(CreateItem)
        .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
      CreateItem,
    );

    var itemIds = await itemProjection.getItemIdFromLog(tx);

    var ExpectedResult = {
      header: {
        host: utilities.voidEthereumAddress,
        name: "Collection1",
        symbol: "COL1",
        uri: "uri1",
      },
      collectionId: await native.methods.collectionId().call(),
      id: itemIds[0],
      accounts: [accounts[1]],
      amounts: ["10000000000000000"],
    };

    await itemProjection.checkItem(
      ExpectedResult,
      await mainInterface.methods.item(itemIds[0]).call()
    );
  });

  it("#633 Create and mint Items passing a host address different from void address", async () => {
    /**
     * Authorized subjects:
     * Collection host address
     * Functions used in the test:
     * lazyInit
     * mintItems (CreateItem[] calldata items)
     *
     * Create and mint new Items for different accounts and amounts calling the Native Projection mintItems functions passing an Item host
     * The Item host set is not a valid parameter.
     * The host is automatically set as void address.
     */
    var collectionId = utilities.voidBytes32;

    var collectionHeader = {
      host: accounts[1],
      name: "Collection1",
      symbol: "COL1",
      uri: "uri1",
    };

    var items = [
      [
        [accounts[1], "Item1", "I1", "uriItem1"],
        collectionId,
        0,
        [accounts[1]],
        [10000],
      ],
    ];

    var res = await itemsv2.initialization(
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );
    var native = res["native"];
    var itemIds = res["itemIds"][0];

    var CreateItem = [
      {
        header: {
          host: accounts[4],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await native.methods.collectionId().call(),
        id: itemIds,
        accounts: [accounts[1]],
        amounts: ["10000000000000000"],
      },
    ];

    var checkBal = await Promise.all(
      CreateItem.map(async (it, i) => {
        return await itemsv2.checkBalances(
          it.accounts,
          Array(it.accounts.length).fill(itemIds)
        );
      })
    );

    await native.methods
      .mintItems(CreateItem)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    await itemProjection.assertCheckBalance(checkBal, CreateItem, itemIds);

    var ExpectedResult = {
      header: {
        host: utilities.voidEthereumAddress,
        name: "Item1",
        symbol: "I1",
        uri: "uriItem1",
      },
      collectionId: await native.methods.collectionId().call(),
      id: itemIds,
      accounts: [accounts[1]],
      amounts: ["10000000000000000"],
    };

    await itemProjection.checkItem(
      ExpectedResult,
      await mainInterface.methods.item(itemIds).call()
    );
  });

  it("#633/2 Create and mint Items passing a host address different from void address", async () => {
    /**
     * Authorized subjects:
     * Collection host address
     * Functions used in the test:
     * lazyInit
     * mintItems (CreateItem[] calldata items)
     *
     * Create and mint new Items for different accounts and amounts calling the Native Projection mintItems functions passing an Item host
     * The Item host set is not a valid parameter.
     * The host is automatically set as void address.
     */
    var collectionId = utilities.voidBytes32;

    var collectionHeader = {
      host: accounts[1],
      name: "Collection1",
      symbol: "COL1",
      uri: "uri1",
    };

    var items = [];

    var res = await itemsv2.initialization(
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );
    var native = res["native"];

    var CreateItem = [
      {
        header: {
          host: accounts[4],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await native.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[1]],
        amounts: ["10000000000000000"],
      },
    ];

    var tx = await itemProjection.assertCheckBalanceSupply(
      native.methods
        .mintItems(CreateItem)
        .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
      CreateItem,
    );

    var itemIds = await itemProjection.getItemIdFromLog(tx);

    var ExpectedResult = {
      header: {
        host: utilities.voidEthereumAddress,
        name: "Item1",
        symbol: "I1",
        uri: "uriItem1",
      },
      collectionId: await native.methods.collectionId().call(),
      id: itemIds[0],
      accounts: [accounts[1]],
      amounts: ["10000000000000000"],
    };

    await itemProjection.checkItem(
      ExpectedResult,
      await mainInterface.methods.item(itemIds[0]).call()
    );
  });

  it("#635 Create and mint items with finalized as true", async () => {
    /**
     * Authorized subjects:
     * Collection host address
     * Functions used in the test:
     * lazyInit
     * mintItems (CreateItem[] calldata items, bool[] memory finalized)
     *
     * Create and then mint new Items for different accounts and amounts calling the Native Projection mintItems functions passing finalized as true.
     * In this case the Items cannot be minted anymore.
     * must fail: cannot mint finalized item
     */
    var collectionId = utilities.voidBytes32;

    var collectionHeader = {
      host: accounts[1],
      name: "Collection1",
      symbol: "COL1",
      uri: "uri1",
    };

    var items = [];

    var res = await itemsv2.initialization(
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );
    var native = res["native"];

    var CreateItem = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await native.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[1]],
        amounts: ["10000000000000000"],
      },
    ];

    var tx = await itemProjection.assertCheckBalanceSupply(
      native.methods
        .mintItems(CreateItem, [false])
        .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
      CreateItem,
    );

    idItems = await itemProjection.getItemIdFromLog(tx);

    await itemProjection.assertCheckFinalized(
      native.methods.isFinalized(idItems[0]).call(),
      false
    );

    var CreateItem2 = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await native.methods.collectionId().call(),
        id: idItems[0],
        accounts: [accounts[1]],
        amounts: ["10000000000000000"],
      },
    ];

    await native.methods
        .mintItems(CreateItem2, [true])
        .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    await itemProjection.assertCheckFinalized(
      native.methods.isFinalized(idItems[0]).call(),
      true
    );

    await catchCall(
      native.methods
        .mintItems(CreateItem2)
        .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
      "Finalized"
    );
  });

  it("#636 Create and mint Items with finalized as false", async () => {
    /**
     * Authorized subjects:
     * Collection host address
     * Functions used in the test:
     * lazyInit
     * mintItems (CreateItem[] calldata items, bool[] memory finalized)
     *
     * Mint new Items for different accounts and amounts calling the Native Projection mintItems functions passing finalized as false.
     * In this case the Items can be minted afterwards.
     */
    var collectionId = utilities.voidBytes32;

    var collectionHeader = {
      host: accounts[1],
      name: "Collection1",
      symbol: "COL1",
      uri: "uri1",
    };

    var items = [
      [
        [
          accounts[1],
          "Item1",
          "I1",
          "uriItem1",
        ],
        utilities.voidBytes32,
        0,
        [accounts[1]],
        ["10000000000000000"],
      ]
    ];

    var res = await itemsv2.initialization(
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );
    var native = res["native"];
    var itemIds = res["itemIds"];

    var CreateItem1 = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await native.methods.collectionId().call(),
        id: itemIds[0],
        accounts: [accounts[1]],
        amounts: ["10000000000000000"],
      },
    ];

    await itemProjection.assertCheckFinalized(
      native.methods.isFinalized(itemIds[0]).call(),
      false
    );
    
    await native.methods.finalize(itemIds).send(blockchainConnection.getSendingOptions({from: accounts[1]}))

    await itemProjection.assertCheckFinalized(
      native.methods.isFinalized(itemIds[0]).call(),
      true
    );

    await catchCall(native.methods
        .mintItems(CreateItem1)
        .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
    "finalized")

    var CreateItem = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await native.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[1]],
        amounts: ["10000000000000000"],
      },
    ];

    var tx = await itemProjection.assertCheckBalanceSupply(
      native.methods
        .mintItems(CreateItem, [false])
        .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
      CreateItem,
    );

    idItems = await itemProjection.getItemIdFromLog(tx);

    await native.methods.finalize(idItems).send(blockchainConnection.getSendingOptions({from: accounts[1]}))

    await itemProjection.assertCheckFinalized(
      native.methods.isFinalized(idItems[0]).call(),
      true
    );

    var MintItem = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await native.methods.collectionId().call(),
        id: idItems[0],
        accounts: [accounts[1]],
        amounts: ["10000000000000000"],
      },
    ];

    await catchCall(
      native.methods
       .mintItems(MintItem)
       .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
       "finalized");

    await catchCall(
        native.methods
         .mintItems(MintItem, [true])
         .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
         "finalized");
  });

  it("#640 Mint previously created items passing finalized as true", async () => {
    /**
     * Authorized subjects:
     * Collection host address
     * Functions used in the test:
     * lazyInit
     * mintItems (CreateItem[] calldata items, bool[] memory finalized)
     *
     * Create Items when initializing the Native Projection
     * Mint Items calling the Native Projection mintItems functions passing finalized as true.
     * In this case the Items can be minted.
     */
    var collectionId = utilities.voidBytes32;

    var collectionHeader = {
      host: accounts[1],
      name: "Collection1",
      symbol: "COL1",
      uri: "uri1",
    };

    var items = [
      [
        [utilities.voidEthereumAddress, "Item1", "I1", "uriItem1"],
        collectionId,
        0,
        [accounts[1]],
        [10000],
      ],
      [
        [utilities.voidEthereumAddress, "Item2", "I2", "uriItem2"],
        collectionId,
        0,
        [accounts[1]],
        [10000],
      ],
      [
        [utilities.voidEthereumAddress, "Item3", "I3", "uriItem3"],
        collectionId,
        0,
        [accounts[1]],
        [10000],
      ],
    ];

    var res = await itemsv2.initialization(
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI",
      utilities.voidEthereumAddress,
      [true, false]
    );
    var native = res["native"];
    var itemIds = res["itemIds"];

    var CreateItem1 = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await native.methods.collectionId().call(),
        id: itemIds[0],
        accounts: [accounts[1]],
        amounts: ["10000000000000000"],
      }
    ];

    await itemProjection.assertCheckFinalized(
      native.methods.isFinalized(itemIds[0]).call(),
      true
    );

    await catchCall(
      native.methods
        .mintItems(CreateItem1)
        .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
      "Finalized"
    );

    await catchCall(
      native.methods
        .mintItems(CreateItem1, [true])
        .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
      "Finalized"
    );

    var CreateItem2 = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await native.methods.collectionId().call(),
        id: itemIds[1],
        accounts: [accounts[1]],
        amounts: ["10000000000000000"],
      }
    ];

    await itemProjection.assertCheckFinalized(
      native.methods.isFinalized(itemIds[1]).call(),
      false
    );

    await native.methods
        .mintItems(CreateItem2, [true])
        .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    await itemProjection.assertCheckFinalized(
      native.methods.isFinalized(itemIds[1]).call(),
      true
    );

    await catchCall(
      native.methods
        .mintItems(CreateItem1, [false])
        .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
      "Finalized"
    );

    await itemProjection.assertCheckFinalized(
      native.methods.isFinalized(itemIds[2]).call(),
      false
    );

    await native.methods.finalize([itemIds[2]]).send(blockchainConnection.getSendingOptions({from: accounts[1]}))

    await itemProjection.assertCheckFinalized(
      native.methods.isFinalized(itemIds[2]).call(),
      true
    );

    await catchCall(
      native.methods
        .mintItems(CreateItem1, [false])
        .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
      "Finalized"
    );

    await catchCall(
      native.methods
        .mintItems(CreateItem1)
        .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
      "Finalized"
    );


    var CreateItem4 = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await native.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[1]],
        amounts: ["10000000000000000"],
      },
    ];

    var tx = await itemProjection.assertCheckBalanceSupply(
      native.methods
        .mintItems(CreateItem4, [true])
        .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
        CreateItem4,
    );

    var itemId4 = await itemProjection.getItemIdFromLog(tx);

    await itemProjection.assertCheckFinalized(
      native.methods.isFinalized(itemId4[0]).call(),
      true
    );

    CreateItem4 = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await native.methods.collectionId().call(),
        id: itemId4[0],
        accounts: [accounts[1]],
        amounts: ["10000000000000000"],
      },
    ];

    await catchCall(
      native.methods
        .mintItems(CreateItem4)
        .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
      "Finalized"
    );
  });

  it("#637 Items operation: safeTransferFrom", async () => {
    /**
     * Authorized subjects:
     * Item holders
     * approved operators addresses
     * Functions used in the test:
     * lazyInit
     * safeTransferFrom
     *
     * Create Items when initializing the Native Projection
     * The Items holders perform a safeTransferFrom using the Native projection method
     */
    var collectionId = utilities.voidBytes32;

    var collectionHeader = {
      host: accounts[1],
      name: "Collection1",
      symbol: "COL1",
      uri: "uri1",
    };

    var items = [
      [
        [utilities.voidEthereumAddress, "Item1", "I1", "uriItem1"],
        collectionId,
        0,
        [accounts[1]],
        ["60000000000000000"],
      ],
      [
        [utilities.voidEthereumAddress, "Item2", "I2", "uriItem2"],
        collectionId,
        0,
        [accounts[2]],
        ["20000000000000000"],
      ],
    ];

    var res = await itemsv2.initialization(
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );
    var native = res["native"];
    var itemIds = res["itemIds"];

    var transferAmount = ["10000000000000000", "3000000000000000"];
    var fromAddress = [accounts[1], accounts[2]];
    var toAddress = [accounts[3], accounts[4]];
    var checkBalFrom = await itemsv2.checkBalances(fromAddress, itemIds);

    var checkBalTo = await itemsv2.checkBalances(toAddress, itemIds);

    await Promise.all(
      itemIds.map(async (item, index) => {
        await native.methods
          .safeTransferFrom(
            fromAddress[index],
            toAddress[index],
            item,
            transferAmount[index],
            "0x"
          )
          .send(
            blockchainConnection.getSendingOptions({
              from: fromAddress[index],
            })
          );
      })
    );

    await itemProjection.assertTransferBalance(
      fromAddress,
      toAddress,
      itemIds,
      transferAmount,
      checkBalFrom,
      checkBalTo
    );
  });

  it("#641 Items operation: SafeTransferFrom and approved operators", async () => {
    /**
     * Authorized subjects:
     * Item holders
     * approved operators addresses
     * Functions used in the test:
     * lazyInit
     * setApprovalForAll
     * safeTransferFrom
     *
     * Create Items when initializing the Native Projection
     * The Items holders approve operators to act on their Items using the setApprovalForAll (Main Interface)
     * The operators perform a safeBatchTransferFrom using the Native projection method transferring multiple Items at once
     * must fail: cannot call setApprovalForAll from nativeProjection
     * must fail: cannot call safeTransferFrom from unauthorized address
     */
    var collectionId = utilities.voidBytes32;

    var collectionHeader = {
      host: accounts[1],
      name: "Collection1",
      symbol: "COL1",
      uri: "uri1",
    };

    var items = [
      [
        [utilities.voidEthereumAddress, "Item1", "I1", "uriItem1"],
        collectionId,
        0,
        [accounts[1]],
        ["60000000000000000"],
      ],
      [
        [utilities.voidEthereumAddress, "Item2", "I2", "uriItem2"],
        collectionId,
        0,
        [accounts[2]],
        ["30000000000000000"],
      ],
    ];

    var res = await itemsv2.initialization(
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );
    var native = res["native"];
    var itemIds = res["itemIds"];

    var transferAmount = ["20000000000000000", "10000000000000000"];
    var fromAddress = [accounts[1], accounts[2]];
    var toAddress = [accounts[3], accounts[4]];
    var operator = [accounts[7], accounts[8]];

    await catchCall(
      native.methods
        .setApprovalForAll(accounts[3], true)
        .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
      "call directly the setApprovalForAll on the main Interface 0x915a22a152654714fceca3f4704fcf6bd314624c"
    );

    await Promise.all(
      operator.map(async (op, index) => {
        await itemProjection.assertCheckIsApprovedForAll(
          native.methods.isApprovedForAll(fromAddress[index], op).call(),
          false
        );
        await mainInterface.methods
          .setApprovalForAll(op, true)
          .send(
            blockchainConnection.getSendingOptions({ from: fromAddress[index] })
          );
        await itemProjection.assertCheckIsApprovedForAll(
          native.methods.isApprovedForAll(fromAddress[index], op).call(),
          true
        );
      })
    );

    var checkBalFrom = await itemsv2.checkBalances(fromAddress, itemIds);

    var checkBalTo = await itemsv2.checkBalances(toAddress, itemIds);

    await Promise.all(
      itemIds.map((item, index) => catchCall(
          native.methods
            .safeTransferFrom(
              fromAddress[index],
              toAddress[index],
              item,
              transferAmount[index],
              "0x"
            )
            .send(
              blockchainConnection.getSendingOptions({
                from: accounts[9],
              })
            ),
          "amount exceeds allowance"
        )
      )
    );

    await Promise.all(
      itemIds.map(async (item, index) => {
        await native.methods
          .safeTransferFrom(
            fromAddress[index],
            toAddress[index],
            item,
            transferAmount[index],
            "0x"
          )
          .send(
            blockchainConnection.getSendingOptions({
              from: operator[index],
            })
          );
      })
    );

    await itemProjection.assertTransferBalance(
      fromAddress,
      toAddress,
      itemIds,
      transferAmount,
      checkBalFrom,
      checkBalTo
    );
  });

  it("#642 Items operation: SafeBatchTransferFrom", async () => {
    /**
     * Authorized subjects:
     * Item holders
     * approved operators addresses
     * Functions used in the test:
     * lazyInit
     * safeBatchTransferFrom
     *
     * Create Items when initializing the Native Projection
     * The Items holders perform a safeBatchTransferFrom using the Native projection method transferring multiple Items at once
     */
    var collectionId = utilities.voidBytes32;

    var collectionHeader = {
      host: accounts[1],
      name: "Collection1",
      symbol: "COL1",
      uri: "uri1",
    };

    var items = [
      [
        [utilities.voidEthereumAddress, "Item1", "I1", "uriItem1"],
        collectionId,
        0,
        [accounts[1]],
        ["60000000000000000"],
      ],
      [
        [utilities.voidEthereumAddress, "Item2", "I2", "uriItem2"],
        collectionId,
        0,
        [accounts[1]],
        ["30000000000000000"],
      ],
      [
        [utilities.voidEthereumAddress, "Item3", "I3", "uriItem3"],
        collectionId,
        0,
        [accounts[2]],
        ["40000000000000000"],
      ],
      [
        [utilities.voidEthereumAddress, "Item4", "I4", "uriItem4"],
        collectionId,
        0,
        [accounts[2]],
        ["20000000000000000"],
      ],
    ];

    var res = await itemsv2.initialization(
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );
    var native = res["native"];
    var itemIds = res["itemIds"];

    var transferAmount = [
      "10000000000000000",
      "2500000000000000",
      "20000000000000000",
      "1000000000000000",
    ];
    var fromAddress = [accounts[1], accounts[1], accounts[2], accounts[2]];
    var toAddress = [accounts[3], accounts[3], accounts[4], accounts[4]];
    var checkBalFrom = await itemsv2.checkBalances(fromAddress, itemIds);

    var checkBalTo = await itemsv2.checkBalances(toAddress, itemIds);

    var items1 = itemIds.slice(0, 2);
    var items2 = itemIds.slice(2, 4);

    await native.methods
      .safeBatchTransferFrom(
        fromAddress[0],
        toAddress[0],
        items1,
        transferAmount.slice(0, 2),
        "0x"
      )
      .send(
        blockchainConnection.getSendingOptions({
          from: fromAddress[0],
        })
      );

    await native.methods
      .safeBatchTransferFrom(
        fromAddress[2],
        toAddress[2],
        items2,
        transferAmount.slice(2, 4),
        "0x"
      )
      .send(
        blockchainConnection.getSendingOptions({
          from: fromAddress[2],
        })
      );

    await itemProjection.assertTransferBalance(
      fromAddress,
      toAddress,
      itemIds,
      transferAmount,
      checkBalFrom,
      checkBalTo
    );
  });

  it("#643 Items operation: safeBatchTransferFrom and approved operators", async () => {
    /**
     * Authorized subjects:
     * Item holders
     * approved operators addresses
     * Functions used in the test:
     * lazyInit
     * safeBatchTransferFrom
     * setApprovalForAll
     *
     * Create Items when initializing the Native Projection
     * The Items holders approve operators to act on their Items using the setApprovalForAll (Main Interface)
     * The operators perform a safeBatchTransferFrom using the Native projection method transferring multiple Items at once
     * must fail: cannot call setApprovalForAll from nativeProjection
     * must fail: cannot call safeBatchTransferFrom from unauthorized address
     */
    var collectionId = utilities.voidBytes32;

    var collectionHeader = {
      host: accounts[1],
      name: "Collection1",
      symbol: "COL1",
      uri: "uri1",
    };

    var items = [
      [
        [utilities.voidEthereumAddress, "Item1", "I1", "uriItem1"],
        collectionId,
        0,
        [accounts[1]],
        ["60000000000000000"],
      ],
      [
        [utilities.voidEthereumAddress, "Item2", "I2", "uriItem2"],
        collectionId,
        0,
        [accounts[1]],
        ["30000000000000000"],
      ],
      [
        [utilities.voidEthereumAddress, "Item3", "I3", "uriItem3"],
        collectionId,
        0,
        [accounts[2]],
        ["40000000000000000"],
      ],
      [
        [utilities.voidEthereumAddress, "Item4", "I4", "uriItem4"],
        collectionId,
        0,
        [accounts[2]],
        ["20000000000000000"],
      ],
    ];

    var res = await itemsv2.initialization(
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );
    var native = res["native"];
    var itemIds = res["itemIds"];

    var transferAmount = [
      "10000000000000000",
      "2500000000000000",
      "20000000000000000",
      "1000000000000000",
    ];
    var fromAddress = [accounts[1], accounts[1], accounts[2], accounts[2]];
    var toAddress = [accounts[3], accounts[3], accounts[4], accounts[4]];
    var operator = [accounts[5], accounts[5], accounts[6], accounts[6]];
    var checkBalFrom = await itemsv2.checkBalances(fromAddress, itemIds);

    var checkBalTo = await itemsv2.checkBalances(toAddress, itemIds);

    var items1 = itemIds.slice(0, 2);
    var items2 = itemIds.slice(2, 4);

    await catchCall(
      native.methods
        .setApprovalForAll(accounts[3], true)
        .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
      "call directly the setApprovalForAll on the main Interface 0x915a22a152654714fceca3f4704fcf6bd314624c"
    );

    await Promise.all(
      operator.map(async (op, index) => {
        await itemProjection.assertCheckIsApprovedForAll(
          native.methods.isApprovedForAll(fromAddress[index], op).call(),
          false
        );
        await mainInterface.methods
          .setApprovalForAll(op, true)
          .send(
            blockchainConnection.getSendingOptions({ from: fromAddress[index] })
          );
        await itemProjection.assertCheckIsApprovedForAll(
          native.methods.isApprovedForAll(fromAddress[index], op).call(),
          true
        );
      })
    );

    await catchCall(
      native.methods
        .safeBatchTransferFrom(
          fromAddress[0],
          toAddress[0],
          items1,
          transferAmount.slice(0, 2),
          "0x"
        )
        .send(
          blockchainConnection.getSendingOptions({
            from: accounts[9],
          })
        ),
      "amount exceeds allowance"
    );

    await native.methods
      .safeBatchTransferFrom(
        fromAddress[0],
        toAddress[0],
        items1,
        transferAmount.slice(0, 2),
        "0x"
      )
      .send(
        blockchainConnection.getSendingOptions({
          from: operator[0],
        })
      );

    await native.methods
      .safeBatchTransferFrom(
        fromAddress[2],
        toAddress[2],
        items2,
        transferAmount.slice(2, 4),
        "0x"
      )
      .send(
        blockchainConnection.getSendingOptions({
          from: operator[2],
        })
      );

    await itemProjection.assertTransferBalance(
      fromAddress,
      toAddress,
      itemIds,
      transferAmount,
      checkBalFrom,
      checkBalTo
    );
  });

  it("#644 Items operation: Burn", async () => {
    /**
     * initializing the Native Projection without items to create
     * create Items using the mintItems function
     * Item holders
     * approved operators addresses
     * Functions used in the test:
     * lazyInit
     * Burn
     *
     * Create Items when initializing the Native Projection
     * The Items holders perform a burn using the Native projection burn method
     */
    var collectionId = utilities.voidBytes32;

    var collectionHeader = {
      host: accounts[1],
      name: "Collection1",
      symbol: "COL1",
      uri: "uri1",
    };

    var items = [];

    var res = await itemsv2.initialization(
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );
    var native = res["native"];

    var CreateItem = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await native.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[1]],
        amounts: ["50000000000000000"],
      },
      {
        header: {
          host: accounts[1],
          name: "Item2",
          symbol: "I2",
          uri: "uriItem2",
        },
        collectionId: await native.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[2]],
        amounts: ["60000000000000000"],
      },
    ];

    var tx = await native.methods
      .mintItems(CreateItem)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    var idItems = await itemProjection.getItemIdFromLog(tx);

    var accountsList = CreateItem.map((it) => it.accounts);
    var noneBal = await itemProjection.createNoneBal(accountsList, idItems);
    await itemProjection.assertCheckBalance(noneBal, CreateItem, idItems);

    var burnAmount = [["10000000000000000"], ["3000000000000000"]];
    var burnAddress = [[accounts[1]], [accounts[2]]];
    var checkBal = await itemsv2.checkBalances(
      [accounts[1], accounts[2]],
      idItems
    );

    await Promise.all(
      burnAmount.map(async (item, index) => {
        await Promise.all(
          item.map(async (it, i) => {
            await native.methods
              .burn(burnAddress[index][i], idItems[index], it, "0x")
              .send(
                blockchainConnection.getSendingOptions({
                  from: burnAddress[index][i],
                })
              );
          })
        );
      })
    );

    await itemProjection.assertBurnBalance(
      checkBal,
      burnAmount,
      burnAddress,
      idItems
    );
  });

  it("#645 Items operation: Burn and approved operators", async () => {
    /**
     * initializing the Native Projection without items to create
     * create Items using the mintItems function
     * Item holders
     * approved operators addresses
     * Functions used in the test:
     * lazyInit
     * setApprovalForAll
     * Burn
     *
     * Create Items when initializing the Native Projection
     * The Items holders approve operators to act on their Items
     * The opertators perform a burn using the Native projection burn method
     */
    var collectionId = utilities.voidBytes32;

    var collectionHeader = {
      host: accounts[1],
      name: "Collection1",
      symbol: "COL1",
      uri: "uri1",
    };

    var items = [];

    var res = await itemsv2.initialization(
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );
    var native = res["native"];

    var CreateItem = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await native.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[1]],
        amounts: ["50000000000000000"],
      },
      {
        header: {
          host: accounts[1],
          name: "Item2",
          symbol: "I2",
          uri: "uriItem2",
        },
        collectionId: await native.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[2]],
        amounts: ["60000000000000000"],
      },
    ];

    var tx = await native.methods
      .mintItems(CreateItem)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    var idItems = await itemProjection.getItemIdFromLog(tx);

    var accountsList = CreateItem.map((it) => it.accounts);
    var noneBal = await itemProjection.createNoneBal(accountsList, idItems);
    await itemProjection.assertCheckBalance(noneBal, CreateItem, idItems);

    var idItems = await itemProjection.getItemIdFromLog(tx);

    var burnAmount = [["10000000000000000"], ["3000000000000000"]];
    var burnAddress = [[accounts[1]], [accounts[2]]];
    var operator = [[accounts[7]], [accounts[8]]];
    var checkBal = await itemsv2.checkBalances(
      [accounts[1], accounts[2]],
      idItems
    );

    await catchCall(
      native.methods
        .setApprovalForAll(accounts[3], true)
        .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
      "call directly the setApprovalForAll on the main Interface 0x915a22a152654714fceca3f4704fcf6bd314624c"
    );

    await Promise.all(
      operator.map(async (op, index) => {
        await mainInterface.methods.setApprovalForAll(op[0], true).send(
          blockchainConnection.getSendingOptions({
            from: burnAddress[index][0],
          })
        );
        await itemProjection.assertCheckIsApprovedForAll(
          native.methods.isApprovedForAll(burnAddress[index][0], op[0]).call(),
          true
        );
      })
    );

    await Promise.all(
      burnAmount.map(async (item, index) => {
        await Promise.all(
          item.map(async (it, i) => {
            await catchCall(
              native.methods
                .burn(burnAddress[index][i], idItems[index], it, "0x")
                .send(
                  blockchainConnection.getSendingOptions({
                    from: accounts[9],
                  })
                ),
              "amount exceeds allowance"
            );
          })
        );
      })
    );

    await Promise.all(
      burnAmount.map(async (item, index) => {
        await Promise.all(
          item.map(async (it, i) => {
            await native.methods
              .burn(burnAddress[index][i], idItems[index], it, "0x")
              .send(
                blockchainConnection.getSendingOptions({
                  from: operator[index][i],
                })
              );
          })
        );
      })
    );

    await itemProjection.assertBurnBalance(
      checkBal,
      burnAmount,
      burnAddress,
      idItems
    );
  });

  it("#646 Items operation: burnBatch", async () => {
    /**
     * initializing the Native Projection without items to create
     * create Items using the mintItems function
     * Item holders
     * approved operators addresses
     * Functions used in the test:
     * lazyInit
     * burnBatch
     *
     * Create Items when initializing the Native Projection
     * The Items holders perform a burnBatch using the Native projection method burning multiple Items at once
     *
     * must fail: cannot call setApprovalForAll from nativeProjection
     * must fail: cannot call burnBatch from unauthorized address
     */
    var collectionId = utilities.voidBytes32;

    var collectionHeader = {
      host: accounts[1],
      name: "Collection1",
      symbol: "COL1",
      uri: "uri1",
    };

    var items = [];

    var res = await itemsv2.initialization(
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );
    var native = res["native"];

    var CreateItem = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await native.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[1]],
        amounts: ["50000000000000000"],
      },
      {
        header: {
          host: accounts[1],
          name: "Item2",
          symbol: "I2",
          uri: "uriItem2",
        },
        collectionId: await native.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[1]],
        amounts: ["60000000000000000"],
      },
      {
        header: {
          host: accounts[1],
          name: "Item3",
          symbol: "I3",
          uri: "uriItem3",
        },
        collectionId: await native.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[2]],
        amounts: ["50000000000000000"],
      },
      {
        header: {
          host: accounts[1],
          name: "Item4",
          symbol: "I4",
          uri: "uriItem4",
        },
        collectionId: await native.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[2]],
        amounts: ["60000000000000000"],
      },
    ];

    var tx = await native.methods
      .mintItems(CreateItem)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    var idItems = await itemProjection.getItemIdFromLog(tx);

    var accountsList = CreateItem.map((it) => it.accounts);
    var noneBal = await itemProjection.createNoneBal(accountsList, idItems);
    await itemProjection.assertCheckBalance(noneBal, CreateItem, idItems);

    var idItems = await itemProjection.getItemIdFromLog(tx);

    var burnAmount = [
      ["10000000000000000"],
      ["2000000000000000"],
      ["10000000000000000"],
      ["2000000000000000"],
    ];

    var burnAddress = [accounts[1], accounts[1], accounts[2], accounts[2]];
    var checkBal = await itemsv2.checkBalances(
      [accounts[1], accounts[1], accounts[2], accounts[2]],
      idItems
    );

    await native.methods
      .burnBatch(
        burnAddress[0],
        idItems.slice(0, 2),
        burnAmount.slice(0, 2).flat()
      )
      .send(
        blockchainConnection.getSendingOptions({
          from: burnAddress[0],
        })
      );

    await native.methods
      .burnBatch(
        burnAddress[2],
        idItems.slice(2, 4),
        burnAmount.slice(2, 4).flat()
      )
      .send(
        blockchainConnection.getSendingOptions({
          from: burnAddress[2],
        })
      );

    await itemProjection.assertBurnBalance(
      checkBal,
      burnAmount,
      burnAddress,
      idItems
    );
  });

  it("#647 Items operation: burnBatch and approved operators", async () => {
    /**
     * initializing the Native Projection without items to create
     * create Items using the mintItems function
     * Item holders
     * approved operators addresses
     * Functions used in the test:
     * lazyInit
     * setApprovalForAll
     * burnBatch
     *
     * Create Items when initializing the Native Projection
     * The Items holders approve operators to act on their Items
     * The operators perform a burnBatch using the Native projection method burning multiple Items at once
     * must fail: cannot call setApprovalForAll from nativeProjection
     * must fail: cannot call burnBatch from unauthorized address
     */
    var collectionId = utilities.voidBytes32;

    var collectionHeader = {
      host: accounts[1],
      name: "Collection1",
      symbol: "COL1",
      uri: "uri1",
    };

    var items = [];

    var res = await itemsv2.initialization(
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );
    var native = res["native"];

    var CreateItem = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await native.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[1]],
        amounts: ["50000000000000000"],
      },
      {
        header: {
          host: accounts[1],
          name: "Item2",
          symbol: "I2",
          uri: "uriItem2",
        },
        collectionId: await native.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[1]],
        amounts: ["60000000000000000"],
      },
      {
        header: {
          host: accounts[1],
          name: "Item3",
          symbol: "I3",
          uri: "uriItem3",
        },
        collectionId: await native.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[2]],
        amounts: ["50000000000000000"],
      },
      {
        header: {
          host: accounts[1],
          name: "Item4",
          symbol: "I4",
          uri: "uriItem4",
        },
        collectionId: await native.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[2]],
        amounts: ["60000000000000000"],
      },
    ];

    var tx = await native.methods
      .mintItems(CreateItem)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    var idItems = await itemProjection.getItemIdFromLog(tx);

    var accountsList = CreateItem.map((it) => it.accounts);
    var noneBal = await itemProjection.createNoneBal(accountsList, idItems);
    await itemProjection.assertCheckBalance(noneBal, CreateItem, idItems);

    var idItems = await itemProjection.getItemIdFromLog(tx);

    var burnAmount = [
      ["10000000000000000"],
      ["2000000000000000"],
      ["10000000000000000"],
      ["2000000000000000"],
    ];
    var operator = [accounts[5], accounts[5], accounts[6], accounts[6]];
    var burnAddress = [accounts[1], accounts[1], accounts[2], accounts[2]];
    var checkBal = await itemsv2.checkBalances(
      [accounts[1], accounts[1], accounts[2], accounts[2]],
      idItems
    );

    await catchCall(
      native.methods
        .setApprovalForAll(accounts[3], true)
        .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
      "call directly the setApprovalForAll on the main Interface 0x915a22a152654714fceca3f4704fcf6bd314624c"
    );

    await Promise.all(
      operator.map(async (op, index) => {
        await mainInterface.methods
          .setApprovalForAll(op, true)
          .send(
            blockchainConnection.getSendingOptions({ from: burnAddress[index] })
          );
        await itemProjection.assertCheckIsApprovedForAll(
          native.methods.isApprovedForAll(burnAddress[index], op).call(),
          true
        );
      })
    );

    await catchCall(
      native.methods
        .burnBatch(
          burnAddress[0],
          idItems.slice(0, 2),
          burnAmount.slice(0, 2).flat()
        )
        .send(
          blockchainConnection.getSendingOptions({
            from: accounts[9],
          })
        ),
      "amount exceeds allowance"
    );

    await native.methods
      .burnBatch(
        burnAddress[0],
        idItems.slice(0, 2),
        burnAmount.slice(0, 2).flat()
      )
      .send(
        blockchainConnection.getSendingOptions({
          from: operator[0],
        })
      );

    await native.methods
      .burnBatch(
        burnAddress[2],
        idItems.slice(2, 4),
        burnAmount.slice(2, 4).flat()
      )
      .send(
        blockchainConnection.getSendingOptions({
          from: operator[2],
        })
      );

    await itemProjection.assertBurnBalance(
      checkBal,
      burnAmount,
      burnAddress,
      idItems
    );
  });

  it("#648 Batch burn operation using the Main Interface methods", async () => {
    /**
     * Authorized subjects:
     * Items holders
     * approved operators
     *
     * Functions used in the test:
     * lazyInit
     * createCollection (main interface)
     *burnBatch (main interface)
     *
     * Create multiple Collection using the Main Interface.
     * Create and initialize a Native Projection with Items
     * Using the main interface batch method burnBatch, a user can manage different Items from different Collection and one of them is the Projection Collection
     */
    var collectionId = utilities.voidBytes32;

    var collectionHeader = {
      host: accounts[1],
      name: "Collection1",
      symbol: "COL1",
      uri: "uri1",
    };
    var mainCollectionHeader = {
      host: accounts[1],
      name: "Collection2",
      symbol: "COL2",
      uri: "uri2",
    };

    var items = [
      [
        [utilities.voidEthereumAddress, "Item1", "I1", "uriItem1"],
        collectionId,
        0,
        [accounts[1]],
        ["20000000000000000"],
      ],
      [
        [utilities.voidEthereumAddress, "Item2", "I2", "uriItem2"],
        collectionId,
        0,
        [accounts[1]],
        ["60000000000000000"],
      ],
    ];

    var mainItems = [];

    var res = await itemsv2.initialization(
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );
    var native = res["native"];
    var itemIds = res["itemIds"];

    var result = await mainInterface.methods
      .createCollection(mainCollectionHeader, mainItems)
      .send(blockchainConnection.getSendingOptions());
    var collection = result.events.Collection.returnValues["collectionId"];

    var CreateItemMain = [
      {
        header: {
          host: accounts[1],
          name: "Item3",
          symbol: "I3",
          uri: "uriItem3",
        },
        collectionId: collection,
        id: 0,
        accounts: [accounts[1]],
        amounts: ["800000000000000000"],
      },
      {
        header: {
          host: accounts[1],
          name: "Item4",
          symbol: "I4",
          uri: "uriItem4",
        },
        collectionId: collection,
        id: 0,
        accounts: [accounts[1]],
        amounts: ["900000000000000000"],
      },
    ];

    var mintItem = await mainInterface.methods
      .mintItems(CreateItemMain)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    var mainItemId = [];

    await Promise.all(
      mintItem.events.CollectionItem.map(async (event, index) => {
        mainItemId.push(event.returnValues["itemId"]);
      })
    );

    var burnAmount = [
      ["10000000000000"],
      ["300000000000000"],
      ["10000000000"],
      ["20000000000000000"],
    ];
    var burnAddress = [accounts[1]];
    var totalItemIds = mainItemId.concat(itemIds).map((item, index) => {
      return [item];
    });

    var checkBal = await itemsv2.checkBalances(
      Array(totalItemIds.length).fill(burnAddress[0]),
      totalItemIds
    );

    await mainInterface.methods
      .burnBatch(
        accounts[1],
        mainItemId.concat(itemIds),
        burnAmount.flat(),
        "0x"
      )
      .send(blockchainConnection.getSendingOptions({ from: burnAddress[0] }));
    await itemProjection.assertBurnBalance(
      checkBal,
      burnAmount,
      Array(burnAmount.length).fill(burnAddress[0]),
      mainItemId.concat(itemIds)
    );
  });

  it("#638 Batch transfer operation using the Main Interface methods", async () => {
    /**
     * Authorized subjects:
     * Items holders
     * approved operators
     *
     * Functions used in the test:
     * lazyInit
     * createCollection (main interface)
     *safeBatchTransferFrom (main interface)
     *
     * Create multiple Collection using the Main Interface.
     * Create and initialize a Native Projection with Items
     * Using the main interface batch methods safeBatchTransferFrom, a user can manage different Items from different Collection and one of them is the Projection Collection
     */
    var collectionId = utilities.voidBytes32;

    var collectionHeader = {
      host: accounts[1],
      name: "Collection1",
      symbol: "COL1",
      uri: "uri1",
    };

    var items = [
      [
        [utilities.voidEthereumAddress, "Item1", "I1", "uriItem1"],
        collectionId,
        0,
        [accounts[1]],
        [300000000000],
      ],
      [
        [utilities.voidEthereumAddress, "Item2", "I2", "uriItem2"],
        collectionId,
        0,
        [accounts[1]],
        [300000000000],
      ],
    ];

    var itemsMain = [
      {
        header: {
          host: accounts[1],
          name: "Item3",
          symbol: "I3",
          uri: "uriItem3",
        },
        collectionId: utilities.voidBytes32,
        id: 0,
        accounts: [accounts[1]],
        amounts: ["10000000000000000"],
      },
      {
        header: {
          host: accounts[1],
          name: "Item4",
          symbol: "I4",
          uri: "uriItem4",
        },
        collectionId: utilities.voidBytes32,
        id: 0,
        accounts: [accounts[1]],
        amounts: ["10000000000000000"],
      },
    ];

    var res = await itemsv2.initialization(
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );
    var native = res["native"];
    var itemIds = res["itemIds"];

    var result = await mainInterface.methods
      .createCollection(collectionHeader, itemsMain)
      .send(blockchainConnection.getSendingOptions());
    var res = result.events.CollectionItem.returnValues;
    var resLog = result.events.CollectionItem;
    var idItemsMain = resLog.map((event) => event.returnValues["itemId"]);
    var collectionIdMain = resLog.map(
      (event) => event.returnValues["toCollectionId"]
    );

    var totalItemsId = itemIds.concat(idItemsMain);

    var totalSupply = await Promise.all(
      totalItemsId.map(
        async (value, key) =>
          await mainInterface.methods.totalSupply(value).call()
      )
    );

    var toAccounts = [accounts[4], accounts[4], accounts[4], accounts[4]];
    var fromAccounts = [accounts[1], accounts[1], accounts[1], accounts[1]];

    var checkBalTo = await itemsv2.checkBalances(toAccounts, totalItemsId);

    var checkBalFrom = await itemsv2.checkBalances(fromAccounts, totalItemsId);
    var transferAmount = 100000000000;
    await mainInterface.methods
      .safeBatchTransferFrom(
        accounts[1],
        accounts[4],
        totalItemsId,
        Array(toAccounts.length).fill(transferAmount),
        "0x"
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    await itemProjection.assertTransferBalance(
      fromAccounts,
      toAccounts,
      totalItemsId,
      Array(toAccounts.length).fill(transferAmount),
      checkBalFrom,
      checkBalTo
    );
  });
});
