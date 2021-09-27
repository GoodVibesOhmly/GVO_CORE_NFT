var itemsv2 = require("../resources/itemsv2");
var itemProjection = require("../resources/itemProjection");
const blockchainConnection = require("../util/blockchainConnection");

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
  it("#0", async () => {
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;

    var collectionHeader = [accounts[1], "Collection1", "c1", "uri1"];

    var items = [
      [
        [utilities.voidEthereumAddress, "Item1", "I1", "uriItem1"],
        collectionId,
        0,
        [accounts[1]],
        [10000],
      ],
    ];

    try {
      var native = (
        await itemsv2.initialization(
          zeroDecimals,
          collectionId,
          collectionHeader,
          items,
          accounts[1],
          "URI"
        )
      )["native"];
      console.log("Native", native.options.address);

      await itemProjection.assertDecimals(native.methods.decimals(0).call(), zeroDecimals);

      await itemProjection.assertNotEqualCollection(native.methods.collectionId().call(), collectionId);

    } catch (e) {
      console.error(e);
    }
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
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;

    var items = [];

    var collectionId = (await itemsv2.createCollection(accounts[1], items))[
      "collectionId"
    ];

    var nativeProjectionAddress = await itemsv2.deployNativeProjection();

    var collectionHeader = [
      nativeProjectionAddress,
      "Collection",
      "COL",
      "uri",
    ];

    var expectedCollection = {
      host: nativeProjectionAddress,
      name: "Collection",
      symbol: "COL",
      uri: "uri",
    };

    await mainInterface.methods
      .setCollectionsMetadata([collectionId], [collectionHeader])
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var native = (
      await itemsv2.initialization(
        zeroDecimals,
        collectionId,
        collectionHeader,
        items,
        nativeProjectionAddress,
        "URI"
      )
    )["native"];

    await itemProjection.assertCheckHeader(
      expectedCollection,
      mainInterface.methods
        .collection(await native.methods.collectionId().call())
        .call()
    );

    await itemProjection.assertDecimals(native.methods.decimals(0).call(), zeroDecimals);
    
    await itemProjection.assertEqualCollection(native.methods.collectionId().call(), collectionId);
  });

  it("#619/2 Alternative Initialization with items", async () => {
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
     * must fail: can't initialize an existing collection with items
     */
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;

    var mainItems = [];

    var collectionId = (await itemsv2.createCollection(accounts[1], mainItems))[
      "collectionId"
    ];

    var nativeProjectionAddress = await itemsv2.deployNativeProjection();

    var collectionHeader = [
      nativeProjectionAddress,
      "Collection",
      "COL",
      "uri",
    ];

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
      .setCollectionsMetadata([collectionId], [collectionHeader])
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    await catchCall(
      itemsv2.initialization(
        zeroDecimals,
        collectionId,
        collectionHeader,
        items,
        nativeProjectionAddress,
        "URI"
      ),
      "Unauthorized"
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
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;

    var items = [];

    var collectionId = (await itemsv2.createCollection(accounts[1], items))[
      "collectionId"
    ];

    var collectionHeader = [accounts[1], "Collection", "COL", "uri"];

    var native = (
      await itemsv2.initialization(
        zeroDecimals,
        collectionId,
        collectionHeader,
        items,
        accounts[1],
        "URI"
      )
    )["native"];

    collectionHeader = [native.options.address, "Collection", "COL", "uri"];

    await mainInterface.methods
      .setCollectionsMetadata([collectionId], [collectionHeader])
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    await itemProjection.assertDecimals(native.methods.decimals(0).call(), zeroDecimals);
    await itemProjection.assertEqualCollection(native.methods.collectionId().call(), collectionId);

    var collectionData = await mainInterface.methods
      .collection(collectionId)
      .call();

    await itemProjection.assertEqualHeaderHost(collectionData.host, native.options.address);
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
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;

    var collectionHeader = [
      utilities.voidEthereumAddress,
      "Collection1",
      "COL1",
      "uri1",
    ];

    var newCollectionHeader = [accounts[1], "Collection2", "COL2", "uri2"];

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
        zeroDecimals,
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
    await itemProjection.assertDecimals(native.methods.decimals(0).call(), zeroDecimals);

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

    await itemProjection.assertEqualHeaderUri(native.methods.uri().call(), "uri2");
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
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;

    var collectionHeader = [
      utilities.voidEthereumAddress,
      "Collection1",
      "COL1",
      "uri1",
    ];
    var newCollectionHeader = [accounts[1], "Collection2", "COL2", "uri2"];

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
        zeroDecimals,
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

    await itemProjection.assertDecimals(native.methods.decimals(0).call(), zeroDecimals);
    
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

    await itemProjection.assertEqualHeaderUri("uri2");

    await catchCall(
      native.methods
        .setHeader(newCollectionHeader)
        .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
      "Unauthorized"
    );
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
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;

    var collectionHeader = [
      utilities.voidEthereumAddress,
      "Collection1",
      "COL1",
      "uri1",
    ];
    var newCollectionHeader = [accounts[1], "Collection2", "COL2", "uri2"];

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
        zeroDecimals,
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

    var resetCollectionHeader = [
      native.options.address,
      "Collection2",
      "COL2",
      "uri2",
    ];

    var expectedResetCollection = {
      host: native.options.address,
      name: "Collection2",
      symbol: "COL2",
      uri: "uri2",
    };

    console.log("Native", native.options.address);
    await itemProjection.assertDecimals(native.methods.decimals(0).call(), zeroDecimals);

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
    await itemProjection.assertEqualHeaderUri(native.methods.uri().call(), "uri2");

    await catchCall(
      native.methods
        .setHeader(newCollectionHeader)
        .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
      "Unauthorized"
    );

    await mainInterface.methods
      .setCollectionsMetadata(
        [await native.methods.collectionId().call()],
        [resetCollectionHeader]
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

      await itemProjection.assertCheckHeader(
        expectedResetCollection,
        mainInterface.methods
          .collection(await native.methods.collectionId().call())
          .call()
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
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;

    var collectionHeader = [accounts[1], "Collection1", "COL1", "uri1"];

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
      zeroDecimals,
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );
    var native = res["native"];
    var itemids = res["itemIds"];
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

    var newCollectionHeader = [
      native.options.address,
      "Collection2",
      "COL2",
      "uri2",
    ];
    await native.methods
      .setItemsMetadata(itemids, [newCollectionHeader])
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    var ExpectedResult = {
      header: {
        host: utilities.voidEthereumAddress,
        name: "Collection2",
        symbol: "COL2",
        uri: "uri2",
      },
      collectionId: await native.methods.collectionId().call(),
      id: itemids[0],
      accounts: [accounts[1]],
      amounts: [10000],
    };

    await itemProjection.checkItem(
      ExpectedResult,
      await mainInterface.methods.item(itemids[0]).call()
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
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;

    var collectionHeader = [accounts[1], "Collection1", "COL1", "uri1"];

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
      zeroDecimals,
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );
    var native = res["native"];
    var itemids = res["itemIds"];
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

    var newCollectionHeader = [accounts[9], "Collection2", "COL2", "uri2"];

    await native.methods
      .setItemsMetadata(itemids, [newCollectionHeader])
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    await catchCall(
      native.methods
        .setItemsMetadata(itemids, [collectionHeader])
        .send(blockchainConnection.getSendingOptions({ from: accounts[2] })),
      "Unauthorized"
    );
    var ExpectedResult = {
      header: {
        host: utilities.voidEthereumAddress,
        name: "Collection2",
        symbol: "COL2",
        uri: "uri2",
      },
      collectionId: await native.methods.collectionId().call(),
      id: itemids[0],
      accounts: [accounts[1]],
      amounts: [10000],
    };

    await itemProjection.checkItem(
      ExpectedResult,
      await mainInterface.methods.item(itemids[0]).call()
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
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;

    var collectionHeader = [accounts[1], "Collection1", "COL1", "uri1"];
    var collectionHeader2 = [accounts[1], "Collection2", "COL2", "uri2"];

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
      {
        header: {
          host: accounts[1],
          name: "Item2",
          symbol: "I2",
          uri: "uriItem2",
        },
        collectionId: utilities.voidBytes32,
        id: 0,
        accounts: [accounts[1]],
        amounts: ["10000000000000000"],
      },
    ];

    var itemsCollection2 = [];

    var res = await itemsv2.initialization(
      zeroDecimals,
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );
    var native = res["native"];
    var itemids = res["itemIds"];

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
      zeroDecimals,
      collectionId,
      collectionHeader2,
      itemsCollection2,
      accounts[1],
      "URI"
    );
    var nativeCollection2 = resCollection2["native"];

    var collection2Id = await nativeCollection2.methods.collectionId().call();

    await native.methods
      .setItemsCollection(itemids, [collection2Id, collection2Id])
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

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
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;

    var collectionHeader = [accounts[1], "Collection1", "COL1", "uri1"];
    var collectionHeader2 = [accounts[3], "Collection2", "COL2", "uri2"];

    var items = [
      [
        [utilities.voidEthereumAddress, "Item1", "I1", "uriItem1"],
        collectionId,
        0,
        [accounts[1]],
        [10000],
      ],
    ];

    var itemsCollection2 = [];

    var res = await itemsv2.initialization(
      zeroDecimals,
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );
    var native = res["native"];
    var itemids = res["itemIds"];

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
      zeroDecimals,
      collectionId,
      collectionHeader2,
      itemsCollection2,
      accounts[1],
      "URI"
    );
    var nativeCollection2 = resCollection2["native"];

    var collection2Id = await nativeCollection2.methods.collectionId().call();
    var collection1Id = await native.methods.collectionId().call();

    await native.methods
      .setItemsCollection(itemids, [collection2Id])
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    await itemProjection.assertCheckCollection(items, collection2Id);

    await nativeCollection2.methods
      .setItemsCollection(itemids, [collection1Id])
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    await itemProjection.assertCheckCollection(items, collection1Id);
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
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;

    var collectionHeader = [accounts[1], "Collection1", "COL1", "uri1"];

    var items = [];

    var res = await itemsv2.initialization(
      zeroDecimals,
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
    await itemProjection.assertCheckBalanceSupply(
      native.methods
        .mintItems(CreateItem)
        .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
      CreateItem,
      false
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
     */
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;

    var collectionHeader = [accounts[1], "Collection1", "COL1", "uri1"];

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
      zeroDecimals,
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );
    var native = res["native"];
    var itemids = res["itemIds"];

    var CreateItem = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await native.methods.collectionId().call(),
        id: itemids[0],
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
        id: itemids[1],
        accounts: [accounts[4], accounts[7], accounts[9]],
        amounts: [
          "10000000000000000",
          "10000000000000000",
          "10000000000000000",
        ],
      },
    ];

    var accountList = CreateItem.map((it) => it.accounts);

    var checkBal = await Promise.all(
      accountList.map(async (it, i) => {
        return await itemsv2.checkBalances(
          it,
          Array(it.length).fill(itemids[i])
        );
      })
    );

    await itemProjection.assertCheckBalanceSupplyWithBalance(
      native.methods
        .mintItems(CreateItem)
        .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
      CreateItem,
      checkBal,
      false
    );
  });

  it("#630 mint Items for Collection ids and Items ids that don't exist", async () => {
    /**
     * Authorized subjects:
     * Collection host address
     * Functions used in the test:
     * lazyInit
     * mintItems (CreateItem[] calldata items)
     *
     * Mint new Items for different accounts and amounts calling the Native Projection mintItems functions using wrong Collection ids and Item
     *ids
     * Using non-existent means that the Items cannot be minted
     * must fail: I cannot mint items from a non-existing collection/id
     */
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;

    var collectionHeader = [accounts[1], "Collection1", "COL1", "uri1"];

    var items = [];

    var res = await itemsv2.initialization(
      zeroDecimals,
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

  it("#631 create and mint Items with Collection ids and Items ids not controlled by the Projection", async () => {
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
    var zeroDecimals = false;
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
      zeroDecimals,
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
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;

    var collectionHeader = [accounts[1], "Collection1", "COL1", "uri1"];

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
      zeroDecimals,
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );
    var native = res["native"];
    var itemids = res["itemIds"][0];

    var CreateItem = [
      {
        header: {
          host: utilities.voidEthereumAddress,
          name: "",
          symbol: "",
          uri: "",
        },
        collectionId: await native.methods.collectionId().call(),
        id: itemids,
        accounts: [accounts[1]],
        amounts: ["10000000000000000"],
      },
    ];

    await native.methods
      .mintItems(CreateItem)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var ExpectedResult = {
      header: {
        host: utilities.voidEthereumAddress,
        name: "Collection1",
        symbol: "COL1",
        uri: "uri1",
      },
      collectionId: await native.methods.collectionId().call(),
      id: itemids,
      accounts: [accounts[1]],
      amounts: ["10000000000000000"],
    };

    await itemProjection.checkItem(
      ExpectedResult,
      await mainInterface.methods.item(itemids).call()
    );
  });

  it("#633 create and mint Items passing a host address different from void address", async () => {
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
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;

    var collectionHeader = [accounts[1], "Collection1", "COL1", "uri1"];

    var items = [
      [[accounts[1], "Item1", "I1", "uriItem1"], collectionId, 0, [accounts[1]], [10000]],
    ];

    var res = await itemsv2.initialization(
      zeroDecimals,
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );
    var native = res["native"];
    var itemids = res["itemIds"][0];

    var CreateItem = [
      {
        header: {
          host: accounts[4],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await native.methods.collectionId().call(),
        id: itemids,
        accounts: [accounts[1]],
        amounts: ["10000000000000000"],
      },
    ];

    await native.methods
      .mintItems(CreateItem)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var ExpectedResult = {
      header: {
        host: utilities.voidEthereumAddress,
        name: "Item1",
        symbol: "I1",
        uri: "uriItem1",
      },
      collectionId: await native.methods.collectionId().call(),
      id: itemids,
      accounts: [accounts[1]],
      amounts: ["10000000000000000"],
    };

    await itemProjection.checkItem(
      ExpectedResult,
      await mainInterface.methods.item(itemids).call()
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
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;

    var collectionHeader = [accounts[1], "Collection1", "COL1", "uri1"];

    var items = [];

    var res = await itemsv2.initialization(
      zeroDecimals,
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

    var tx = await native.methods
      .mintItems(CreateItem, [true])
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    
    idItems = await itemProjection.getItemIdFromLog(tx);
    
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

    await itemProjection.assertCheckFinalized(native.methods.isFinalized(idItems[0]).call(), true);
    await catchCall(
      native.methods
        .mintItems(CreateItem2, [false])
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
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;

    var collectionHeader = [accounts[1], "Collection1", "COL1", "uri1"];

    var items = [];

    var res = await itemsv2.initialization(
      zeroDecimals,
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

    var tx = await native.methods
      .mintItems(CreateItem, [false])
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    
    idItems = await itemProjection.getItemIdFromLog(tx);

    await itemProjection.assertCheckFinalized(native.methods.isFinalized(idItems[0]).call(), false);

    await itemProjection.assertCheckBalanceSupply(
      native.methods
        .mintItems(CreateItem, [false])
        .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
      CreateItem,
      false
    );
  });

  it("#637/1 Items operations safeTransaferFrom", async () => {
    /**
     * safeTransferFrom, safeBatchTransferFrom,
     * Burn (no data), bunBatch (no data), Burn (data), bunBatch (data) -> takes references from Items core tests from 465 to 586 .
     * Using the isApprovalForAll of the NativeProjection and the setApprovalForAll of the MainInterface because you can’t use the one of the NativeProjetion.
     */
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;

    var collectionHeader = [accounts[1], "Collection1", "COL1", "uri1"];

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
      zeroDecimals,
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );
    var native = res["native"];
    var itemids = res["itemIds"];

    var transferAmount = ["10000000000000000", "3000000000000000"];
    var fromAddress = [accounts[1], accounts[2]];
    var toAddress = [accounts[3], accounts[4]];
    var checkBalFrom = await itemsv2.checkBalances(fromAddress, itemids);

    var checkBalTo = await itemsv2.checkBalances(toAddress, itemids);

    await Promise.all(
      itemids.map(async (item, index) => {
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
  });

  it("#637/2 Items operations safeTransaferFrom and setApproval", async () => {
    /**
     * safeTransferFrom, safeBatchTransferFrom,
     * Burn (no data), bunBatch (no data), Burn (data), bunBatch (data) -> takes references from Items core tests from 465 to 586 .
     * Using the isApprovalForAll of the NativeProjection and the setApprovalForAll of the MainInterface because you can’t use the one of the NativeProjetion.
     * 
     * must fail: cannot call setApprovalForAll from nativeProjection
     * must fail: cannot call safeTransferFrom from unauthorized address
     */
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;

    var collectionHeader = [accounts[1], "Collection1", "COL1", "uri1"];

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
      zeroDecimals,
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );
    var native = res["native"];
    var itemids = res["itemIds"];

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
        await itemProjection.assertCheckIsApprovedForAll(native.methods.isApprovedForAll(fromAddress[index], op).call(), false);
        await mainInterface.methods
          .setApprovalForAll(op, true)
          .send(
            blockchainConnection.getSendingOptions({ from: fromAddress[index] })
          );
        await itemProjection.assertCheckIsApprovedForAll(native.methods.isApprovedForAll(fromAddress[index], op).call(), true);
      })
    );

    var checkBalFrom = await itemsv2.checkBalances(fromAddress, itemids);

    var checkBalTo = await itemsv2.checkBalances(toAddress, itemids);

    await Promise.all(
      itemids.map(async (item, index) => {
        await catchCall(
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
        );
      })
    );

    await Promise.all(
      itemids.map(async (item, index) => {
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
  });

  it("#637/3 Items operations safeBatchTransaferFrom", async () => {
    /**
     * safeTransferFrom, safeBatchTransferFrom,
     * Burn (no data), bunBatch (no data), Burn (data), bunBatch (data) -> takes references from Items core tests from 465 to 586 .
     * Using the isApprovalForAll of the NativeProjection and the setApprovalForAll of the MainInterface because you can’t use the one of the NativeProjetion.
     */
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;

    var collectionHeader = [accounts[1], "Collection1", "COL1", "uri1"];

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
      zeroDecimals,
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );
    var native = res["native"];
    var itemids = res["itemIds"];

    var transferAmount = [
      "10000000000000000",
      "2500000000000000",
      "20000000000000000",
      "1000000000000000",
    ];
    var fromAddress = [accounts[1], accounts[1], accounts[2], accounts[2]];
    var toAddress = [accounts[3], accounts[3], accounts[4], accounts[4]];
    var checkBalFrom = await itemsv2.checkBalances(fromAddress, itemids);

    var checkBalTo = await itemsv2.checkBalances(toAddress, itemids);

    var items1 = itemids.slice(0, 2);
    var items2 = itemids.slice(2, 4);

    await mainInterface.methods
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

    await mainInterface.methods
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
  });

  it("#637/4 Items operations safeBatchTransaferFrom and setApproval", async () => {
    /**
     * safeTransferFrom, safeBatchTransferFrom,
     * Burn (no data), bunBatch (no data), Burn (data), bunBatch (data) -> takes references from Items core tests from 465 to 586 .
     * Using the isApprovalForAll of the NativeProjection and the setApprovalForAll of the MainInterface because you can’t use the one of the NativeProjetion.
     * 
     * must fail: cannot call setApprovalForAll from nativeProjection
     * must fail: cannot call safeBatchTransferFrom from unauthorized address
     */
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;

    var collectionHeader = [accounts[1], "Collection1", "COL1", "uri1"];

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
      zeroDecimals,
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );
    var native = res["native"];
    var itemids = res["itemIds"];

    var transferAmount = [
      "10000000000000000",
      "2500000000000000",
      "20000000000000000",
      "1000000000000000",
    ];
    var fromAddress = [accounts[1], accounts[1], accounts[2], accounts[2]];
    var toAddress = [accounts[3], accounts[3], accounts[4], accounts[4]];
    var operator = [accounts[5], accounts[5], accounts[6], accounts[6]];
    var checkBalFrom = await itemsv2.checkBalances(fromAddress, itemids);

    var checkBalTo = await itemsv2.checkBalances(toAddress, itemids);

    var items1 = itemids.slice(0, 2);
    var items2 = itemids.slice(2, 4);

    await catchCall(
      native.methods
        .setApprovalForAll(accounts[3], true)
        .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
      "call directly the setApprovalForAll on the main Interface 0x915a22a152654714fceca3f4704fcf6bd314624c"
    );

    await Promise.all(
      operator.map(async (op, index) => {
        await itemProjection.assertCheckIsApprovedForAll(native.methods.isApprovedForAll(fromAddress[index], op).call(), false);
        await mainInterface.methods
          .setApprovalForAll(op, true)
          .send(
            blockchainConnection.getSendingOptions({ from: fromAddress[index] })
          );
        await itemProjection.assertCheckIsApprovedForAll(native.methods.isApprovedForAll(fromAddress[index], op).call(), true);
      })
    );

    await Promise.all(
      itemids.map(async (item, index) => {
        await catchCall(
          mainInterface.methods
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
      })
    );

    await mainInterface.methods
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

    await mainInterface.methods
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
  });

  it("#637/5 Items operations burn", async () => {
    /**
     * safeTransferFrom, safeBatchTransferFrom,
     * Burn (no data), bunBatch (no data), Burn (data), bunBatch (data) -> takes references from Items core tests from 465 to 586 .
     * Using the isApprovalForAll of the NativeProjection and the setApprovalForAll of the MainInterface because you can’t use the one of the NativeProjetion.
     */
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;

    var collectionHeader = [accounts[1], "Collection1", "COL1", "uri1"];

    var items = [];

    var res = await itemsv2.initialization(
      zeroDecimals,
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
  });

  it("#637/6 Items operations burnBatch and setApproval", async () => {
    /**
     * safeTransferFrom, safeBatchTransferFrom,
     * Burn (no data), bunBatch (no data), Burn (data), bunBatch (data) -> takes references from Items core tests from 465 to 586 .
     * Using the isApprovalForAll of the NativeProjection and the setApprovalForAll of the MainInterface because you can’t use the one of the NativeProjetion.
     */
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;

    var collectionHeader = [accounts[1], "Collection1", "COL1", "uri1"];

    var items = [];

    var res = await itemsv2.initialization(
      zeroDecimals,
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

    var burnAmount = [
      "10000000000000000",
      "2000000000000000",
      "10000000000000000",
      "2000000000000000",
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
        await itemProjection.assertCheckIsApprovedForAll(native.methods.isApprovedForAll(burnAddress[index], op).call(), false);
        await mainInterface.methods
          .setApprovalForAll(op, true)
          .send(
            blockchainConnection.getSendingOptions({ from: burnAddress[index] })
          );
        await itemProjection.assertCheckIsApprovedForAll(native.methods.isApprovedForAll(burnAddress[index], op).call(), true);
      })
    );

    await mainInterface.methods
      .burnBatch(burnAddress[0], idItems.slice(0, 2), burnAmount.slice(0, 2))
      .send(
        blockchainConnection.getSendingOptions({
          from: operator[0],
        })
      );

    await mainInterface.methods
      .burnBatch(burnAddress[2], idItems.slice(2, 4), burnAmount.slice(2, 4))
      .send(
        blockchainConnection.getSendingOptions({
          from: operator[2],
        })
      );

    var expectedBalance = await Promise.all(
      checkBal["balances"].map(async (item, index) => {
        return await Promise.all(
          item.map((it, i) => {
            return it.sub(burnAmount[index]);
          })
        );
      })
    );

    var expectedSupply = await Promise.all(
      checkBal["totalSupplies"].map(async (item, index) => {
        return await Promise.all(
          item.map((it, i) => {
            return it.sub(burnAmount[index]);
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
  });
  it("#637/7 Items operations SafeBatchTransferFrom with mainInterface", async () => {
    /**
     * safeTransferFrom, safeBatchTransferFrom,
     * Burn (no data), bunBatch (no data), Burn (data), bunBatch (data) -> takes references from Items core tests from 465 to 586 .
     * Using the isApprovalForAll of the NativeProjection and the setApprovalForAll of the MainInterface because you can’t use the one of the NativeProjetion.
     * 
     * must fail: cannot call setApprovalForAll from nativeProjection
     */
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;

    var collectionHeader = [accounts[1], "Collection1", "COL1", "uri1"];
    var mainCollectionHeader = [accounts[1], "Collection2", "COL2", "uri2"];

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
      zeroDecimals,
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );
    var native = res["native"];
    var itemids = res["itemIds"];

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
        amounts: ["20000000000000000"],
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
        amounts: ["30000000000000000"],
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

    var transferAmount = [
      "10000000000000000",
      "2500000000000000",
      "20000000000000000",
      "1000000000000000",
    ];
    var fromAddress = [accounts[1], accounts[1], accounts[1], accounts[1]];
    var toAddress = [accounts[3], accounts[3], accounts[4], accounts[4]];
    var totalIds = itemids.concat(mainItemId);
    var checkBalFrom = await itemsv2.checkBalances(fromAddress, totalIds);

    var checkBalTo = await itemsv2.checkBalances(toAddress, totalIds);

    var items1 = totalIds.slice(0, 2);
    var items2 = totalIds.slice(2, 4);

    await catchCall(
      native.methods
        .setApprovalForAll(accounts[3], true)
        .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
      "call directly the setApprovalForAll on the main Interface 0x915a22a152654714fceca3f4704fcf6bd314624c"
    );

    await mainInterface.methods
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

    await mainInterface.methods
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
      totalIds,
      expectedBalanceFrom,
      expectedTotalSupplies
    );
    await itemsv2.checkBalances(
      toAddress,
      totalIds,
      expectedBalanceTo,
      expectedTotalSupplies
    );
  });

  it("#637/8 Items operations burnBatch with mainInterface", async () => {
    /**
     * safeTransferFrom, safeBatchTransferFrom,
     * Burn (no data), bunBatch (no data), Burn (data), bunBatch (data) -> takes references from Items core tests from 465 to 586 .
     * Using the isApprovalForAll of the NativeProjection and the setApprovalForAll of the MainInterface because you can’t use the one of the NativeProjetion.
     */
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;

    var collectionHeader = [accounts[1], "Collection1", "COL1", "uri1"];
    var mainCollectionHeader = [accounts[1], "Collection2", "COL2", "uri2"];

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
      zeroDecimals,
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );
    var native = res["native"];
    var itemids = res["itemIds"];

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
        amounts: ["20000000000000000"],
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
        amounts: ["30000000000000000"],
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
      "10000000000000000",
      "10000000000000000",
      "10000000000000000",
      "10000000000000000",
    ];
    var burnAddress = accounts[1];
    var totalItemIds = mainItemId.concat(itemids).map((item, index) => {
      return [item];
    });

    var checkBal = await Promise.all(
      totalItemIds.map(async (item, index) => {
        return await itemsv2.checkBalances([burnAddress], totalItemIds[index]);
      })
    );

    await mainInterface.methods
      .burnBatch(accounts[1], mainItemId.concat(itemids), burnAmount, "0x")
      .send(blockchainConnection.getSendingOptions({ from: burnAddress }));

    var expectedBalance = await Promise.all(
      checkBal.map(async (it, i) => {
        return await Promise.all(
          it["balances"].map(async (item, index) => {
            return item[0].sub(burnAmount[index]);
          })
        );
      })
    );

    var expectedSupply = await Promise.all(
      checkBal.map(async (it, i) => {
        return await Promise.all(
          it["totalSupplies"].map(async (item, index) => {
            return item[0].sub(burnAmount[index]);
          })
        );
      })
    );

    await Promise.all(
      totalItemIds.map(async (item, index) => {
        return await itemsv2.checkBalances(
          [burnAddress],
          totalItemIds[index],
          expectedBalance[index],
          expectedSupply[index]
        );
      })
    );
  });

  it("#638 Batch operation using the Main Interface methods", async () => {
    /**
     * Authorized subjects:
     * Items holders
     * approved operators
     *
     * Functions used in the test:
     * lazyInit
     * createCollection (main interface)
     *safeBatchTransferFrom (main interface)
     * burnBatch (main interface)
     *
     * Create multiple Collection using the Main Interface.
     * Using the main interface batch methods (safeBatchTransferFrom and burnBatch), a user can manage different Items from different Collection and one of them is the Projection Collection
     */
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;

    var collectionHeader = [accounts[1], "Collection1", "COL1", "uri1"];

    var items = [
      [
        [utilities.voidEthereumAddress, "Item1", "I1", "uriItem1"],
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

    var res = await itemsv2.initialization(
      zeroDecimals,
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );
    var native = res["native"];
    var itemids = res["itemIds"];

    var result = await mainInterface.methods
      .createCollection(collectionHeader, itemsMain)
      .send(blockchainConnection.getSendingOptions());
    var res = result.events.CollectionItem.returnValues;

    var collectionIdMain = res["toCollectionId"];
    var idItemsMain = res["itemId"];

    var totalItemsId = itemids.concat(idItemsMain);

    var totalSupply = await Promise.all(
      totalItemsId.map(
        async (value, key) =>
          await mainInterface.methods.totalSupply(value).call()
      )
    );

    var toAccounts = [accounts[4], accounts[4]];
    var fromAccounts = [accounts[1], accounts[1]];

    var checkBal = await itemsv2.checkBalances(toAccounts, totalItemsId);
    var previousBalance = checkBal["balances"];

    checkBal = await itemsv2.checkBalances(fromAccounts, totalItemsId);
    var previousBalanceFrom = checkBal["balances"];

    var transferAmount = 100000000000;
    await mainInterface.methods
      .safeBatchTransferFrom(
        accounts[1],
        accounts[4],
        totalItemsId,
        [transferAmount, transferAmount],
        "0x"
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var expectedBalanceTo = await Promise.all(
      previousBalance.map((key, value) => key[0].add(transferAmount))
    );
    var expectedBalanceFrom = await Promise.all(
      previousBalanceFrom.map((key, value) => key[0].sub(transferAmount))
    );

    await itemsv2.checkBalances(
      accounts[4],
      totalItemsId,
      expectedBalanceTo,
      totalSupply
    );
    await itemsv2.checkBalances(
      accounts[1],
      totalItemsId,
      expectedBalanceFrom,
      totalSupply
    );

    checkBal = await itemsv2.checkBalances(toAccounts, totalItemsId);
    previousBalance = checkBal["balances"];

    checkBal = await itemsv2.checkBalances(fromAccounts, totalItemsId);
    previousBalanceFrom = checkBal["balances"];

    var burnValue = 100000000;
    await mainInterface.methods
      .burnBatch(accounts[4], totalItemsId, [burnValue, burnValue])
      .send(blockchainConnection.getSendingOptions({ from: accounts[4] }));

    expectedBalanceFrom = await Promise.all(
      previousBalance.map((key, value) => key[0].sub(burnValue))
    );

    var expectedTotalSuplly = await Promise.all(
      totalSupply.map((value, key) => value.sub(burnValue))
    );

    await itemsv2.checkBalances(
      accounts[4],
      totalItemsId,
      expectedBalanceFrom,
      expectedTotalSuplly
    );
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
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;

    var collectionHeader = [accounts[1], "Collection1", "COL1", "uri1"];

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
      zeroDecimals,
      collectionId,
      collectionHeader,
      items,
      accounts[1],
      "URI"
    );
    var native = res["native"];
    var itemids = res["itemIds"];

    var CreateItem = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await native.methods.collectionId().call(),
        id: itemids[0],
        accounts: [accounts[1]],
        amounts: ["10000000000000000"],
      },
      {
        header: {
          host: accounts[1],
          name: "Item2",
          symbol: "I2",
          uri: "uriItem2",
        },
        collectionId: await native.methods.collectionId().call(),
        id: itemids[0],
        accounts: [accounts[1]],
        amounts: ["10000000000000000"],
      },
    ];

    itemids.map(async (ids) => {
      await itemProjection.assertCheckFinalized(native.methods.isFinalized(ids).call(), false);
    });

    var tx = await native.methods
      .mintItems(CreateItem, [true, true])
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    itemids.map(async (ids) => {
      await itemProjection.assertCheckFinalized(native.methods.isFinalized(ids).call(), false);
    });
  });
});
