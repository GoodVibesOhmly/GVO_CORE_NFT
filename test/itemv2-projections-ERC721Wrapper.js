var utilities = require("../util/utilities");
var itemsv2 = require("../resources/itemsv2");
var itemProjection = require("../resources/itemProjection");
const blockchainConnection = require("../util/blockchainConnection");
var wrapperResource = require("../resources/wrapper");
describe("itemv2 projections ERC721Wrapper", () => {
  var tokenHolder = "0xcfB586d08633fC36953be8083B63a7d96D50265B";
  var wrapper;
  var MainInterface;
  var mainInterface;
  var ItemInteroperableInterface;
  var itemInteroperableInterface;
  var itemInteroperableInterfaceAddress;
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

    var ERC721Wrapper = await compile("projection/ERC721/ERC721Wrapper");
    wrapper = await new web3.eth.Contract(ERC721Wrapper.abi)
      .deploy({ data: ERC721Wrapper.bin, arguments: ["0x"] })
      .send(blockchainConnection.getSendingOptions());

    await wrapper.methods
      .lazyInit(deployParam)
      .send(blockchainConnection.getSendingOptions());

    MainInterface = await compile("model/IItemMainInterface");
    mainInterface = new web3.eth.Contract(
      MainInterface.abi,
      knowledgeBase.mainInterfaceAddress
    );
  });

  it("#651 Wrap using onERC721Received", async () => {
    /**
     * Authorized subjects:
     * Item holders
     * approved operator address
     * Functions used in the test:
     * onERC721Received
     * Items used: Item1, Item2. ENS, Univ3
     *
     * Wrap a 721 using the safeTransferFrom (onERC721Received).
     * Wrap a 721 using the safeTransferFrom (onERC721Received) passing an address receiver different from msg.sender.
     */
    var token721Id =
      "76209759912004573400534475157126407931116638124477574818832130517944945631566";
    var token721Id1 = "62388";
    var mainToken = new web3.eth.Contract(
      knowledgeBase.IERC721ABI,
      knowledgeBase.ensTokenAddress
    );
    var prevResult = await mainToken.methods.balanceOf(tokenHolder).call();
    await blockchainConnection.unlockAccounts(tokenHolder);

    await mainToken.methods
      .safeTransferFrom(tokenHolder, accounts[1], token721Id)
      .send(blockchainConnection.getSendingOptions({ from: tokenHolder }));

    assert.equal(
      await mainToken.methods.balanceOf(tokenHolder).call(),
      prevResult.sub(1)
    );
    assert.equal(await mainToken.methods.balanceOf(accounts[1]).call(), "1");

    var prevWrapperAmount = await mainToken.methods
      .balanceOf(wrapper.options.address)
      .call();

    var tx = await mainToken.methods
      .safeTransferFrom(accounts[1], wrapper.options.address, token721Id)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    assert.equal(
      await mainToken.methods.balanceOf(wrapper.options.address).call(),
      prevWrapperAmount.add(1)
    );
    assert.equal(await mainToken.methods.balanceOf(accounts[1]).call(), "0");

    var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash)).logs;
    var tokenId = web3.eth.abi.decodeParameter(
      "uint256",
      logs.filter(
        (it) =>
          it.topics[0] === web3.utils.sha3("Token(address,uint256,uint256)")
      )[0].topics[3]
    );

    itemsList.push({
      tokenName: "ens",
      tokenAddress: knowledgeBase.ensTokenAddress,
      account: accounts[1],
      tokenId: token721Id,
      itemId: tokenId,
    });

    console.log("ens");
    console.log(await mainInterface.methods.item(tokenId).call());

    assert.equal(
      await wrapper.methods.balanceOf(accounts[1], tokenId).call(),
      "1000000000000000000"
    );
    assert.equal(await wrapper.methods.decimals(tokenId).call(), "18");

    var mainToken1 = new web3.eth.Contract(
      knowledgeBase.IERC721ABI,
      knowledgeBase.uniV3PositionTokenAddress
    );
    var prevResult1 = await mainToken1.methods.balanceOf(tokenHolder).call();

    await mainToken1.methods
      .safeTransferFrom(tokenHolder, accounts[1], token721Id1)
      .send(blockchainConnection.getSendingOptions({ from: tokenHolder }));

    assert.equal(
      await mainToken1.methods.balanceOf(tokenHolder).call(),
      prevResult1.sub(1)
    );
    assert.equal(await mainToken1.methods.balanceOf(accounts[1]).call(), "1");

    var prevWrapperAmount1 = await mainToken1.methods
      .balanceOf(wrapper.options.address)
      .call();

      var data = web3.eth.abi.encodeParameters(
        ["address"],
        [accounts[2]]
      );
    var tx1 = await mainToken1.methods
      .safeTransferFrom(accounts[1], wrapper.options.address, token721Id1, data)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    assert.equal(
      await mainToken1.methods.balanceOf(wrapper.options.address).call(),
      prevWrapperAmount1.add(1)
    );
    assert.equal(await mainToken1.methods.balanceOf(accounts[1]).call(), "0");

    var logs = (await web3.eth.getTransactionReceipt(tx1.transactionHash)).logs;
    var tokenId = web3.eth.abi.decodeParameter(
      "uint256",
      logs.filter(
        (it) =>
          it.topics[0] === web3.utils.sha3("Token(address,uint256,uint256)")
      )[0].topics[3]
    );

    itemsList.push({
      tokenName: "uniV3Position",
      tokenAddress: knowledgeBase.uniV3PositionTokenAddress,
      account: accounts[2],
      tokenId: token721Id1,
      itemId: tokenId,
    });

    console.log("univ3");
    console.log(await mainInterface.methods.item(tokenId).call());

    assert.equal(
      await wrapper.methods.balanceOf(accounts[2], tokenId).call(),
      "1000000000000000000"
    );
    assert.equal(await wrapper.methods.decimals(tokenId).call(), "18");
  });

  it("#652 Wrap using mint function", async () => {
    /**
     * Authorized subjects:
     * Item holders
     * approved operator address
     * Functions used in the test:
     * mint (address[] calldata tokenAddresses, uint256[] calldata tokenIds, address[] calldata receivers)
     * Items used: Item3, Item4, Item5, Item6, Item7 Gods Unchained
     *
     * Wrap multiple 721s using the mint function passing multiple different receivers (address(0) + some receivers)
     */
    tokenHolder = "0x1204e98218f81eaa52578d340cba8ad2dc975c65";
    var tokenList = [
      "128749172",
      "128747931",
      "21418451",
      "21418445",
      "78367653",
    ];
    var receivers = [
      accounts[2],
      accounts[0],
      utilities.voidEthereumAddress,
      accounts[3],
      accounts[4],
    ];
    var mainToken = new web3.eth.Contract(
      knowledgeBase.IERC721ABI,
      knowledgeBase.cardTokenAddress
    );
    var prevResult = await Promise.all(
      receivers.map(async (address, index) => {
        return await mainToken.methods.balanceOf(tokenHolder).call();
      })
    );

    await blockchainConnection.unlockAccounts(tokenHolder);
    Promise.all(
      tokenList.map(async (token, index) => {
        await mainToken.methods
          .safeTransferFrom(tokenHolder, accounts[1], token)
          .send(blockchainConnection.getSendingOptions({ from: tokenHolder }));
        await mainToken.methods
          .approve(wrapper.options.address, token)
          .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
      })
    );

    await Promise.all(
      receivers.map(async (address, index) => {
        assert.equal(
          await mainToken.methods.balanceOf(tokenHolder).call(),
          prevResult[index].sub(receivers.length)
        );
      })
    );

    // var tx = await wrapper.methods
    //   .mint(
    //     Array(tokenList.length).fill(
    //       knowledgeBase.cardTokenAddress
    //     ),
    //     tokenList,
    //     receivers
    //   )
    //   .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var tx = await wrapperResource.mintItems721(tokenList, receivers, accounts[1], wrapper, mainToken.options.address)

      await Promise.all(
        receivers.map(async (address, index) => {
          assert.equal(
            await mainToken.methods.balanceOf(wrapper.options.address).call(),
            receivers.length.toString()
          );
        })
      );

    var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash)).logs;

    var itemIds = logs
      .filter(
        (it) =>
          it.topics[0] === web3.utils.sha3("Token(address,uint256,uint256)")
      )
      .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

    console.log("card");
    console.log(await mainInterface.methods.item(itemIds[0]).call());

    await Promise.all(itemIds.map(async (item, index) => {
      assert.equal(await wrapper.methods.decimals(item).call(), "18");
      assert.equal(
        await wrapper.methods.balanceOf(receivers[index] == utilities.voidEthereumAddress ? accounts[1] : receivers[index], item).call(),
        "1000000000000000000"
      );
      itemsList.push({
        tokenName: "CARD",
        tokenAddress: knowledgeBase.cardTokenAddress,
        account: receivers[index] == utilities.voidEthereumAddress ? accounts[1] : receivers[index],
        tokenId: tokenList[index],
        itemId: item,
      });
    }));
  });

  it("#654 Unwrap single using Burn", async () => {
    /**
     * Authorized subjects:
     * Item holders
     * approved operator address
     * Functions used in the test:
     * mint (address[] calldata tokenAddresses, uint256[] calldata tokenIds, address[] calldata receivers)
     * Items used: Item3, Item4, Item5, Item6, Item7 Gods Unchained
     *
     * Wrap multiple 721s using the mint function passing multiple different receivers (address(0) + some receivers)
     */
    var ensToken = new web3.eth.Contract(
      knowledgeBase.IERC721ABI,
      knowledgeBase.ensTokenAddress
    );

    var uniToken = new web3.eth.Contract(
      knowledgeBase.IERC721ABI,
      knowledgeBase.uniV3PositionTokenAddress
    );

    var cardToken = new web3.eth.Contract(
      knowledgeBase.IERC721ABI,
      knowledgeBase.cardTokenAddress
    );

    var burn1 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes", "bool", "bool"],
      [
        itemsList[0].tokenAddress,
        itemsList[0].tokenId,
        utilities.voidEthereumAddress,
        "0x",
        false,
        false,
      ]
    );

    var prevItemBalance = await wrapper.methods
      .balanceOf(itemsList[0].account, itemsList[0].itemId)
      .call();

    await wrapper.methods
      .burn(
        itemsList[0].account,
        itemsList[0].itemId,
        await wrapper.methods
          .balanceOf(itemsList[0].account, itemsList[0].itemId)
          .call(),
        burn1
      )
      .send(
        blockchainConnection.getSendingOptions({ from: itemsList[0].account })
      );

      assert.equal(await ensToken.methods.balanceOf(itemsList[0].account).call(), "1");

    assert.equal(
      await wrapper.methods
        .balanceOf(itemsList[0].account, itemsList[0].itemId)
        .call(),
      prevItemBalance.sub("1000000000000000000")
    );

    var burn2 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes", "bool", "bool"],
      [
        itemsList[1].tokenAddress,
        itemsList[1].tokenId,
        accounts[9],
        "0x",
        false,
        false,
      ]
    );

    var prevItemBalance2 = await wrapper.methods
      .balanceOf(itemsList[1].account, itemsList[1].itemId)
      .call();

    await wrapper.methods
      .burn(
        itemsList[1].account,
        itemsList[1].itemId,
        await wrapper.methods
          .balanceOf(itemsList[1].account, itemsList[1].itemId)
          .call(),
        burn2
      )
      .send(
        blockchainConnection.getSendingOptions({ from: itemsList[1].account })
      );

      assert.equal(
        await wrapper.methods
          .balanceOf(itemsList[1].account, itemsList[1].itemId)
          .call(),
          prevItemBalance2.sub("1000000000000000000")
      );

    assert.equal(await uniToken.methods.balanceOf(accounts[9]).call(), "1");

    await mainInterface.methods
      .approve(
        itemsList[2].account,
        accounts[3],
        await wrapper.methods
          .balanceOf(itemsList[2].account, itemsList[2].itemId)
          .call(),
        itemsList[2].itemId
      )
      .send(
        blockchainConnection.getSendingOptions({ from: itemsList[2].account })
      );

    var burn3 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes", "bool", "bool"],
      [
        itemsList[2].tokenAddress,
        itemsList[2].tokenId,
        itemsList[2].account,
        "0x",
        false,
        false,
      ]
    );

    var prevItemBalance3 = await wrapper.methods
      .balanceOf(itemsList[2].account, itemsList[2].itemId)
      .call();
    await wrapper.methods
      .burn(
        itemsList[2].account,
        itemsList[2].itemId,
        await wrapper.methods
          .balanceOf(itemsList[2].account, itemsList[2].itemId)
          .call(),
        burn3
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[3] }));

    assert.equal(
      await cardToken.methods.balanceOf(itemsList[2].account).call(),
      "1"
    );

    assert.equal(
      await wrapper.methods
        .balanceOf(itemsList[2].account, itemsList[2].itemId)
        .call(),
      prevItemBalance3.sub("1000000000000000000")
    );
  });

  it("#655 Unwrap batch using burnBatch", async () => {
    /**
     * Authorized subjects:
     * Item holders
     * approved operator address
     * Functions used in the test:
     * BurnBatch(address account, uint256[] calldata itemIds, uint256[] calldata amounts, bytes memory data)
     * Items used: Item4, Item5, Item6, Item7.
     *
     * Unwrap multiple 721s using the burnBatch function passing multiple receivers (msg.sender + others addresses).
     * An account approves an operator to spend some wrapped Items. The operator burn them sending the original tokens to multiple receivers (account address + others receivers).
     */

    console.log(itemsList);

    var cardToken = new web3.eth.Contract(
      knowledgeBase.IERC721ABI,
      knowledgeBase.cardTokenAddress
    );

    var amounts = await Promise.all(
      itemsList.slice(3,4).map(async (item, index) => {
        assert.equal(await wrapper.methods
          .balanceOf(item.account, item.itemId)
          .call(), "1000000000000000000");
        return await wrapper.methods
          .balanceOf(item.account, item.itemId)
          .call();
      })
    );

    var amounts2 = await Promise.all(
      itemsList.slice(4,).map(async (item, index) => {
        return await wrapper.methods
          .balanceOf(item.account, item.itemId)
          .call();
      })
    );

    await Promise.all(
      itemsList.slice(3).map(async (item, index) => {
        await wrapper.methods
          .safeTransferFrom(
            item.account,
            accounts[7],
            item.itemId,
            await wrapper.methods.balanceOf(item.account, item.itemId).call(),
            "0x"
          )
          .send(blockchainConnection.getSendingOptions({ from: item.account }));

          assert.equal(await wrapper.methods
            .balanceOf(accounts[7], item.itemId)
            .call(), "1000000000000000000");
      })
    );

    assert.equal(await cardToken.methods.balanceOf(accounts[7]).call(), "0");

    var itemIds = await Promise.all(
      itemsList.slice(3,4).map(async (item, index) => {
        return item.itemId;
      })
    );

    var itemIds2 = await Promise.all(
      itemsList.slice(4,).map(async (item, index) => {
        return item.itemId;
      })
    );

    var burn = await Promise.all(
      itemsList.slice(3,4).map(async (item, index) => {
        return web3.eth.abi.encodeParameters(
          ["address", "uint256", "address", "bytes", "bool", "bool"],
          [item.tokenAddress, item.tokenId, accounts[index], "0x", false, false]
        );
      })
    );

    var burn2 = await Promise.all(
      itemsList.slice(4,).map(async (item, index) => {
        return web3.eth.abi.encodeParameters(
          ["address", "uint256", "address", "bytes", "bool", "bool"],
          [item.tokenAddress, item.tokenId, accounts[index], "0x", false, false]
        );
      })
    );

    var datas = web3.eth.abi.encodeParameters(["bytes[]"], [burn]);
    var datas2 = web3.eth.abi.encodeParameters(["bytes[]"], [burn2]);

    await wrapper.methods
      .burnBatch(accounts[7], itemIds, amounts, datas)
      .send(blockchainConnection.getSendingOptions({ from: accounts[7] }));

    await Promise.all(
      itemIds2.map(async(id, index) => {
        await mainInterface.methods
          .approve(
            accounts[7],
            accounts[3],
            await wrapper.methods
              .balanceOf(accounts[7], id)
              .call(),
            id
          )
          .send(
            blockchainConnection.getSendingOptions({ from: accounts[7] })
          );
      })
    );

    await wrapper.methods
      .burnBatch(accounts[7], itemIds2, amounts2, datas2)
      .send(blockchainConnection.getSendingOptions({ from: accounts[3] }));


      await Promise.all(
        itemsList.slice(3).map(async (item, index) => {
            assert.equal(await wrapper.methods
              .balanceOf(item.account, item.itemId)
              .call(), "0");
        })
      );
  });

  it("#656 Testing some different unwrap and rewrap scenarios with different balances: scenario 1", async () => {
    /**
    * Authorized subjects:
    * Item holders
    * Functions used in the test:
    * mint
    * safeTransferFrom
    * Burn
    CYBERKONGS

    Scenario 1:
    -Wrap a 721.
    -transfer 0,4.
    -Unwrap the 721 burning 0,6
    -Wrap the 721, the minted amount must be 0,6.
    */
    tokenHolder = "0x721931508df2764fd4f70c53da646cb8aed16ace";
    // await blockchainConnection.unlockAccounts(tokenHolder);
    await approveHost(tokenHolder);
    var tokenAddress = "0x57a204aa1042f6e66dd7730813f4024114d74f37";

    var tokenList = ["889"];
    var receivers = [accounts[1]];

    var mainToken = new web3.eth.Contract(
      knowledgeBase.IERC721ABI,
      tokenAddress
    );

    await Promise.all(
      tokenList.map(async (token, index) => {
        await mainToken.methods
          .safeTransferFrom(tokenHolder, accounts[1], token)
          .send(blockchainConnection.getSendingOptions({ from: tokenHolder }));
        await mainToken.methods
          .approve(wrapper.options.address, token)
          .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
      })
    );

    // var tx = await wrapper.methods
    //   .mint(Array(tokenList.length).fill(tokenAddress), tokenList, receivers)
    //   .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    
    var tx = await wrapperResource.mintItems721(tokenList, receivers, accounts[1], wrapper, mainToken.options.address)
      
    var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash)).logs;

    var itemIds = logs
      .filter(
        (it) =>
          it.topics[0] === web3.utils.sha3("Token(address,uint256,uint256)")
      )
      .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));


    await wrapper.methods
      .safeTransferFrom(
        accounts[1],
        accounts[2],
        itemIds[0],
        "400000000000000000",
        "0x"
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

      assert.equal(
        await wrapper.methods.balanceOf(accounts[1], itemIds[0]).call(),
        "600000000000000000"
      );
      assert.equal(
        await wrapper.methods.balanceOf(accounts[2], itemIds[0]).call(),
        "400000000000000000"
      );

    var burn1 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes", "bool", "bool"],
      [
        tokenAddress,
        tokenList[0],
        utilities.voidEthereumAddress,
        "0x",
        false,
        false,
      ]
    );

    await wrapper.methods
      .burn(
        accounts[1],
        itemIds[0],
        await wrapper.methods.balanceOf(accounts[1], itemIds[0]).call(),
        burn1
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    assert.equal(await mainToken.methods.balanceOf(accounts[1]).call(), "1");

    await mainToken.methods
      .approve(wrapper.options.address, tokenList[0])
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    // var tx = await wrapper.methods
    //   .mint(
    //     Array(tokenList.length).fill(
    //       "0x57a204aa1042f6e66dd7730813f4024114d74f37"
    //     ),
    //     tokenList,
    //     receivers
    //   )
    //   .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

      var tx = await wrapperResource.mintItems721(tokenList, receivers, accounts[1], wrapper, mainToken.options.address)
      
    assert.equal(await mainToken.methods.balanceOf(accounts[1]).call(), "0");

    assert.equal(
      await wrapper.methods.balanceOf(accounts[1], itemIds[0]).call(),
      "600000000000000000"
    );
  });

  it("#656 Testing some different unwrap and rewrap scenarios with different balances: scenario2 ", async () => {
    /**
    * Authorized subjects:
    * Item holders
    * Functions used in the test:
    * mint
    * safeTransferFrom
    * Burn
    CYBERKONGS

    Scenario 2:
    -Wrap a 721.
    -transfer 0,5.

    must fail: you cannot unwrap the original token.
    */
    tokenHolder = "0x721931508df2764fd4f70c53da646cb8aed16ace";
    // await blockchainConnection.unlockAccounts(tokenHolder);
    await approveHost(tokenHolder);
    var tokenAddress = "0x57a204aa1042f6e66dd7730813f4024114d74f37";

    var tokenList = ["848"];
    var receivers = [accounts[1]];

    var mainToken = new web3.eth.Contract(
      knowledgeBase.IERC721ABI,
      tokenAddress
    );

    await Promise.all(
      tokenList.map(async (token, index) => {
        await mainToken.methods
          .safeTransferFrom(tokenHolder, accounts[1], token)
          .send(blockchainConnection.getSendingOptions({ from: tokenHolder }));
        await mainToken.methods
          .approve(wrapper.options.address, token)
          .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
      })
    );

    assert.equal(await mainToken.methods.balanceOf(accounts[1]).call(), "1");

    // var tx = await wrapper.methods
    //   .mint(Array(tokenList.length).fill(tokenAddress), tokenList, receivers)
    //   .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    var tx = await wrapperResource.mintItems721(tokenList, receivers, accounts[1], wrapper, mainToken.options.address)

    var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash)).logs;

    var itemIds = logs
      .filter(
        (it) =>
          it.topics[0] === web3.utils.sha3("Token(address,uint256,uint256)")
      )
      .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

      console.log("kongz");
      console.log(await mainInterface.methods.item(itemIds[0]).call());

    assert.equal(await mainToken.methods.balanceOf(accounts[1]).call(), "0");

    await wrapper.methods
      .safeTransferFrom(
        accounts[1],
        accounts[2],
        itemIds[0],
        "500000000000000000",
        "0x"
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    assert.equal(
      await wrapper.methods.balanceOf(accounts[1], itemIds[0]).call(),
      "500000000000000000"
    );

    assert.equal(
      await wrapper.methods.balanceOf(accounts[2], itemIds[0]).call(),
      "500000000000000000"
    );

    var burn1 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes", "bool", "bool"],
      [tokenAddress, tokenList[0], accounts[1], "0x", false, false]
    );

    assert.equal(
      await wrapper.methods.balanceOf(accounts[1], itemIds[0]).call(),
      "500000000000000000"
    );

    await catchCall(
      wrapper.methods
        .burn(
          accounts[1],
          itemIds[0],
          await wrapper.methods.balanceOf(accounts[1], itemIds[0]).call(),
          burn1
        )
        .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
      "Insufficient balance"
    );

    assert.equal(await mainToken.methods.balanceOf(accounts[1]).call(), "0");
  });

  it("#656 Testing some different unwrap and rewrap scenarios with different balances: scenario3", async () => {
    /**
    * Authorized subjects:
    * Item holders
    * Functions used in the test:
    * mint
    * safeTransferFrom
    * Burn
    CYBERKONGS

    Scenario 3:
    -Wrap a 721.
    -transfer 0,49.
    -Unwrap the 721 burning 0,51
    -Wrap the 721, the minted amount must be 0,51.
    */
    tokenHolder = "0x721931508df2764fd4f70c53da646cb8aed16ace";
    await approveHost(tokenHolder);    
    var tokenAddress = "0x57a204aa1042f6e66dd7730813f4024114d74f37";

    var tokenList = ["832"];
    var receivers = [accounts[1]];

    var mainToken = new web3.eth.Contract(
      knowledgeBase.IERC721ABI,
      tokenAddress
    );

    await Promise.all(
      tokenList.map(async (token, index) => {
        await mainToken.methods
          .safeTransferFrom(tokenHolder, accounts[1], token)
          .send(blockchainConnection.getSendingOptions({ from: tokenHolder }));
        await mainToken.methods
          .approve(wrapper.options.address, token)
          .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
      })
    );

    assert.equal(await mainToken.methods.balanceOf(accounts[1]).call(), "1");

    // var tx = await wrapper.methods
    //   .mint(Array(tokenList.length).fill(tokenAddress), tokenList, receivers)
    //   .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
      var tx = await wrapperResource.mintItems721(tokenList, receivers, accounts[1], wrapper, mainToken.options.address)


    var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash)).logs;

    var itemIds = logs
      .filter(
        (it) =>
          it.topics[0] === web3.utils.sha3("Token(address,uint256,uint256)")
      )
      .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

    assert.equal(await mainToken.methods.balanceOf(accounts[1]).call(), "0");

    await wrapper.methods
      .safeTransferFrom(
        accounts[1],
        accounts[2],
        itemIds[0],
        "490000000000000000",
        "0x"
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    assert.equal(
      await wrapper.methods.balanceOf(accounts[1], itemIds[0]).call(),
      "510000000000000000"
    );

    assert.equal(
      await wrapper.methods.balanceOf(accounts[2], itemIds[0]).call(),
      "490000000000000000"
    );

    var burn1 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes", "bool", "bool"],
      [
        tokenAddress,
        tokenList[0],
        utilities.voidEthereumAddress,
        "0x",
        false,
        false,
      ]
    );

    await wrapper.methods
      .burn(
        accounts[1],
        itemIds[0],
        await wrapper.methods.balanceOf(accounts[1], itemIds[0]).call(),
        burn1
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

      assert.equal(await mainToken.methods.balanceOf(accounts[1]).call(), "1");

    await mainToken.methods
      .approve(wrapper.options.address, tokenList[0])
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    // var tx = await wrapper.methods
    //   .mint(
    //     Array(tokenList.length).fill(
    //       "0x57a204aa1042f6e66dd7730813f4024114d74f37"
    //     ),
    //     tokenList,
    //     receivers
    //   )
    //   .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var tx = await wrapperResource.mintItems721(tokenList, receivers, accounts[1], wrapper, mainToken.options.address)


    assert.equal(
      await wrapper.methods.balanceOf(accounts[1], itemIds[0]).call(),
      "510000000000000000"
    );

    console.log("remint");
    console.log(await mainInterface.methods.item(itemIds[0]).call());

    assert.equal(await mainToken.methods.balanceOf(accounts[1]).call(), "0");

  });

  it("#656 Testing some different unwrap and rewrap scenarios with different balances: scenario4", async () => {
    /**
    * Authorized subjects:
    * Item holders
    * Functions used in the test:
    * mint
    * safeTransferFrom
    * Burn
    CYBERKONGS

    Scenario 4:
    -Wrap a 721.
    -transfer 0,3. transfer 0,3.

    must fail: you cannot unwrap the original token.
    */
    tokenHolder = "0x721931508df2764fd4f70c53da646cb8aed16ace";
    await approveHost(tokenHolder);    
    var tokenAddress = "0x57a204aa1042f6e66dd7730813f4024114d74f37";

    var tokenList = ["818"];
    var receivers = [accounts[1]];

    var mainToken = new web3.eth.Contract(
      knowledgeBase.IERC721ABI,
      tokenAddress
    );

    await Promise.all(
      tokenList.map(async (token, index) => {
        await mainToken.methods
          .safeTransferFrom(tokenHolder, accounts[1], token)
          .send(blockchainConnection.getSendingOptions({ from: tokenHolder }));
        await mainToken.methods
          .approve(wrapper.options.address, token)
          .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
      })
    );

    assert.equal(await mainToken.methods.balanceOf(accounts[1]).call(), "1");

    // var tx = await wrapper.methods
    //   .mint(Array(tokenList.length).fill(tokenAddress), tokenList, receivers)
    //   .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    var tx = await wrapperResource.mintItems721(tokenList, receivers, accounts[1], wrapper, mainToken.options.address)


    var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash)).logs;

    var itemIds = logs
      .filter(
        (it) =>
          it.topics[0] === web3.utils.sha3("Token(address,uint256,uint256)")
      )
      .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

      assert.equal(await mainToken.methods.balanceOf(accounts[1]).call(), "0");

      assert.equal(
        await wrapper.methods.balanceOf(accounts[1], itemIds[0]).call(),
        "1000000000000000000"
      );

    await wrapper.methods
      .safeTransferFrom(
        accounts[1],
        accounts[2],
        itemIds[0],
        "300000000000000000",
        "0x"
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    await wrapper.methods
      .safeTransferFrom(
        accounts[1],
        accounts[3],
        itemIds[0],
        "300000000000000000",
        "0x"
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    assert.equal(
      await wrapper.methods.balanceOf(accounts[1], itemIds[0]).call(),
      "400000000000000000"
    );

    assert.equal(
      await wrapper.methods.balanceOf(accounts[2], itemIds[0]).call(),
      "300000000000000000"
    );

    assert.equal(
      await wrapper.methods.balanceOf(accounts[3], itemIds[0]).call(),
      "300000000000000000"
    );

    var burn1 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes", "bool", "bool"],
      [
        tokenAddress,
        tokenList[0],
        utilities.voidEthereumAddress,
        "0x",
        false,
        false,
      ]
    );

    await catchCall(
      wrapper.methods
        .burn(
          accounts[1],
          itemIds[0],
          await wrapper.methods.balanceOf(accounts[1], itemIds[0]).call(),
          burn1
        )
        .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
      "Insufficient balance"
    );
  });

  it("#656 Testing some different unwrap and rewrap scenarios with different balances: scenario5", async () => {
    /**
    * Authorized subjects:
    * Item holders
    * Functions used in the test:
    * mint
    * safeTransferFrom
    * Burn
    CYBERKONGS

    Scenario 5:
    -Wrap a 721.
    -transfer 0,1. transfer 0,1. transfer 0,15. transfer 0,05.

    accounts receivers burn 0,1 0,1 0,15 and 0,05 (tot. 0,4)
    Unwrap the 721 burning 0,6
    Wrap the 721, the minted amount must be 1.
    */

    tokenHolder = "0x721931508df2764fd4f70c53da646cb8aed16ace";
    await approveHost(tokenHolder);    
    var tokenAddress = "0x57a204aa1042f6e66dd7730813f4024114d74f37";

    var tokenList = ["237"];
    var receivers = [accounts[1]];
    var sendValue = ["100000000000000000", "100000000000000000", "150000000000000000", "50000000000000000"]

    var mainToken = new web3.eth.Contract(
      knowledgeBase.IERC721ABI,
      tokenAddress
    );

    await Promise.all(
      tokenList.map(async (token, index) => {
        await mainToken.methods
          .safeTransferFrom(tokenHolder, accounts[1], token)
          .send(blockchainConnection.getSendingOptions({ from: tokenHolder }));
        await mainToken.methods
          .approve(wrapper.options.address, token)
          .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
      })
    );

    assert.equal(await mainToken.methods.balanceOf(accounts[1]).call(), "1");

    // var tx = await wrapper.methods
    //   .mint(Array(tokenList.length).fill(tokenAddress), tokenList, receivers)
    //   .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var tx = await wrapperResource.mintItems721(tokenList, receivers, accounts[1], wrapper, mainToken.options.address)


    var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash)).logs;

    var itemIds = logs
      .filter(
        (it) =>
          it.topics[0] === web3.utils.sha3("Token(address,uint256,uint256)")
      )
      .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

      assert.equal(await mainToken.methods.balanceOf(accounts[1]).call(), "0");

      var erc20Contract = await asInteroperableInterface(itemIds[0]);

    
    await Promise.all(sendValue.map(async(value, index) => {
      await wrapper.methods
        .safeTransferFrom(
          accounts[1],
          accounts[index+2],
          itemIds[0],
          value,
          "0x"
        )
        .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
      
      assert.equal(
        await wrapper.methods.balanceOf(accounts[index+2], itemIds[0]).call(),
        value
      );

      await erc20Contract.methods
      .burn(value)
      .send(blockchainConnection.getSendingOptions({ from: accounts[index+2] }))
    }))

    var burn1 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes", "bool", "bool"],
      [
        tokenAddress,
        tokenList[0],
        utilities.voidEthereumAddress,
        "0x",
        false,
        false,
      ]
    );

    await wrapper.methods
      .burn(
        accounts[1],
        itemIds[0],
        await wrapper.methods.balanceOf(accounts[1], itemIds[0]).call(),
        burn1
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

      assert.equal(await mainToken.methods.balanceOf(accounts[1]).call(), "1");

    await mainToken.methods
      .approve(wrapper.options.address, tokenList[0])
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    // var tx = await wrapper.methods
    //   .mint(
    //     Array(tokenList.length).fill(
    //       "0x57a204aa1042f6e66dd7730813f4024114d74f37"
    //     ),
    //     tokenList,
    //     receivers
    //   )
    //   .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var tx = await wrapperResource.mintItems721(tokenList, receivers, accounts[1], wrapper, mainToken.options.address)


    assert.equal(
      await wrapper.methods.balanceOf(accounts[1], itemIds[0]).call(),
      "1000000000000000000"
    );
    assert.equal(await mainToken.methods.balanceOf(accounts[1]).call(), "0");

  });

  it("#657 Testing some different unwrap and rewrap scenarios with different balances using the Interoperable burn operation: scenario 1", async () => {
    /**
    * Authorized subjects:
    * Item holders
    * Functions used in the test:
    * mint
    * safeTransferFrom
    * Burn
    * Burn Interoperable
    cryptokitties

    Scenario 1:
    -Wrap a 721.
    -burn interoperable 0,4.
    -Unwrap the 721 burning 0,6.
    -Wrap the 721, the minted amount must be 1.
    */
    tokenHolder = "0x721931508df2764fd4f70c53da646cb8aed16ace";
    await approveHost(tokenHolder);    
    var tokenAddress = "0x57a204aa1042f6e66dd7730813f4024114d74f37";

    var tokenList = ["232"];
    var receivers = [accounts[1]];

    var mainToken = new web3.eth.Contract(
      knowledgeBase.IERC721ABI,
      tokenAddress
    );

    await Promise.all(
      tokenList.map(async (token, index) => {
        await mainToken.methods
          .safeTransferFrom(tokenHolder, accounts[1], token)
          .send(blockchainConnection.getSendingOptions({ from: tokenHolder }));
        await mainToken.methods
          .approve(wrapper.options.address, token)
          .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
      })
    );

    assert.equal(await mainToken.methods.balanceOf(accounts[1]).call(), "1");

    // var tx = await wrapper.methods
    //   .mint(Array(tokenList.length).fill(tokenAddress), tokenList, receivers)
    //   .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var tx = await wrapperResource.mintItems721(tokenList, receivers, accounts[1], wrapper, mainToken.options.address)


    var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash)).logs;

    var itemIds = logs
      .filter(
        (it) =>
          it.topics[0] === web3.utils.sha3("Token(address,uint256,uint256)")
      )
      .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

    assert.equal(await mainToken.methods.balanceOf(accounts[1]).call(), "0");

    var erc20Contract = await asInteroperableInterface(itemIds[0]);

    await erc20Contract.methods
      .burn("400000000000000000")
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    assert.equal(
      await wrapper.methods.balanceOf(accounts[1], itemIds[0]).call(),
      "600000000000000000"
    );

    var burn1 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes", "bool", "bool"],
      [
        tokenAddress,
        tokenList[0],
        utilities.voidEthereumAddress,
        "0x",
        false,
        false,
      ]
    );

    await wrapper.methods
      .burn(
        accounts[1],
        itemIds[0],
        await wrapper.methods.balanceOf(accounts[1], itemIds[0]).call(),
        burn1
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    await mainToken.methods
      .approve(wrapper.options.address, tokenList[0])
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    assert.equal(await mainToken.methods.balanceOf(accounts[1]).call(), "1");

    // var tx = await wrapper.methods
    //   .mint(
    //     Array(tokenList.length).fill(
    //       "0x57a204aa1042f6e66dd7730813f4024114d74f37"
    //     ),
    //     tokenList,
    //     receivers
    //   )
    //   .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    var tx = await wrapperResource.mintItems721(tokenList, receivers, accounts[1], wrapper, mainToken.options.address)


    assert.equal(
      await wrapper.methods.balanceOf(accounts[1], itemIds[0]).call(),
      "1000000000000000000"
    );

    assert.equal(await mainToken.methods.balanceOf(accounts[1]).call(), "0");
  });

  it("#657 Testing some different unwrap and rewrap scenarios with different balances using the Interoperable burn operation: scenario2", async () => {
    /**
    * Authorized subjects:
    * Item holders
    * Functions used in the test:
    * mint
    * safeTransferFrom
    * Burn
    * Burn Interoperable
    cryptokitties

    Scenario 2:
    -Wrap a 721.
    -burn interoperable 0,5
    -must fail: you cannot unwrap the original token.
    */
    tokenHolder = "0x721931508df2764fd4f70c53da646cb8aed16ace";
    await approveHost(tokenHolder);    
    var tokenAddress = "0x57a204aa1042f6e66dd7730813f4024114d74f37";

    var tokenList = ["135"];
    var receivers = [accounts[1]];

    var mainToken = new web3.eth.Contract(
      knowledgeBase.IERC721ABI,
      tokenAddress
    );

    await Promise.all(
      tokenList.map(async (token, index) => {
        await mainToken.methods
          .safeTransferFrom(tokenHolder, accounts[1], token)
          .send(blockchainConnection.getSendingOptions({ from: tokenHolder }));
        await mainToken.methods
          .approve(wrapper.options.address, token)
          .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
      })
    );

    assert.equal(await mainToken.methods.balanceOf(accounts[1]).call(), "1");

    // var tx = await wrapper.methods
    //   .mint(Array(tokenList.length).fill(tokenAddress), tokenList, receivers)
    //   .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var tx = await wrapperResource.mintItems721(tokenList, receivers, accounts[1], wrapper, mainToken.options.address)


    var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash)).logs;

    var itemIds = logs
      .filter(
        (it) =>
          it.topics[0] === web3.utils.sha3("Token(address,uint256,uint256)")
      )
      .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

      assert.equal(await mainToken.methods.balanceOf(accounts[1]).call(), "0");
    var erc20Contract = await asInteroperableInterface(itemIds[0]);

    await erc20Contract.methods
      .burn("500000000000000000")
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    assert.equal(
      await wrapper.methods.balanceOf(accounts[1], itemIds[0]).call(),
      "500000000000000000"
    );

    var burn1 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes", "bool", "bool"],
      [
        tokenAddress,
        tokenList[0],
        utilities.voidEthereumAddress,
        "0x",
        false,
        false,
      ]
    );

    await catchCall(wrapper.methods
      .burn(
        accounts[1],
        itemIds[0],
        await wrapper.methods.balanceOf(accounts[1], itemIds[0]).call(),
        burn1
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] })), "Insufficient balance");

    assert.equal(await mainToken.methods.balanceOf(accounts[1]).call(), "0");
  });

  it("#657 Testing some different unwrap and rewrap scenarios with different balances using the Interoperable burn operation: scenario3", async () => {
    /**
    * Authorized subjects:
    * Item holders
    * Functions used in the test:
    * mint
    * safeTransferFrom
    * Burn
    * Burn Interoperable
    cryptokitties

    Scenario 3:
    -Wrap a 721.
    -transfer interoperable 0,3.
    -Unwrap the 721 burning 0,7.
    -Wrap the 721, the minted amount must be 0,7.
    */
    tokenHolder = "0x721931508df2764fd4f70c53da646cb8aed16ace";
    await approveHost(tokenHolder);    
    var tokenAddress = "0x57a204aa1042f6e66dd7730813f4024114d74f37";

    var tokenList = ["255"];
    var receivers = [accounts[1]];

    var mainToken = new web3.eth.Contract(
      knowledgeBase.IERC721ABI,
      tokenAddress
    );

    await Promise.all(
      tokenList.map(async (token, index) => {
        await mainToken.methods
          .safeTransferFrom(tokenHolder, accounts[1], token)
          .send(blockchainConnection.getSendingOptions({ from: tokenHolder }));
        await mainToken.methods
          .approve(wrapper.options.address, token)
          .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
      })
    );

    assert.equal(await mainToken.methods.balanceOf(accounts[1]).call(), "1");

    // var tx = await wrapper.methods
    //   .mint(Array(tokenList.length).fill(tokenAddress), tokenList, receivers)
    //   .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var tx = await wrapperResource.mintItems721(tokenList, receivers, accounts[1], wrapper, mainToken.options.address)


    var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash)).logs;

    var itemIds = logs
      .filter(
        (it) =>
          it.topics[0] === web3.utils.sha3("Token(address,uint256,uint256)")
      )
      .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

      assert.equal(await mainToken.methods.balanceOf(accounts[1]).call(), "0");

    var erc20Contract = await asInteroperableInterface(itemIds[0]);

    await erc20Contract.methods
      .transferFrom(accounts[1], accounts[2], "300000000000000000")
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    assert.equal(
      await wrapper.methods.balanceOf(accounts[1], itemIds[0]).call(),
      "700000000000000000"
    );

    var burn1 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes", "bool", "bool"],
      [
        tokenAddress,
        tokenList[0],
        utilities.voidEthereumAddress,
        "0x",
        false,
        false,
      ]
    );

    await wrapper.methods
      .burn(
        accounts[1],
        itemIds[0],
        await wrapper.methods.balanceOf(accounts[1], itemIds[0]).call(),
        burn1
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

      assert.equal(await mainToken.methods.balanceOf(accounts[1]).call(), "1");

    await mainToken.methods
      .approve(wrapper.options.address, tokenList[0])
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    assert.equal(await mainToken.methods.balanceOf(accounts[1]).call(), "1");

    // var tx = await wrapper.methods
    //   .mint(
    //     Array(tokenList.length).fill(
    //       "0x57a204aa1042f6e66dd7730813f4024114d74f37"
    //     ),
    //     tokenList,
    //     receivers
    //   )
    //   .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var tx = await wrapperResource.mintItems721(tokenList, receivers, accounts[1], wrapper, mainToken.options.address)


    assert.equal(
      await wrapper.methods.balanceOf(accounts[1], itemIds[0]).call(),
      "700000000000000000"
    );

    assert.equal(await mainToken.methods.balanceOf(accounts[1]).call(), "0");
  });

  it("#657 Testing some different unwrap and rewrap scenarios with different balances using the Interoperable burn operation: scenario4", async () => {
    /**
    * Authorized subjects:
    * Item holders
    * Functions used in the test:
    * mint
    * safeTransferFrom
    * Burn
    * Burn Interoperable
    cryptokitties

    Scenario 4:
    -Wrap a 721.
    -transfer interoperable 0,6.
    -must fail: you cannot unwrap the original token.
    -The other address unwraps the 721 burning 0,6.
    -Wrap the 721, the minted amount must be 0,6.
    */
    tokenHolder = "0x721931508df2764fd4f70c53da646cb8aed16ace";
    await approveHost(tokenHolder);    
    var tokenAddress = "0x57a204aa1042f6e66dd7730813f4024114d74f37";

    var tokenList = ["1005"];
    var receivers = [accounts[1]];

    var mainToken = new web3.eth.Contract(
      knowledgeBase.IERC721ABI,
      tokenAddress
    );

    await Promise.all(
      tokenList.map(async (token, index) => {
        await mainToken.methods
          .safeTransferFrom(tokenHolder, accounts[1], token)
          .send(blockchainConnection.getSendingOptions({ from: tokenHolder }));
        await mainToken.methods
          .approve(wrapper.options.address, token)
          .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
      })
    );

    assert.equal(await mainToken.methods.balanceOf(accounts[1]).call(), "1");

    // var tx = await wrapper.methods
    //   .mint(Array(tokenList.length).fill(tokenAddress), tokenList, receivers)
    //   .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var tx = await wrapperResource.mintItems721(tokenList, receivers, accounts[1], wrapper, mainToken.options.address)


    var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash)).logs;

    var itemIds = logs
      .filter(
        (it) =>
          it.topics[0] === web3.utils.sha3("Token(address,uint256,uint256)")
      )
      .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

      assert.equal(await mainToken.methods.balanceOf(accounts[1]).call(), "0");

    var erc20Contract = await asInteroperableInterface(itemIds[0]);

    await erc20Contract.methods
      .transferFrom(accounts[1], accounts[2], "600000000000000000")
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    assert.equal(
      await wrapper.methods.balanceOf(accounts[1], itemIds[0]).call(),
      "400000000000000000"
    );

    var burn1 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes", "bool", "bool"],
      [
        tokenAddress,
        tokenList[0],
        utilities.voidEthereumAddress,
        "0x",
        false,
        false,
      ]
    );

    await catchCall(
      wrapper.methods
        .burn(
          accounts[1],
          itemIds[0],
          await wrapper.methods.balanceOf(accounts[1], itemIds[0]).call(),
          burn1
        )
        .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
      "Insufficient balance"
    );

    await wrapper.methods
      .burn(
        accounts[2],
        itemIds[0],
        await wrapper.methods.balanceOf(accounts[2], itemIds[0]).call(),
        burn1
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[2] }));

    await mainToken.methods
      .approve(wrapper.options.address, tokenList[0])
      .send(blockchainConnection.getSendingOptions({ from: accounts[2] }));

    assert.equal(await mainToken.methods.balanceOf(accounts[2]).call(), "1");
    assert.equal(await mainToken.methods.balanceOf(accounts[1]).call(), "0");

    // var tx = await wrapper.methods
    //   .mint(
    //     Array(tokenList.length).fill(
    //       "0x57a204aa1042f6e66dd7730813f4024114d74f37"
    //     ),
    //     tokenList,
    //     [accounts[2]]
    //   )
    //   .send(blockchainConnection.getSendingOptions({ from: accounts[2] }));

    var tx = await wrapperResource.mintItems721(tokenList, receivers, accounts[1], wrapper, mainToken.options.address)


    assert.equal(
      await wrapper.methods.balanceOf(accounts[2], itemIds[0]).call(),
      "600000000000000000"
    );

    assert.equal(await mainToken.methods.balanceOf(accounts[1]).call(), "0");
    assert.equal(await mainToken.methods.balanceOf(accounts[2]).call(), "0");
  });
});
