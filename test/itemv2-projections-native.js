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

    var collectionHeader = [accounts[1], "Item1", "I1", "uriItem1"];

    var items = [
      [
        [utilities.voidEthereumAddress, "", "", ""],
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
      assert.equal(
        await native.methods.decimals(0).call(),
        zeroDecimals ? "0" : "18"
      );
      assert.notEqual(
        await native.methods.collectionId().call(),
        utilities.voidBytes32
      );
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

    var nativeProjectionAddress = await itemsv2.deployNativeProjection();

    var items = [];

    var collectionId = (
      await itemsv2.createCollection(nativeProjectionAddress, items)
    )["collectionId"];

    var collectionHeader = [
      nativeProjectionAddress,
      "Collection",
      "COL",
      "uri",
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
    assert.equal(
      await native.methods.decimals(0).call(),
      zeroDecimals ? "0" : "18"
    );
    assert.equal(await native.methods.collectionId().call(), collectionId);
  });

  it("#???? Alternative Initialization", async () => {
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

    var nativeProjectionAddress = await itemsv2.deployNativeProjection();

    var items = [];

    var collectionId = (
      await itemsv2.createCollection(nativeProjectionAddress, items)
    )["collectionId"];

    var collectionHeader = [
      nativeProjectionAddress,
      "Collection",
      "COL",
      "uri",
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
    assert.equal(
      await native.methods.decimals(0).call(),
      zeroDecimals ? "0" : "18"
    );
    assert.equal(await native.methods.collectionId().call(), collectionId);

    var collectionData = await mainInterface.methods.collection(collectionId).call();
    assert.equal(collectionData.host, native.options.address);
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
     * must fail: an address different from the host can't change the Collection Metadata
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
        [utilities.voidEthereumAddress, "", "", ""],
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
    assert.equal(
      await native.methods.decimals(0).call(),
      zeroDecimals ? "0" : "18"
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
    assert.equal(await native.methods.uri().call(), "uri2");
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
     * must fail: an address different from the host can't change the Collection host
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
        [utilities.voidEthereumAddress, "", "", ""],
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
    assert.equal(
      await native.methods.decimals(0).call(),
      zeroDecimals ? "0" : "18"
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
    assert.equal(await native.methods.uri().call(), "uri2");
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
        [utilities.voidEthereumAddress, "", "", ""],
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

    console.log("Native", native.options.address);
    assert.equal(
      await native.methods.decimals(0).call(),
      zeroDecimals ? "0" : "18"
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
    assert.equal(await native.methods.uri().call(), "uri2");
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

    await native.methods
      .setHeader(newCollectionHeader)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
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

    itemProjection.assertCheckCollection(items, collection2Id);
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
        [utilities.voidEthereumAddress, "", "", ""],
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
      .setItemsCollection(itemids, [
        collection2Id,
      ])
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    itemProjection.assertCheckCollection(items, collection2Id);

    await nativeCollection2.methods
      .setItemsCollection(itemids, [collection1Id])
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    itemProjection.assertCheckCollection(items, collection1Id);
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
    var itemids = res["itemIds"][0];

    var CreateItem = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await native.methods.collectionId().call(),
        id: itemids,
        accounts: [accounts[1], accounts[2]],
        amounts: ["10000000000000000", "200"],
      },
    ];

    // await native.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }))
    await itemProjection.assertCheckBalanceSupply(
      native.methods
        .mintItems(CreateItem)
        .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
      CreateItem,
      false
    );
  });

  it("#629 Create and mint Items for different accounts and amounts", async () => {
    /**
     * Authorized subjects:
     * Collection host address
     * Functions used in the test:
     * lazyInit
     * mintItems (CreateItem[] calldata items)
     *
     * Create new Items and then mint them for different accounts and amounts calling the Native Projection mintItems functions.
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
          host: accounts[1],
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

    // await native.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }))
    await itemProjection.assertCheckBalanceSupply(
      native.methods
        .mintItems(CreateItem)
        .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
      CreateItem,
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
        [utilities.voidEthereumAddress, "", "", ""],
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
      [[accounts[1], "", "", ""], collectionId, 0, [accounts[1]], [10000]],
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

  it("#634 create and mint Items with Collection ids and Items ids not controlled by the Projection", async () => {
    /**
     * Authorized subjects:
     * Collection host address
     * Functions used in the test:
     * lazyInit
     * mintItems (CreateItem[] calldata items)
     *
     * Mint new Items for different accounts and amounts calling the Native Projection mintItems functions using other Collection ids and Item
     *ids
     * Using a Collection id different from the one controlled by the Projection but right Items ids belonging to the Projection Collection means that the Items can be correctly minted
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
        [utilities.voidEthereumAddress, "", "", ""],
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
    var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash)).logs;
    idItems = logs
      .filter(
        (it) =>
          it.topics[0] ===
          web3.utils.sha3("CollectionItem(bytes32,bytes32,uint256)")
      )
      .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

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
    assert.equal(await native.methods.isFinalized(idItems[0]).call(), true);
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

    var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash)).logs;
    idItems = logs
      .filter(
        (it) =>
          it.topics[0] ===
          web3.utils.sha3("CollectionItem(bytes32,bytes32,uint256)")
      )
      .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

    assert.equal(await native.methods.isFinalized(idItems[0]).call(), false);

    //TODO: devo fixare assertCheckBalanceSupply per decommentare questo
    // await itemProjection.assertCheckBalanceSupply(
    //   native.methods
    //   .mintItems(CreateItem, [false])
    //   .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
    //   CreateItem,
    //   false
    // );

    
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
          host: accounts[1],
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

    // await native.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }))
    // await itemProjection.assertCheckBalanceSupply(native.methods.mintItems(CreateItem, [true]).send(blockchainConnection.getSendingOptions({ from: accounts[1] })), CreateItem, false);
    // console.log(await native.methods.isFinalized(itemids).call())
    var tx = await native.methods
      .mintItems(CreateItem, [true])
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash)).logs;
    idItems = logs
      .filter(
        (it) =>
          it.topics[0] ===
          web3.utils.sha3("CollectionItem(bytes32,bytes32,uint256)")
      )
      .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

    var CreateItem2 = [
      {
        header: {
          host: accounts[1],
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
    console.log(await native.methods.isFinalized(itemids).call());
    await native.methods
      .mintItems(CreateItem2, [true])
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    console.log(await native.methods.isFinalized(itemids).call());
  });
});
