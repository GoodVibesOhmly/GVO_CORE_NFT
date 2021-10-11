var utilities = require("../util/utilities");
var itemsv2 = require("../resources/itemsv2");
var itemProjection = require("../resources/itemProjection");
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
  
      await wrapper.methods
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
        // await blockchainConnection.unlockAccounts(tokenHolder);
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


    console.log(await token1.methods.balanceOf(accounts[1], item1erc1155Id).call())

      var encodeMint1 = web3.eth.abi.encodeParameters(
        ["uint256[]", "address[]"],
        [
          ["1", "0.6", "0.4"],
          [accounts[1], accounts[2], accounts[4]]
        ]
      );


    await catchCall(token1.methods
      .safeTransferFrom(accounts[1], wrapper.options.address, item1erc1155Id, 1, wrongEncodeMint)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] })), "ERC1155: transfer to non ERC1155Receiver implementer");

    await token1.methods
      .safeTransferFrom(accounts[1], wrapper.options.address, item1erc1155Id, "2", encodeMint1)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));












    // var prevWrapperAmount = await mainToken.methods
    //   .balanceOf(wrapper.options.address)
    //   .call();

    // var tx = await mainToken.methods
    //   .safeTransferFrom(accounts[1], wrapper.options.address, token721Id)
    //   .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    // assert.equal(
    //   await mainToken.methods.balanceOf(wrapper.options.address).call(),
    //   prevWrapperAmount.add(1)
    // );
    // assert.equal(await mainToken.methods.balanceOf(accounts[1]).call(), "0");

    // var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash)).logs;
    // var tokenId = web3.eth.abi.decodeParameter(
    //   "uint256",
    //   logs.filter(
    //     (it) =>
    //       it.topics[0] === web3.utils.sha3("Token(address,uint256,uint256)")
    //   )[0].topics[3]
    // );

    // itemsList.push({
    //   tokenName: "ens",
    //   tokenAddress: knowledgeBase.ensTokenAddress,
    //   account: accounts[1],
    //   tokenId: token721Id,
    //   itemId: tokenId,
    // });

    // console.log("ens");
    // console.log(await mainInterface.methods.item(tokenId).call());

    // assert.equal(
    //   await wrapper.methods.balanceOf(accounts[1], tokenId).call(),
    //   "1000000000000000000"
    // );
    // assert.equal(await wrapper.methods.decimals(tokenId).call(), "18");

    // var mainToken1 = new web3.eth.Contract(
    //   knowledgeBase.IERC721ABI,
    //   knowledgeBase.uniV3PositionTokenAddress
    // );
    // var prevResult1 = await mainToken1.methods.balanceOf(tokenHolder).call();

    // await mainToken1.methods
    //   .safeTransferFrom(tokenHolder, accounts[1], token721Id1)
    //   .send(blockchainConnection.getSendingOptions({ from: tokenHolder }));

    // assert.equal(
    //   await mainToken1.methods.balanceOf(tokenHolder).call(),
    //   prevResult1.sub(1)
    // );
    // assert.equal(await mainToken1.methods.balanceOf(accounts[1]).call(), "1");

    // var prevWrapperAmount1 = await mainToken1.methods
    //   .balanceOf(wrapper.options.address)
    //   .call();

    //   var data = web3.eth.abi.encodeParameters(
    //     ["address"],
    //     [accounts[2]]
    //   );
    // var tx1 = await mainToken1.methods
    //   .safeTransferFrom(accounts[1], wrapper.options.address, token721Id1, data)
    //   .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    // assert.equal(
    //   await mainToken1.methods.balanceOf(wrapper.options.address).call(),
    //   prevWrapperAmount1.add(1)
    // );
    // assert.equal(await mainToken1.methods.balanceOf(accounts[1]).call(), "0");

    // var logs = (await web3.eth.getTransactionReceipt(tx1.transactionHash)).logs;
    // var tokenId = web3.eth.abi.decodeParameter(
    //   "uint256",
    //   logs.filter(
    //     (it) =>
    //       it.topics[0] === web3.utils.sha3("Token(address,uint256,uint256)")
    //   )[0].topics[3]
    // );

    // itemsList.push({
    //   tokenName: "uniV3Position",
    //   tokenAddress: knowledgeBase.uniV3PositionTokenAddress,
    //   account: accounts[2],
    //   tokenId: token721Id1,
    //   itemId: tokenId,
    // });

    // console.log("univ3");
    // console.log(await mainInterface.methods.item(tokenId).call());

    // assert.equal(
    //   await wrapper.methods.balanceOf(accounts[2], tokenId).call(),
    //   "1000000000000000000"
    // );
    // assert.equal(await wrapper.methods.decimals(tokenId).call(), "18");
    });
})