var itemsv2 = require("../resources/itemsv2");
var itemProjection = require("../resources/itemProjection");
var wrapperResource = require("../resources/wrapper");
const blockchainConnection = require("../util/blockchainConnection");
const utilities = require("../util/utilities");
describe("itemv2 projections ERC1155Wrapper", () => {
  var tokenHolder = "0xcfB586d08633fC36953be8083B63a7d96D50265B";
  var wrapper;
  var MainInterface;
  var mainInterface;
  var ItemInteroperableInterface;
  var itemInteroperableInterface;
  var itemInteroperableInterfaceAddress;
  var item1erc1155Address = "0x74EE68a33f6c9f113e22B3B77418B75f85d07D22";
  var item2erc1155Address = "0x915A22A152654714FcecA3f4704fCf6bd314624c";
  var item4erc1155Address = "0x76BE3b62873462d2142405439777e971754E8E77";
  var item5erc1155Address = "0xd07dc4262bcdbf85190c01c996b4c06a461d2430";
  var item1erc1155Id = "10";
  var item2erc1155Id = "1448357374059271822963346111639752691725470234835";
  var item3erc1155Id;
  var item4erc1155Id = "10";
  var item5erc1155Id = "17";
  var item6erc1155Id;
  var item1Holder1 = "0x072300626D4325197c65FAc4b0a19062d88A48E2";
  var item1Holder2 = "0x459C2029F74E89bA6D02688BC338580D89C7f84B";
  var item2Holder1 = "0x942eE44ef3A64e21Ce55EE8513B698e7058722F9";
  var item4Holder1 = "0x4897d38b0974051d8fa34364e37a5993f4a966a5";
  var item4Holder2 = "0xbad2e817Af781B6F1573d65409ddEF24d9656f8b";
  var item5Holder1 = "0xfb4c65f1dd92ae419f8d52e0ed3d94775476b900";
  var osHolderScenario = "0x07DE7A977fA1eCf1219F8773034880D2dFc4D3c4";
  var token1;
  var token2;
  var token4;
  var token5;
  var itemId1;
  var itemId2;
  var itemId3;
  var itemId4;
  var itemId5;
  var itemId6;
  var itemId7;
  var item3;

  var itemsList = [];
  var approvedHost = [];

  async function approveHost(holder) {
    if (!approvedHost.includes(holder)) {
      await blockchainConnection.unlockAccounts(holder);
      approvedHost.push(holder);
    }
  }

  async function asInteroperableInterface(itemId) {
    var c = new web3.eth.Contract(
      ItemInteroperableInterface.abi,
      await mainInterface.methods.interoperableOf(itemId).call()
    );
    try {
      await blockchainConnection.unlockAccounts(c.options.address);
    } catch (e) {}
    return c;
  }

  before(async () => {
    ItemInteroperableInterface = await compile(
      "impl/ItemInteroperableInterface"
    );
    itemInteroperableInterface = await new web3.eth.Contract(
      ItemInteroperableInterface.abi
    )
      .deploy({ data: ItemInteroperableInterface.bin })
      .send(blockchainConnection.getSendingOptions());
    itemInteroperableInterfaceAddress =
      itemInteroperableInterface.options.address;
    var headerCollection = {
      host: accounts[1],
      name: "Colection1",
      symbol: "C1",
      uri: "uriC1",
    };

    var items = [];

    var deployParam = abi.encode(
      [
        "bytes32",
        "tuple(address,string,string,string)",
        "tuple(tuple(address,string,string,string),bytes32,uint256,address[],uint256[])[]",
        "bytes",
      ],
      [
        utilities.voidBytes32,
        await itemsv2.convertHeader(headerCollection),
        items,
        utilities.voidBytes32,
      ]
    );

    deployParam = abi.encode(
      ["address", "bytes"],
      [knowledgeBase.mainInterfaceAddress, deployParam]
    );

    deployParam = abi.encode(["address", "bytes"], [accounts[1], deployParam]);

    var ERC1155Wrapper = await compile("projection/ERC1155/ERC1155Wrapper");
    wrapper = await new web3.eth.Contract(ERC1155Wrapper.abi)
      .deploy({ data: ERC1155Wrapper.bin, arguments: ["0x"] })
      .send(blockchainConnection.getSendingOptions());

    var ZeroDecimals = await compile("../resources/ERC1155ZeroDecimals");
    zeroDecimals = await new web3.eth.Contract(ZeroDecimals.abi)
      .deploy({ data: ZeroDecimals.bin, arguments: ["0x"] })
      .send(blockchainConnection.getSendingOptions());

    await wrapper.methods
      .lazyInit(deployParam)
      .send(blockchainConnection.getSendingOptions());

    await zeroDecimals.methods
      .lazyInit(deployParam)
      .send(blockchainConnection.getSendingOptions());

    MainInterface = await compile("model/IItemMainInterface");
    mainInterface = new web3.eth.Contract(
      MainInterface.abi,
      knowledgeBase.mainInterfaceAddress
    );

    token1 = new web3.eth.Contract(
      knowledgeBase.IERC1155ABI,
      item1erc1155Address
    );
    token2 = new web3.eth.Contract(
      knowledgeBase.IERC1155ABI,
      item2erc1155Address
    );
    token4 = new web3.eth.Contract(
      knowledgeBase.IERC1155ABI,
      item4erc1155Address
    );
    token5 = new web3.eth.Contract(
      knowledgeBase.IERC1155ABI,
      item5erc1155Address
    );

    var CreateItem3 = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await zeroDecimals.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[1]],
        amounts: ["1"],
      },
    ];

    var tx = await zeroDecimals.methods
      .mintItems(CreateItem3)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    item3erc1155Id = await itemProjection.getItemIdFromLog(tx);

    var tx = await zeroDecimals.methods
      .mintItems(CreateItem3)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    item6erc1155Id = await itemProjection.getItemIdFromLog(tx);

    // var tx = await zeroDecimals.methods
    //   .mintItems(CreateItem3)
    //   .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    // scenarioItem3erc1155Id = await itemProjection.getItemIdFromLog(tx);
  });

  it("#669 Wrap ERC1155 using the onERC1155Received", async () => {
    /**
        Authorized subjects:
        Item holders
        approved operator address
        Functions used in the test:
        onERC1155Received
        onERC1155BatchReceived
        Items used:
        Must fail: an ERC1155 with decimals different from 0 (not Item) cannot be wrapped.
        Must fail: a wrapping operation using the onERC1155Received without passing an array of values, cannot be performed.
        Wrap Item1 using the safeTransferFrom (onERC1155Received).
        Wrap Item2 using the safeTransferFrom (onERC1155Received).
        Wrap Item2 using the safeTransferFrom (onERC1155Received).
        Wrap Item3 using the safeTransferFrom (onERC1155Received).
        */

    var prevResult1Holder1 = await token1.methods
      .balanceOf(item1Holder1, item1erc1155Id)
      .call();
    var prevResult1Holder2 = await token1.methods
      .balanceOf(item1Holder2, item1erc1155Id)
      .call();
    var prevResult2Holder1 = await token2.methods
      .balanceOf(item2Holder1, item2erc1155Id)
      .call();

    await approveHost(item1Holder1);
    await approveHost(item1Holder2);
    await approveHost(item2Holder1);

    await token1.methods
      .safeTransferFrom(item1Holder1, accounts[1], item1erc1155Id, "1", "0x")
      .send(blockchainConnection.getSendingOptions({ from: item1Holder1 }));
    await token1.methods
      .safeTransferFrom(item1Holder2, accounts[1], item1erc1155Id, "1", "0x")
      .send(blockchainConnection.getSendingOptions({ from: item1Holder2 }));
    await token2.methods
      .safeTransferFrom(
        item2Holder1,
        accounts[1],
        item2erc1155Id,
        prevResult2Holder1.div(2),
        "0x"
      )
      .send(blockchainConnection.getSendingOptions({ from: item2Holder1 }));

    assert.equal(
      await token1.methods.balanceOf(item1Holder1, item1erc1155Id).call(),
      prevResult1Holder1.sub(1)
    );
    assert.equal(
      await token1.methods.balanceOf(item1Holder2, item1erc1155Id).call(),
      prevResult1Holder2.sub(1)
    );
    // assert.equal(
    //   await token2.methods.balanceOf(item2Holder1, item2erc1155Id).call(),
    //   prevResult2Holder1.div(2)
    // );
    assert.equal(
      await token1.methods.balanceOf(accounts[1], item1erc1155Id).call(),
      "2"
    );
    assert.equal(
      await token2.methods.balanceOf(accounts[1], item2erc1155Id).call(),
      prevResult2Holder1.div(2)
    );

    var wrongEncodeMint = web3.eth.abi.encodeParameters(
      ["uint256", "address"],
      [1, accounts[2]]
    );

    var encodeMint1 = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [["2"], [accounts[1]]]
    );

    prevResult2Holder1 = prevResult2Holder1.div(2);

    var encodeMint2 = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [
        [
          prevResult2Holder1.div(10).mul(1),
          prevResult2Holder1.div(10).mul(2),
          prevResult2Holder1.div(10).mul(1),
        ],
        [accounts[1], accounts[2], accounts[5]],
      ]
    );

    var encodeMint3 = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [
        [
          prevResult2Holder1.div(10).mul(3),
          prevResult2Holder1.div(10).mul(1),
          prevResult2Holder1.div(10).mul(2),
        ],
        [accounts[1], accounts[2], accounts[6]],
      ]
    );

    var encodeMint4 = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[1], [accounts[1]]]
    );

    await catchCall(
      token1.methods
        .safeTransferFrom(
          accounts[1],
          wrapper.options.address,
          item1erc1155Id,
          1,
          wrongEncodeMint
        )
        .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
      "ERC1155: transfer to non ERC1155Receiver implementer"
    );

    assert.equal(
      await zeroDecimals.methods.decimals(item3erc1155Id[0]).call(),
      "0"
    );
    assert.equal(
      await mainInterface.methods
        .balanceOf(accounts[1], item3erc1155Id[0])
        .call(),
      "1000000000000000000"
    );
    assert.equal(
      await token1.methods.balanceOf(accounts[1], item1erc1155Id).call(),
      "2"
    );

    itemId1 = await wrapperResource.mintItems1155(
      token1,
      accounts[1],
      wrapper.options.address,
      item1erc1155Id,
      2,
      encodeMint1,
      itemId1
    );

    itemId2 = await wrapperResource.mintItems1155(
      token2,
      accounts[1],
      wrapper.options.address,
      item2erc1155Id,
      prevResult2Holder1
        .div(10)
        .mul(1)
        .add(prevResult2Holder1.div(10).mul(2))
        .add(prevResult2Holder1.div(10).mul(1)),
      encodeMint2,
      itemId2
    );

    itemId2 = await wrapperResource.mintItems1155(
      token2,
      accounts[1],
      wrapper.options.address,
      item2erc1155Id,
      prevResult2Holder1
        .div(10)
        .mul(3)
        .add(prevResult2Holder1.div(10).mul(1))
        .add(prevResult2Holder1.div(10).mul(2)),
      encodeMint3,
      itemId2
    );

    itemId3 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[1],
      wrapper.options.address,
      item3erc1155Id[0],
      1,
      encodeMint4,
      itemId3
    );

    assert.equal(
      await token1.methods
        .balanceOf(wrapper.options.address, item1erc1155Id)
        .call(),
      "2"
    );

    // assert.equal(
    //   await zeroDecimals.methods
    //     .balanceOf(wrapper.options.address, item3erc1155Id[0])
    //     .call(),
    //   "1"
    // );

    assert.equal(
      await token2.methods
        .balanceOf(wrapper.options.address, item2erc1155Id)
        .call(),
      prevResult2Holder1
        .div(10)
        .mul(1)
        .add(prevResult2Holder1.div(10).mul(2))
        .add(prevResult2Holder1.div(10).mul(1))
        .add(
          prevResult2Holder1
            .div(10)
            .mul(3)
            .add(prevResult2Holder1.div(10).mul(1))
            .add(prevResult2Holder1.div(10).mul(2))
        )
    );

    assert.equal(
      await wrapper.methods.balanceOf(accounts[1], itemId1).call(),
      "2000000000000000000"
    );

    assert.equal(
      await wrapper.methods.balanceOf(accounts[1], itemId3).call(),
      "1000000000000000000"
    );

    await wrapper.methods
      .safeTransferFrom(
        accounts[1],
        accounts[2],
        itemId1,
        "600000000000000000",
        "0x"
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    await wrapper.methods
      .safeTransferFrom(
        accounts[1],
        accounts[4],
        itemId1,
        "400000000000000000",
        "0x"
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    await wrapper.methods
      .safeTransferFrom(
        accounts[1],
        accounts[2],
        itemId3,
        "200000000000000000",
        "0x"
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    assert.equal(
      await wrapper.methods.balanceOf(accounts[1], itemId1).call(),
      "1000000000000000000"
    );
    assert.equal(
      await wrapper.methods.balanceOf(accounts[2], itemId1).call(),
      "600000000000000000"
    );
    assert.equal(
      await wrapper.methods.balanceOf(accounts[4], itemId1).call(),
      "400000000000000000"
    );

    assert.equal(
      await wrapper.methods.balanceOf(accounts[1], itemId2).call(),
      prevResult2Holder1.div(10).mul(4)
    );
    assert.equal(
      await wrapper.methods.balanceOf(accounts[2], itemId2).call(),
      prevResult2Holder1.div(10).mul(3)
    );
    assert.equal(
      await wrapper.methods.balanceOf(accounts[5], itemId2).call(),
      prevResult2Holder1.div(10).mul(1)
    );
    assert.equal(
      await wrapper.methods.balanceOf(accounts[6], itemId2).call(),
      prevResult2Holder1.div(10).mul(2)
    );

    assert.equal(
      await wrapper.methods.balanceOf(accounts[1], itemId2).call(),
      prevResult2Holder1.div(10).mul(4)
    );
    assert.equal(
      await wrapper.methods.balanceOf(accounts[2], itemId2).call(),
      prevResult2Holder1.div(10).mul(3)
    );
    assert.equal(
      await wrapper.methods.balanceOf(accounts[5], itemId2).call(),
      prevResult2Holder1.div(10).mul(1)
    );
    assert.equal(
      await wrapper.methods.balanceOf(accounts[6], itemId2).call(),
      prevResult2Holder1.div(10).mul(2)
    );

    assert.equal(
      await wrapper.methods.totalSupply(itemId1).call(),
      "2000000000000000000"
    );
    assert.equal(
      await wrapper.methods.totalSupply(itemId2).call(),
      prevResult2Holder1
        .div(10)
        .mul(4)
        .add(
          prevResult2Holder1
            .div(10)
            .mul(3)
            .add(prevResult2Holder1.div(10).mul(1))
            .add(prevResult2Holder1.div(10).mul(2))
        )
    );
    assert.equal(
      await wrapper.methods.totalSupply(itemId3).call(),
      "1000000000000000000"
    );
  });

  it("#670 Wrap ERC1155 using the onERC1155BatchReceived", async () => {
    var prevResult2Holder1 = await token2.methods
      .balanceOf(item2Holder1, item2erc1155Id)
      .call();
    var prevResult4Holder1 = await token4.methods
      .balanceOf(item4Holder1, item4erc1155Id)
      .call();
    var prevResult4Holder2 = await token4.methods
      .balanceOf(item4Holder2, item4erc1155Id)
      .call();
    var prevResult5Holder1 = await token5.methods
      .balanceOf(item5Holder1, item5erc1155Id)
      .call();

    await approveHost(item2Holder1);
    await approveHost(item4Holder1);
    await approveHost(item4Holder2);
    await approveHost(item5Holder1);

    await token2.methods
      .safeTransferFrom(
        item2Holder1,
        accounts[2],
        item2erc1155Id,
        prevResult2Holder1,
        "0x"
      )
      .send(blockchainConnection.getSendingOptions({ from: item2Holder1 }));

    prevResult2Holder1 = prevResult2Holder1.div(2);

    await token4.methods
      .safeTransferFrom(item4Holder1, accounts[2], item4erc1155Id, "2", "0x")
      .send(blockchainConnection.getSendingOptions({ from: item4Holder1 }));

    await token4.methods
      .safeTransferFrom(item4Holder2, accounts[2], item4erc1155Id, "1", "0x")
      .send(blockchainConnection.getSendingOptions({ from: item4Holder2 }));

    await token5.methods
      .safeTransferFrom(item5Holder1, accounts[2], item5erc1155Id, "3", "0x")
      .send(blockchainConnection.getSendingOptions({ from: item5Holder1 }));

    assert.equal(
      await token4.methods.balanceOf(item4Holder1, item1erc1155Id).call(),
      prevResult4Holder1.sub(2)
    );
    assert.equal(
      await token4.methods.balanceOf(item4Holder2, item1erc1155Id).call(),
      prevResult4Holder2.sub(1)
    );
    assert.equal(
      await token5.methods.balanceOf(item5Holder1, item5erc1155Id).call(),
      prevResult5Holder1.sub(3)
    );

    var encodeMint2 = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [
        [
          prevResult2Holder1.div(3),
          prevResult2Holder1.div(3),
          prevResult2Holder1.div(3),
        ],
        [accounts[3], accounts[1], accounts[2]],
      ]
    );

    var encodeMint4 = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [["3"], [accounts[3]]]
    );

    var encodeMint5 = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [["3"], [accounts[3]]]
    );

    var encodeMint6 = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [["1"], [accounts[3]]]
    );

    itemId2 = await wrapperResource.mintItems1155(
      token2,
      accounts[2],
      wrapper.options.address,
      item2erc1155Id,
      prevResult2Holder1
        .div(3)
        .add(prevResult2Holder1.div(3))
        .add(prevResult2Holder1.div(3)),
      encodeMint2,
      itemId2
    );

    itemId4 = await wrapperResource.mintItems1155(
      token4,
      accounts[2],
      wrapper.options.address,
      item4erc1155Id,
      3,
      encodeMint4,
      itemId4
    );
    itemId5 = await wrapperResource.mintItems1155(
      token5,
      accounts[2],
      wrapper.options.address,
      item5erc1155Id,
      3,
      encodeMint5,
      itemId5
    );
    itemId6 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[1],
      wrapper.options.address,
      item6erc1155Id[0],
      1,
      encodeMint6,
      itemId6
    );

    var prevId4Acc2Bal = await wrapper.methods
      .balanceOf(accounts[3], itemId4)
      .call();

    await wrapper.methods
      .safeBatchTransferFrom(
        accounts[3],
        accounts[2],
        [itemId4, itemId5],
        ["400000000000000000", "700000000000000000"],
        "0x"
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[3] }));

    await wrapper.methods
      .safeBatchTransferFrom(
        accounts[3],
        accounts[4],
        [itemId4],
        ["400000000000000000"],
        "0x"
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[3] }));

    await wrapper.methods
      .safeBatchTransferFrom(
        accounts[3],
        accounts[6],
        [itemId5],
        ["300000000000000000"],
        "0x"
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[3] }));

    await wrapper.methods
      .safeBatchTransferFrom(
        accounts[3],
        accounts[7],
        [itemId6],
        ["200000000000000000"],
        "0x"
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[3] }));

    assert.equal(
      await wrapper.methods.balanceOf(accounts[2], itemId4).call(),
      "400000000000000000"
    );
    assert.equal(
      await wrapper.methods.balanceOf(accounts[4], itemId4).call(),
      "400000000000000000"
    );

    assert.equal(
      await wrapper.methods.balanceOf(accounts[2], itemId5).call(),
      "700000000000000000"
    );
    assert.equal(
      await wrapper.methods.balanceOf(accounts[6], itemId5).call(),
      "300000000000000000"
    );

    assert.equal(
      await wrapper.methods.balanceOf(accounts[7], itemId6).call(),
      "200000000000000000"
    );
    assert.equal(
      await wrapper.methods.balanceOf(accounts[3], itemId6).call(),
      "800000000000000000"
    );

    assert.equal(
      await wrapper.methods.totalSupply(itemId4).call(),
      "3000000000000000000"
    );
    assert.equal(
      await wrapper.methods.totalSupply(itemId5).call(),
      "3000000000000000000"
    );
    assert.equal(
      await wrapper.methods.totalSupply(itemId6).call(),
      "1000000000000000000"
    );
  });

  it("#671 Unwrap single using Burn", async () => {
    var prevBal = await token2.methods.balanceOf(accounts[1], item2erc1155Id).call();
    console.log(
      await mainInterface.methods
        .balanceOf(accounts[5], item3erc1155Id[0])
        .call()
    );

    console.log(
      await zeroDecimals.methods
        .balanceOf(accounts[5], item3erc1155Id[0])
        .call()
    );

    console.log(
      await mainInterface.methods
        .balanceOf(wrapper.options.address, item3erc1155Id[0])
        .call()
    );

    console.log(
      await zeroDecimals.methods
        .balanceOf(wrapper.options.address, item3erc1155Id[0])
        .call()
    );
    var burn = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes"],
      [token1.options.address, item1erc1155Id, accounts[5], "0x"]
    );

    var burn2 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes"],
      [
        token2.options.address,
        item2erc1155Id,
        utilities.voidEthereumAddress,
        "0x",
      ]
    );

    var burn3 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes"],
      [zeroDecimals.options.address, item3erc1155Id[0], accounts[5], "0x"]
    );

    console.log(
      await zeroDecimals.methods.totalSupply(item3erc1155Id[0]).call()
    );

    await wrapper.methods
      .burn(accounts[1], itemId3, "800000000000000000", burn3)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var prevSupply1 = await wrapper.methods.totalSupply(itemId1).call();
    await wrapper.methods
      .burn(accounts[1], itemId1, "1000000000000000000", burn)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var prevSupply2 = await wrapper.methods.totalSupply(itemId2).call();

    var amountBurn2 = (
      await wrapper.methods.balanceOf(accounts[1], itemId2).call()
    ).div(3);

    console.log(await wrapper.methods.totalSupply(itemId2).call());

    await wrapper.methods
      .burn(accounts[1], itemId2, amountBurn2, burn2)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    assert.equal(
      await token1.methods.balanceOf(accounts[5], item1erc1155Id).call(),
      "1"
    );

    console.log(await wrapper.methods.totalSupply(itemId2).call());

    assert.equal(
      await token1.methods.balanceOf(accounts[5], item1erc1155Id).call(),
      "1"
    );
    console.log(
      await mainInterface.methods
        .balanceOf(accounts[5], item3erc1155Id[0])
        .call()
    );

    console.log(
      await zeroDecimals.methods
        .balanceOf(accounts[5], item3erc1155Id[0])
        .call()
    );

    console.log(
      await mainInterface.methods
        .balanceOf(wrapper.options.address, item3erc1155Id[0])
        .call()
    );

    console.log(
      await zeroDecimals.methods
        .balanceOf(wrapper.options.address, item3erc1155Id[0])
        .call()
    );

    console.log(
      await zeroDecimals.methods.totalSupply(item3erc1155Id[0]).call()
    );

    // assert.equal(
    //   await mainInterface.methods
    //     .balanceOf(accounts[5], item3erc1155Id[0])
    //     .call(),
    //   "1"
    // );

    assert.equal(
      await token2.methods.balanceOf(accounts[1], item2erc1155Id).call(),
      prevBal.add(amountBurn2)
    );

    assert.equal(
      await wrapper.methods.totalSupply(itemId1).call(),
      prevSupply1.sub("1000000000000000000")
    );
    assert.equal(
      await wrapper.methods.totalSupply(itemId2).call(),
      prevSupply2.sub(amountBurn2)
    );
  });

  it("#672 Unwrap batch using burnBatch", async () => {
    console.log(await wrapper.methods.balanceOf(accounts[3], itemId2).call());
    console.log(await wrapper.methods.balanceOf(accounts[3], itemId4).call());
    console.log(await wrapper.methods.balanceOf(accounts[3], itemId5).call());
    console.log(await wrapper.methods.balanceOf(accounts[3], itemId6).call());
    var prevAmount2 = await wrapper.methods
      .balanceOf(accounts[3], itemId2)
      .call();
    var amounts = [
      prevAmount2,
      "2200000000000000000",
      "2000000000000000000",
      "800000000000000000",
    ];
    var itemId = [itemId2, itemId4, itemId5, itemId6];
    var tokenAddress = [
      item2erc1155Address,
      item4erc1155Address,
      item5erc1155Address,
      zeroDecimals.options.address,
    ];
    var tokenId = [
      item2erc1155Id,
      item4erc1155Id,
      item5erc1155Id,
      item6erc1155Id[0],
    ];
    var receiver = [
      accounts[5],
      accounts[6],
      utilities.voidEthereumAddress,
      utilities.voidEthereumAddress,
    ];
    var receiversCheck = [accounts[5], accounts[6], accounts[9], accounts[9]];
    var tokenContract = [token2, token4, token5, zeroDecimals];

    var burn = [];

    // console.log(tokenAddress);
    // console.log(tokenId);
    // console.log(receiver);
    console.log(amounts);
    // console.log(itemId);

    await Promise.all(
      tokenAddress.map(async (item, index) => {
        burn.push(
          web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes"],
            [tokenAddress[index], tokenId[index], receiver[index], "0x"]
          )
        );
      })
    );

    var datas = web3.eth.abi.encodeParameters(["bytes[]"], [burn]);

    await wrapper.methods
      .safeBatchTransferFrom(accounts[3], accounts[9], itemId, amounts, "0x")
      .send(blockchainConnection.getSendingOptions({ from: accounts[3] }));

    console.log(await wrapper.methods.balanceOf(accounts[9], itemId2).call());
    console.log(await wrapper.methods.balanceOf(accounts[9], itemId4).call());
    console.log(await wrapper.methods.balanceOf(accounts[9], itemId5).call());
    console.log(await wrapper.methods.balanceOf(accounts[9], itemId6).call());

    await catchCall(wrapper.methods
      .burnBatch(accounts[9], itemId, amounts, datas)
      .send(blockchainConnection.getSendingOptions({ from: accounts[9] })), "wrong amount");

    amounts = [
        prevAmount2,
        "2000000000000000000",
        "2000000000000000000",
        "800000000000000000",
    ];

    await wrapper.methods
    .burnBatch(accounts[9], itemId, amounts, datas)
    .send(blockchainConnection.getSendingOptions({ from: accounts[9] }));

    var expectedBalance = [prevAmount2, "2", "2", "1"];
    await Promise.all(
      tokenContract.map(async (contract, index) => {
        assert.equal(
          await contract.methods
            .balanceOf(receiversCheck[index], tokenId[index])
            .call(),
          expectedBalance[index]
        );
      })
    );
  });

  it("#674 scenario 1 Testing some different unwrap and rewrap scenarios with different balances using the Interoperable burn operation", async () => {
    var prevResult2Holder1 = await token2.methods
      .balanceOf(osHolderScenario, item2erc1155Id)
      .call();

    var prevBal5 = await token2.methods
      .balanceOf(accounts[5], item2erc1155Id)
      .call();

    var prevBalItem5 = await wrapper.methods
      .balanceOf(accounts[5], item2erc1155Id)
      .call();

    await approveHost(osHolderScenario);

    await token2.methods
      .safeTransferFrom(
        osHolderScenario,
        accounts[5],
        item2erc1155Id,
        prevResult2Holder1,
        "0x"
      )
      .send(blockchainConnection.getSendingOptions({ from: osHolderScenario }));

    assert.equal(
      await token2.methods.balanceOf(osHolderScenario, item2erc1155Id).call(),
      "0"
    );

    assert.equal(
      await token2.methods.balanceOf(accounts[5], item2erc1155Id).call(),
      prevResult2Holder1.add(prevBal5)
    );

    var encodeMint2 = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[prevResult2Holder1], [accounts[5]]]
    );

    itemId2 = itemId2 = await wrapperResource.mintItems1155(
      token2,
      accounts[5],
      wrapper.options.address,
      item2erc1155Id,
      prevResult2Holder1,
      encodeMint2,
      itemId2
    );

    await wrapper.methods
      .safeTransferFrom(
        accounts[5],
        accounts[4],
        itemId2,
        prevResult2Holder1.div(3),
        "0x"
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[5] }));

    await wrapper.methods
      .safeTransferFrom(
        accounts[5],
        accounts[3],
        itemId2,
        prevResult2Holder1.div(5),
        "0x"
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[5] }));

    assert.equal(
      await wrapper.methods.balanceOf(accounts[4], itemId2).call(),
      prevResult2Holder1.div(3)
    );
    assert.equal(
      await wrapper.methods.balanceOf(accounts[3], itemId2).call(),
      prevResult2Holder1.div(5)
    );

    var burn2 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes"],
      [
        token2.options.address,
        item2erc1155Id,
        utilities.voidEthereumAddress,
        "0x",
      ]
    );

    console.log(await wrapper.methods.totalSupply(itemId2).call());

    await wrapper.methods
      .burn(accounts[4], itemId2, prevResult2Holder1.div(3), burn2)
      .send(blockchainConnection.getSendingOptions({ from: accounts[4] }));

    console.log(await wrapper.methods.totalSupply(itemId2).call());

    await wrapper.methods
      .burn(accounts[3], itemId2, prevResult2Holder1.div(5), burn2)
      .send(blockchainConnection.getSendingOptions({ from: accounts[3] }));

    console.log(await wrapper.methods.totalSupply(itemId2).call());

    assert.equal(
      await wrapper.methods.balanceOf(accounts[4], itemId2).call(),
      "0"
    );
    assert.equal(
      await wrapper.methods.balanceOf(accounts[3], itemId2).call(),
      "0"
    );

    assert.equal(
      await token2.methods.balanceOf(accounts[4], item2erc1155Id).call(),
      prevResult2Holder1.div(3)
    );

    assert.equal(
      await token2.methods.balanceOf(accounts[3], item2erc1155Id).call(),
      prevResult2Holder1.div(5)
    );
  });

  it("#674 scenario 2 Testing some different unwrap and rewrap scenarios with different balances using the Interoperable burn operation", async () => {
    var CreateItem3 = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await zeroDecimals.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[1]],
        amounts: ["1"],
      },
    ];

    var tx = await zeroDecimals.methods
      .mintItems(CreateItem3)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    scenarioItem3erc1155Id = await itemProjection.getItemIdFromLog(tx);

    var encodeMint4 = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[1], [accounts[5]]]
    );

    item3 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[1],
      wrapper.options.address,
      scenarioItem3erc1155Id[0],
      1,
      encodeMint4,
      item3
    );

    console.log(await wrapper.methods.balanceOf(accounts[5], item3).call());

    assert.equal(
      await wrapper.methods.balanceOf(accounts[5], item3).call(),
      "1000000000000000000"
    );
    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[1], scenarioItem3erc1155Id[0])
        .call(),
      "0"
    );
    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[5], scenarioItem3erc1155Id[0])
        .call(),
      "0"
    );

    await wrapper.methods
      .safeTransferFrom(
        accounts[5],
        accounts[4],
        item3,
        "400000000000000000",
        "0x"
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[5] }));

    assert.equal(
      await wrapper.methods.balanceOf(accounts[4], item3).call(),
      "400000000000000000"
    );
    assert.equal(
      await wrapper.methods.balanceOf(accounts[5], item3).call(),
      "600000000000000000"
    );

    var burn3 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes"],
      [
        zeroDecimals.options.address,
        scenarioItem3erc1155Id[0],
        accounts[5],
        "0x",
      ]
    );

    console.log(await wrapper.methods.totalSupply(item3).call());

    await wrapper.methods
      .burn(accounts[5], item3, "600000000000000000", burn3)
      .send(blockchainConnection.getSendingOptions({ from: accounts[5] }));
+
    console.log(await wrapper.methods.totalSupply(item3).call());

    assert.equal(
      await wrapper.methods.balanceOf(accounts[4], item3).call(),
      "400000000000000000"
    );

    assert.equal(
      await wrapper.methods.totalSupply(item3).call(),
      "400000000000000000"
    );

    assert.equal(
      await wrapper.methods.balanceOf(accounts[5], item3).call(),
      "0"
    );

    item3 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[5],
      wrapper.options.address,
      scenarioItem3erc1155Id[0],
      1,
      encodeMint4,
      item3
    );

    console.log(await wrapper.methods.totalSupply(item3).call());

    assert.equal(
      await wrapper.methods.balanceOf(accounts[5], item3).call(),
      "600000000000000000"
    );
  });

  it("#674 scenario 3 Testing some different unwrap and rewrap scenarios with different balances using the Interoperable burn operation", async () => {
    var CreateItem3 = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await zeroDecimals.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[1]],
        amounts: ["1"],
      },
    ];

    var tx = await zeroDecimals.methods
      .mintItems(CreateItem3)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var scenario3Item3erc1155Id = await itemProjection.getItemIdFromLog(tx);

    var encodeMint4 = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[1], [accounts[5]]]
    );

    var item3 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[1],
      wrapper.options.address,
      scenario3Item3erc1155Id[0],
      1,
      encodeMint4,
      item3
    );

    assert.equal(
      await wrapper.methods.balanceOf(accounts[5], item3).call(),
      "1000000000000000000"
    );
    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[1], scenario3Item3erc1155Id[0])
        .call(),
      "0"
    );
    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[5], scenario3Item3erc1155Id[0])
        .call(),
      "0"
    );

    var previousAccount4Bal = await wrapper.methods.balanceOf(accounts[4], item3).call();

    await wrapper.methods
      .safeTransferFrom(
        accounts[5],
        accounts[4],
        item3,
        "500000000000000000",
        "0x"
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[5] }));

    assert.equal(
      await wrapper.methods.balanceOf(accounts[4], item3).call(),
      previousAccount4Bal.add("500000000000000000")
    );
    assert.equal(
      await wrapper.methods.balanceOf(accounts[5], item3).call(),
      "500000000000000000"
    );

    var burn3 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes"],
      [
        zeroDecimals.options.address,
        scenario3Item3erc1155Id[0],
        accounts[5],
        "0x",
      ]
    );

    await catchCall(
      wrapper.methods
        .burn(accounts[5], item3, "500000000000000000", burn3)
        .send(blockchainConnection.getSendingOptions({ from: accounts[5] })),
      "wrong amount"
    );
  });

  it("#674 scenario 4 Testing some different unwrap and rewrap scenarios with different balances using the Interoperable burn operation", async () => {
    var CreateItem3 = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await zeroDecimals.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[1]],
        amounts: ["1"],
      },
    ];

    var tx = await zeroDecimals.methods
      .mintItems(CreateItem3)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var scenarioItem3erc1155Id = await itemProjection.getItemIdFromLog(tx);

    var encodeMint4 = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[1], [accounts[5]]]
    );

    var item3 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[1],
      wrapper.options.address,
      scenarioItem3erc1155Id[0],
      1,
      encodeMint4,
      item3
    );

    var bal4 = await wrapper.methods.balanceOf(accounts[4], item3).call();
    var bal5 = await wrapper.methods.balanceOf(accounts[5], item3).call();
    var bal6 = await wrapper.methods.balanceOf(accounts[6], item3).call();
    var bal7 = await wrapper.methods.balanceOf(accounts[7], item3).call();

    assert.equal(
      await wrapper.methods.balanceOf(accounts[5], item3).call(),
      "1000000000000000000"
    );
    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[1], scenarioItem3erc1155Id[0])
        .call(),
      "0"
    );
    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[5], scenarioItem3erc1155Id[0])
        .call(),
      "0"
    );

    await wrapper.methods
      .safeTransferFrom(
        accounts[5],
        accounts[4],
        item3,
        "100000000000000000",
        "0x"
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[5] }));

    await wrapper.methods
      .safeTransferFrom(
        accounts[5],
        accounts[6],
        item3,
        "190000000000000000",
        "0x"
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[5] }));

    await wrapper.methods
      .safeTransferFrom(
        accounts[5],
        accounts[7],
        item3,
        "200000000000000000",
        "0x"
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[5] }));

    assert.equal(
      await wrapper.methods.balanceOf(accounts[4], item3).call(),
      bal4.add("100000000000000000")
    );
    assert.equal(
      await wrapper.methods.balanceOf(accounts[5], item3).call(),
      bal5.sub("490000000000000000")
    );
    assert.equal(
      await wrapper.methods.balanceOf(accounts[6], item3).call(),
      bal6.add("190000000000000000")
    );
    assert.equal(
      await wrapper.methods.balanceOf(accounts[7], item3).call(),
      bal7.add("200000000000000000")
    );

    var burnCatchCall = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes"],
      [
        zeroDecimals.options.address,
        scenarioItem3erc1155Id[0],
        utilities.voidEthereumAddress,
        "0x",
      ]
    );

    await catchCall(
      wrapper.methods
        .burn(accounts[4], item3, "100000000000000000", burnCatchCall)
        .send(blockchainConnection.getSendingOptions({ from: accounts[4] })),
      "wrong amount"
    );

    await catchCall(
      wrapper.methods
        .burn(accounts[6], item3, "190000000000000000", burnCatchCall)
        .send(blockchainConnection.getSendingOptions({ from: accounts[6] })),
      "wrong amount"
    );

    await catchCall(
      wrapper.methods
        .burn(accounts[7], item3, "200000000000000000", burnCatchCall)
        .send(blockchainConnection.getSendingOptions({ from: accounts[7] })),
      "wrong amount"
    );

    var burn3 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes"],
      [
        zeroDecimals.options.address,
        scenarioItem3erc1155Id[0],
        accounts[5],
        "0x",
      ]
    );

    console.log(await wrapper.methods.totalSupply(item3).call());

    await wrapper.methods
      .burn(accounts[5], item3, "510000000000000000", burn3)
      .send(blockchainConnection.getSendingOptions({ from: accounts[5] }));

    console.log(await wrapper.methods.totalSupply(item3).call());

    item3 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[5],
      wrapper.options.address,
      scenarioItem3erc1155Id[0],
      1,
      encodeMint4,
      item3
    );

    assert.equal(
      await wrapper.methods.balanceOf(accounts[5], item3).call(),
      "510000000000000000"
    );
  });

  it("#674 scenario 5 Testing some different unwrap and rewrap scenarios with different balances using the Interoperable burn operation", async () => {
    var CreateItem7 = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await zeroDecimals.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[5]],
        amounts: ["1"],
      },
    ];

    var tx = await zeroDecimals.methods
      .mintItems(CreateItem7)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var scenarioItem7erc1155Id = await itemProjection.getItemIdFromLog(tx);

    var encodeMint = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[1], [accounts[5]]]
    );

    itemId7 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[5],
      wrapper.options.address,
      scenarioItem7erc1155Id[0],
      1,
      encodeMint,
      itemId7
    );

    assert.equal(
      await wrapper.methods.balanceOf(accounts[5], itemId7).call(),
      "1000000000000000000"
    );

    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[5], scenarioItem7erc1155Id[0])
        .call(),
      "0"
    );

    await wrapper.methods
      .safeTransferFrom(
        accounts[5],
        accounts[4],
        itemId7,
        "400000000000000000",
        "0x"
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[5] }));

    assert.equal(
      await wrapper.methods.balanceOf(accounts[4], itemId7).call(),
      "400000000000000000"
    );
    assert.equal(
      await wrapper.methods.balanceOf(accounts[5], itemId7).call(),
      "600000000000000000"
    );

    var burnCatchCall = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes"],
      [
        zeroDecimals.options.address,
        scenarioItem7erc1155Id[0],
        utilities.voidEthereumAddress,
        "0x",
      ]
    );

    await catchCall(
      wrapper.methods
        .burn(accounts[4], itemId7, "400000000000000000", burnCatchCall)
        .send(blockchainConnection.getSendingOptions({ from: accounts[4] })),
      "wrong amount"
    );

    var burn7 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes"],
      [
        zeroDecimals.options.address,
        scenarioItem7erc1155Id[0],
        accounts[5],
        "0x",
      ]
    );

    console.log(await wrapper.methods.totalSupply(itemId7).call());

    await wrapper.methods
      .burn(accounts[5], itemId7, "600000000000000000", burn7)
      .send(blockchainConnection.getSendingOptions({ from: accounts[5] }));

    console.log(await wrapper.methods.totalSupply(itemId7).call());

    itemId7 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[5],
      wrapper.options.address,
      scenarioItem7erc1155Id[0],
      1,
      encodeMint,
      itemId7
    );

    assert.equal(
      await wrapper.methods.balanceOf(accounts[5], itemId7).call(),
      "600000000000000000"
    );

    await catchCall(wrapper.methods
      .burn(accounts[4], itemId7, "400000000000000000", burn7)
      .send(blockchainConnection.getSendingOptions({ from: accounts[5] })), "wrong amount");
  });

  it("#674 scenario 6 Testing some different unwrap and rewrap scenarios with different balances using the Interoperable burn operation", async () => {
    var CreateItem7 = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await zeroDecimals.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[5]],
        amounts: ["2"],
      },
    ];

    var tx = await zeroDecimals.methods
      .mintItems(CreateItem7)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var scenarioItem7erc1155Id = await itemProjection.getItemIdFromLog(tx);

    var encodeMint = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[2], [utilities.voidEthereumAddress]]
    );

    var itemId7 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[5],
      wrapper.options.address,
      scenarioItem7erc1155Id[0],
      2,
      encodeMint,
      itemId7
    );

    assert.equal(
      await wrapper.methods.balanceOf(accounts[5], itemId7).call(),
      "2000000000000000000"
    );

    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[5], scenarioItem7erc1155Id[0])
        .call(),
      "0"
    );

    await wrapper.methods
      .safeTransferFrom(
        accounts[5],
        accounts[4],
        itemId7,
        "400000000000000000",
        "0x"
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[5] }));

    assert.equal(
      await wrapper.methods.balanceOf(accounts[4], itemId7).call(),
      "400000000000000000"
    );
    assert.equal(
      await wrapper.methods.balanceOf(accounts[5], itemId7).call(),
      "1600000000000000000"
    );

    var CreateItem7 = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await zeroDecimals.methods.collectionId().call(),
        id: scenarioItem7erc1155Id[0],
        accounts: [accounts[4]],
        amounts: ["1"],
      },
    ];

    var tx = await zeroDecimals.methods
      .mintItems(CreateItem7)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var encodeMint = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[1], [accounts[4]]]
    );

    itemId7 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[4],
      wrapper.options.address,
      scenarioItem7erc1155Id[0],
      1,
      encodeMint,
      itemId7
    );

    assert.equal(
      await wrapper.methods.balanceOf(accounts[4], itemId7).call(),
      "1400000000000000000"
    );

    console.log(await wrapper.methods.totalSupply(itemId7).call());
    var burn7 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes"],
      [
        zeroDecimals.options.address,
        scenarioItem7erc1155Id[0],
        utilities.voidEthereumAddress,
        "0x",
      ]
    );

    await catchCall(wrapper.methods
      .burn(accounts[5], itemId7, "600000000000000000", burn7)
      .send(blockchainConnection.getSendingOptions({ from: accounts[5] })), "wrong amount");

    await wrapper.methods
      .burn(accounts[5], itemId7, "1000000000000000000", burn7)
      .send(blockchainConnection.getSendingOptions({ from: accounts[5] }));

    console.log(await wrapper.methods.totalSupply(itemId7).call());

    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[5], scenarioItem7erc1155Id[0])
        .call(),
      "1"
    );

    itemId7 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[5],
      wrapper.options.address,
      scenarioItem7erc1155Id[0],
      1,
      encodeMint,
      itemId7
    );

    assert.equal(
      await wrapper.methods.balanceOf(accounts[5], itemId7).call(),
      "600000000000000000"
    );

    console.log(await wrapper.methods.totalSupply(itemId7).call());

    await catchCall(wrapper.methods
      .burn(accounts[4], itemId7, "1400000000000000000", burn7)
      .send(blockchainConnection.getSendingOptions({ from: accounts[4] })), "wrong amount");

    await wrapper.methods
      .burn(accounts[4], itemId7, "1000000000000000000", burn7)
      .send(blockchainConnection.getSendingOptions({ from: accounts[4] }));

    console.log(await wrapper.methods.totalSupply(itemId7).call());

    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[4], scenarioItem7erc1155Id[0])
        .call(),
      "1"
    );
    assert.equal(
      await wrapper.methods.balanceOf(accounts[4], itemId7).call(),
      "1400000000000000000"
    );

    var encodeMint = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[1], [accounts[4]]]
    );

    itemId7 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[4],
      wrapper.options.address,
      scenarioItem7erc1155Id[0],
      1,
      encodeMint,
      itemId7
    );

    assert.equal(
      await wrapper.methods.balanceOf(accounts[4], itemId7).call(),
      "2400000000000000000"
    );
  });

  it("#674 scenario 7 Testing some different unwrap and rewrap scenarios with different balances using the Interoperable burn operation", async () => {
    var CreateItem7 = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await zeroDecimals.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[5]],
        amounts: ["6"],
      },
    ];

    var tx = await zeroDecimals.methods
      .mintItems(CreateItem7)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var scenarioItem7erc1155Id = await itemProjection.getItemIdFromLog(tx);

    var encodeMint = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[6], [accounts[5]]]
    );

    var itemId7 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[5],
      wrapper.options.address,
      scenarioItem7erc1155Id[0],
      6,
      encodeMint,
      itemId7
    );

    assert.equal(
      await wrapper.methods.balanceOf(accounts[5], itemId7).call(),
      "6000000000000000000"
    );

    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[5], scenarioItem7erc1155Id[0])
        .call(),
      "0"
    );

    await wrapper.methods
      .safeTransferFrom(
        accounts[5],
        accounts[4],
        itemId7,
        "3500000000000000000",
        "0x"
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[5] }));

    assert.equal(
      await wrapper.methods.balanceOf(accounts[4], itemId7).call(),
      "3500000000000000000"
    );
    assert.equal(
      await wrapper.methods.balanceOf(accounts[5], itemId7).call(),
      "2500000000000000000"
    );

    var burn7 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes"],
      [
        zeroDecimals.options.address,
        scenarioItem7erc1155Id[0],
        utilities.voidEthereumAddress,
        "0x",
      ]
    );

    console.log(await wrapper.methods.totalSupply(itemId7).call());

    await catchCall(wrapper.methods
      .burn(accounts[5], itemId7, "2500000000000000000", burn7)
      .send(blockchainConnection.getSendingOptions({ from: accounts[5] })), "wrong amount");

    await catchCall(wrapper.methods
      .burn(accounts[4], itemId7, "3500000000000000000", burn7)
      .send(blockchainConnection.getSendingOptions({ from: accounts[4] })), "wrong amount");

    await wrapper.methods
      .burn(accounts[5], itemId7, "2000000000000000000", burn7)
      .send(blockchainConnection.getSendingOptions({ from: accounts[5] }));

    console.log(await wrapper.methods.totalSupply(itemId7).call());

    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[5], scenarioItem7erc1155Id[0])
        .call(),
      "2"
    );

    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[5], scenarioItem7erc1155Id[0])
        .call(),
      "2"
    );
    assert.equal(
      await wrapper.methods.balanceOf(accounts[5], itemId7).call(),
      "500000000000000000"
    );

    var encodeMint = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[2], [accounts[5]]]
    );

    var encodeMint1 = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[3], [accounts[4]]]
    );

    itemId7 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[5],
      wrapper.options.address,
      scenarioItem7erc1155Id[0],
      2,
      encodeMint,
      itemId7
    );

    console.log(await wrapper.methods.balanceOf(accounts[5], itemId7).call());

    assert.equal(
      await wrapper.methods.balanceOf(accounts[5], itemId7).call(),
      "2500000000000000000"
    );
  });

  it("#674 scenario 2 interoperable", async () => {
    var CreateItem3 = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await zeroDecimals.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[1]],
        amounts: ["1"],
      },
    ];

    var tx = await zeroDecimals.methods
      .mintItems(CreateItem3)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var scenarioItem3erc1155Id = await itemProjection.getItemIdFromLog(tx);

    var encodeMint4 = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[1], [accounts[5]]]
    );

    var item3 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[1],
      wrapper.options.address,
      scenarioItem3erc1155Id[0],
      1,
      encodeMint4,
      item3
    );

    var erc20Contract = await asInteroperableInterface(item3);

    console.log(await wrapper.methods.balanceOf(accounts[5], item3).call());

    assert.equal(
      await wrapper.methods.balanceOf(accounts[5], item3).call(),
      "1000000000000000000"
    );
    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[1], scenarioItem3erc1155Id[0])
        .call(),
      "0"
    );
    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[5], scenarioItem3erc1155Id[0])
        .call(),
      "0"
    );

    await erc20Contract.methods
      .transferFrom(accounts[5], accounts[4], "400000000000000000")
      .send(blockchainConnection.getSendingOptions({ from: accounts[5] }));

    assert.equal(
      await wrapper.methods.balanceOf(accounts[5], item3).call(),
      "600000000000000000"
    );

    var burn3 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes"],
      [
        zeroDecimals.options.address,
        scenarioItem3erc1155Id[0],
        accounts[5],
        "0x",
      ]
    );

    console.log(await wrapper.methods.totalSupply(item3).call());

    await wrapper.methods
      .burn(accounts[5], item3, "600000000000000000", burn3)
      .send(blockchainConnection.getSendingOptions({ from: accounts[5] }));

    console.log(await wrapper.methods.totalSupply(item3).call());

    assert.equal(
      await wrapper.methods.balanceOf(accounts[5], item3).call(),
      "0"
    );

    item3 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[5],
      wrapper.options.address,
      scenarioItem3erc1155Id[0],
      1,
      encodeMint4,
      item3
    );

    console.log(await wrapper.methods.totalSupply(item3).call());

    assert.equal(
      await wrapper.methods.balanceOf(accounts[5], item3).call(),
      "600000000000000000"
    );
  });

  it("#674 scenario 3 interoperable", async () => {
    var CreateItem3 = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await zeroDecimals.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[1]],
        amounts: ["1"],
      },
    ];

    var tx = await zeroDecimals.methods
      .mintItems(CreateItem3)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var scenarioItem3erc1155Id = await itemProjection.getItemIdFromLog(tx);

    var encodeMint4 = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[1], [accounts[5]]]
    );

    var item3 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[1],
      wrapper.options.address,
      scenarioItem3erc1155Id[0],
      1,
      encodeMint4,
      item3
    );

    var erc20Contract = await asInteroperableInterface(item3);

    assert.equal(
      await wrapper.methods.balanceOf(accounts[5], item3).call(),
      "1000000000000000000"
    );
    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[1], scenarioItem3erc1155Id[0])
        .call(),
      "0"
    );
    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[5], scenarioItem3erc1155Id[0])
        .call(),
      "0"
    );

    await erc20Contract.methods
      .transferFrom(accounts[5], accounts[4], "500000000000000000")
      .send(blockchainConnection.getSendingOptions({ from: accounts[5] }));

    assert.equal(
      await wrapper.methods.balanceOf(accounts[4], item3).call(),
      "500000000000000000"
    );
    assert.equal(
      await wrapper.methods.balanceOf(accounts[5], item3).call(),
      "500000000000000000"
    );

    var burn3 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes"],
      [
        zeroDecimals.options.address,
        scenarioItem3erc1155Id[0],
        accounts[5],
        "0x",
      ]
    );

    await catchCall(
      wrapper.methods
        .burn(accounts[5], item3, "500000000000000000", burn3)
        .send(blockchainConnection.getSendingOptions({ from: accounts[5] })),
      "Insufficient balance"
    );
  });

  it("#674 scenario 7 interoperable", async () => {
    var CreateItem7 = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await zeroDecimals.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[5]],
        amounts: ["3"],
      },
    ];

    var tx = await zeroDecimals.methods
      .mintItems(CreateItem7)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var scenarioItem7erc1155Id = await itemProjection.getItemIdFromLog(tx);

    var encodeMint = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[3], [accounts[5]]]
    );

    var itemId7 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[5],
      wrapper.options.address,
      scenarioItem7erc1155Id[0],
      3,
      encodeMint,
      itemId7
    );

    assert.equal(
      await wrapper.methods.balanceOf(accounts[5], itemId7).call(),
      "3000000000000000000"
    );

    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[5], scenarioItem7erc1155Id[0])
        .call(),
      "0"
    );

    var erc20Contract = await asInteroperableInterface(itemId7);

    var amountToBurn = (
      await wrapper.methods.balanceOf(accounts[5], itemId7).call()
    )
      .mul(40)
      .div(100);
    var amount5 = (await wrapper.methods.balanceOf(accounts[5], itemId7).call())
      .mul(60)
      .div(100);

    await erc20Contract.methods.burn(amountToBurn).send(
      blockchainConnection.getSendingOptions({
        from: accounts[5],
      })
    );

    assert.equal(
      await wrapper.methods.balanceOf(accounts[5], itemId7).call(),
      amount5
    );

    var burn7 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes"],
      [
        zeroDecimals.options.address,
        scenarioItem7erc1155Id[0],
        utilities.voidEthereumAddress,
        "0x",
      ]
    );

    console.log(await wrapper.methods.totalSupply(itemId7).call());

    await wrapper.methods
      .burn(accounts[5], itemId7, amount5, burn7)
      .send(blockchainConnection.getSendingOptions({ from: accounts[5] }));

    console.log(await wrapper.methods.totalSupply(itemId7).call());

    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[5], scenarioItem7erc1155Id[0])
        .call(),
      "2"
    );
    assert.equal(
      await wrapper.methods.balanceOf(accounts[5], itemId7).call(),
      "0"
    );

    itemId7 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[5],
      wrapper.options.address,
      scenarioItem7erc1155Id[0],
      2,
      encodeMint,
      itemId7
    );

    console.log(await wrapper.methods.totalSupply(itemId7).call());

    assert.equal(
      await wrapper.methods.balanceOf(accounts[5], itemId7).call(),
      amount5
    );
  });

  it("#674 scenario 7/2 interoperable", async () => {
    var CreateItem7 = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await zeroDecimals.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[5]],
        amounts: ["3"],
      },
    ];

    var tx = await zeroDecimals.methods
      .mintItems(CreateItem7)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var scenarioItem7erc1155Id = await itemProjection.getItemIdFromLog(tx);

    var encodeMint = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[3], [accounts[5]]]
    );

    var itemId7 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[5],
      wrapper.options.address,
      scenarioItem7erc1155Id[0],
      3,
      encodeMint,
      itemId7
    );

    assert.equal(
      await wrapper.methods.balanceOf(accounts[5], itemId7).call(),
      "3000000000000000000"
    );

    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[5], scenarioItem7erc1155Id[0])
        .call(),
      "0"
    );

    var erc20Contract = await asInteroperableInterface(itemId7);

    var amountToTransfer = (
      await wrapper.methods.balanceOf(accounts[5], itemId7).call()
    )
      .mul(60)
      .div(100);
    var amount5 = (await wrapper.methods.balanceOf(accounts[5], itemId7).call())
      .mul(40)
      .div(100);

    await erc20Contract.methods
      .transferFrom(accounts[5], accounts[4], amountToTransfer)
      .send(blockchainConnection.getSendingOptions({ from: accounts[5] }));

    assert.equal(
      await wrapper.methods.balanceOf(accounts[4], itemId7).call(),
      amountToTransfer
    );
    assert.equal(
      await wrapper.methods.balanceOf(accounts[5], itemId7).call(),
      amount5
    );

    var burn7 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes"],
      [
        zeroDecimals.options.address,
        scenarioItem7erc1155Id[0],
        utilities.voidEthereumAddress,
        "0x",
      ]
    );

    console.log(await wrapper.methods.totalSupply(itemId7).call());

    await wrapper.methods
      .burn(accounts[5], itemId7, amount5, burn7)
      .send(blockchainConnection.getSendingOptions({ from: accounts[5] }));

    console.log(await wrapper.methods.totalSupply(itemId7).call());

    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[5], scenarioItem7erc1155Id[0])
        .call(),
      "1"
    );
    assert.equal(
      await wrapper.methods.balanceOf(accounts[5], itemId7).call(),
      "0"
    );
  });
});