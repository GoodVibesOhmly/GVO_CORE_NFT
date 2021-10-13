var utilities = require("../util/utilities");
var itemsv2 = require("../resources/itemsv2");
var itemProjection = require("../resources/itemProjection");
var wrapperResource = require("../resources/wrapper");
const blockchainConnection = require("../util/blockchainConnection");
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
    var item1Holder1 = "0x072300626D4325197c65FAc4b0a19062d88A48E2";
    var item1Holder2 = "0x459C2029F74E89bA6D02688BC338580D89C7f84B";
    var item2Holder1 = "0x942eE44ef3A64e21Ce55EE8513B698e7058722F9";
    var item4Holder1 = "0x4897d38b0974051d8fa34364e37a5993f4a966a5";
    var item4Holder2 = "0xbad2e817Af781B6F1573d65409ddEF24d9656f8b";
    var item5Holder1 = "0xfb4c65f1dd92ae419f8d52e0ed3d94775476b900";
    var token1;
    var token2;
    var token4;
    var token5;
    var itemId1;
    var itemId2;
    var itemId3;
    var itemId4;
    
    var itemsList = [];
    var approvedHost = [];
  
    async function approveHost(holder) {
      if(!approvedHost.includes(holder)){
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
        }
      ];

      console.log("collection")
      console.log(await zeroDecimals.methods.collectionId().call())

      var tx = await zeroDecimals.methods.mintItems(CreateItem3)
        .send(blockchainConnection.getSendingOptions({ from: accounts[1] }))

      item3erc1155Id = await itemProjection.getItemIdFromLog(tx);
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

    var prevResult1Holder1 = await token1.methods.balanceOf(item1Holder1, item1erc1155Id).call();
    var prevResult1Holder2 = await token1.methods.balanceOf(item1Holder2, item1erc1155Id).call();
    var prevResult2Holder1 = await token2.methods.balanceOf(item2Holder1, item2erc1155Id).call();
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
      .safeTransferFrom(item2Holder1, accounts[1], item2erc1155Id, prevResult2Holder1, "0x")
      .send(blockchainConnection.getSendingOptions({ from: item2Holder1 }));

    assert.equal(
      await token1.methods.balanceOf(item1Holder1, item1erc1155Id).call(),
      prevResult1Holder1.sub(1)
    );
    assert.equal(
        await token1.methods.balanceOf(item1Holder2, item1erc1155Id).call(),
        prevResult1Holder2.sub(1)
      );
    assert.equal(
        await token2.methods.balanceOf(item2Holder1, item2erc1155Id).call(),
        "0"
      );
    assert.equal(await token1.methods.balanceOf(accounts[1], item1erc1155Id).call(), "2");
    assert.equal(await token2.methods.balanceOf(accounts[1], item2erc1155Id).call(), prevResult2Holder1);

    var wrongEncodeMint = web3.eth.abi.encodeParameters(
        ["uint256", "address"],
        [
          1,
          accounts[2]
        ]
      );

      var encodeMint1 = web3.eth.abi.encodeParameters(
        ["uint256[]", "address[]"],
        [
          ["2"],
          [accounts[1]]
        ]
      );

      var encodeMint2 = web3.eth.abi.encodeParameters(
        ["uint256[]", "address[]"],
        [
          [prevResult2Holder1.div(10).mul(1), prevResult2Holder1.div(10).mul(2), prevResult2Holder1.div(10).mul(1)],
          [accounts[1], accounts[2], accounts[5]]
        ]
      );

      var encodeMint3 = web3.eth.abi.encodeParameters(
        ["uint256[]", "address[]"],
        [
          [prevResult2Holder1.div(10).mul(3), prevResult2Holder1.div(10).mul(1), prevResult2Holder1.div(10).mul(2)],
          [accounts[1], accounts[2], accounts[6]]
        ]
      );

      var encodeMint4 = web3.eth.abi.encodeParameters(
        ["uint256[]", "address[]"],
        [
          [1],
          [accounts[1]]
        ]
      );

    await catchCall(token1.methods
      .safeTransferFrom(accounts[1], wrapper.options.address, item1erc1155Id, 1, wrongEncodeMint)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] })), "ERC1155: transfer to non ERC1155Receiver implementer");

    assert.equal(await zeroDecimals.methods.decimals(item3erc1155Id[0]).call(), '0')
    assert.equal(await mainInterface.methods.balanceOf(accounts[1], item3erc1155Id[0]).call(), '1')
    assert.equal(await token1.methods.balanceOf(accounts[1], item1erc1155Id).call(), '2');


    itemId1 =  await wrapperResource.mintItems1155(token1, accounts[1], wrapper.options.address, item1erc1155Id, 2, encodeMint1);
    itemId2 =  await wrapperResource.mintItems1155(token2, accounts[1], wrapper.options.address, item2erc1155Id, prevResult2Holder1.div(10).mul(1).add(prevResult2Holder1.div(10).mul(2)).add(prevResult2Holder1.div(10).mul(1)), encodeMint2);
    await wrapperResource.mintItems1155(token2, accounts[1], wrapper.options.address, item2erc1155Id, prevResult2Holder1.div(10).mul(3).add(prevResult2Holder1.div(10).mul(1)).add(prevResult2Holder1.div(10).mul(2)), encodeMint3, false);
    itemId3 =  await wrapperResource.mintItems1155(mainInterface, accounts[1], wrapper.options.address, item3erc1155Id[0], 1, encodeMint4);
    assert.equal(await token1.methods.balanceOf(wrapper.options.address, item1erc1155Id).call(), '2')
    assert.equal(await wrapper.methods.balanceOf(accounts[1], itemId1).call(), "2000000000000000000")
    assert.equal(await wrapper.methods.balanceOf(accounts[1], itemId3).call(), "1000000000000000000")

    await wrapper.methods.safeTransferFrom(accounts[1], accounts[2], itemId1, "600000000000000000", "0x").send(blockchainConnection.getSendingOptions({from: accounts[1]}))
    await wrapper.methods.safeTransferFrom(accounts[1], accounts[4], itemId1, "400000000000000000", "0x").send(blockchainConnection.getSendingOptions({from: accounts[1]}))
    await wrapper.methods.safeTransferFrom(accounts[1], accounts[2], itemId3, "200000000000000000", "0x").send(blockchainConnection.getSendingOptions({from: accounts[1]}))
    // await wrapper.methods.safeBatchTransferFrom(accounts[1], accounts[2], [itemId1, itemId3], ["600000000000000000", "200000000000000000"], "0x").send(blockchainConnection.getSendingOptions({from: accounts[1]}))
    // await wrapper.methods.safeBatchTransferFrom(accounts[3], accounts[4], [itemId1], ["400000000000000000"], "0x").send(blockchainConnection.getSendingOptions({from: accounts[3]}))

    assert.equal(await wrapper.methods.balanceOf(accounts[1], itemId1).call(), "1000000000000000000")
    assert.equal(await wrapper.methods.balanceOf(accounts[2], itemId1).call(), "600000000000000000")
    assert.equal(await wrapper.methods.balanceOf(accounts[4], itemId1).call(), "400000000000000000")

    assert.equal(await wrapper.methods.balanceOf(accounts[1], itemId2).call(), prevResult2Holder1.div(10).mul(1))
    assert.equal(await wrapper.methods.balanceOf(accounts[2], itemId2).call(), prevResult2Holder1.div(10).mul(2))
    assert.equal(await wrapper.methods.balanceOf(accounts[5], itemId2).call(), prevResult2Holder1.div(10).mul(1))

    assert.equal(await wrapper.methods.balanceOf(accounts[1], itemId2).call(), prevResult2Holder1.div(10).mul(3))
    assert.equal(await wrapper.methods.balanceOf(accounts[2], itemId2).call(), prevResult2Holder1.div(10).mul(1))
    assert.equal(await wrapper.methods.balanceOf(accounts[6], itemId2).call(), prevResult2Holder1.div(10).mul(2))

    assert.equal(await wrapper.methods.totalSupply(itemId1).call(), "2000000000000000000")
    assert.equal(await wrapper.methods.totalSupply(itemId2).call(), prevResult2Holder1)
    assert.equal(await wrapper.methods.totalSupply(itemId3).call(), "1000000000000000000")
    });

  it("#671 Unwrap single using Burn", async () => {
    var burn = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes"],
      [token1.options.address, item1erc1155Id, accounts[5], "0x"]
    );

    console.log(await wrapper.methods.balanceOf(accounts[1], itemId1).call())
    console.log(itemId1)
    // approve contratto
    await wrapper.methods
    .burn(accounts[1], itemId1, "1000000000000000000", burn)
    .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
  })
})
