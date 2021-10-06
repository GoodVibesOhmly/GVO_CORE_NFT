var utilities = require("../util/utilities");
var itemsv2 = require("../resources/itemsv2");
var itemProjection = require("../resources/itemProjection");
const blockchainConnection = require("../util/blockchainConnection");
describe("itemv2 projections ERC721Wrapper", () => {
  var tokenHolder = "0xcfB586d08633fC36953be8083B63a7d96D50265B";
  var wrapper;
  var MainInterface;
  var mainInterface;
  var itemsList = [];

  async function buyForETH(token, amount, from) {
    var uniswapV2Router = new web3.eth.Contract(
      knowledgeBase.uniswapV2RouterABI,
      knowledgeBase.uniswapV2RouterAddress
    );
    var wethToken = new web3.eth.Contract(
      knowledgeBase.IERC20ABI,
      knowledgeBase.wethTokenAddress
    );
    var path = [wethToken.options.address, token.options.address];
    var value = utilities.toDecimals(amount.toString(), "18");
    await uniswapV2Router.methods
      .swapExactETHForTokens(
        "1",
        path,
        (from && (from.from || from)) || accounts[0],
        parseInt(new Date().getTime() / 1000 + 1000)
      )
      .send(
        blockchainConnection.getSendingOptions({
          from: (from && (from.from || from)) || accounts[0],
          value,
        })
      );
  }

  before(async () => {
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
    var tx = await mainToken.methods
      .safeTransferFrom(accounts[1], wrapper.options.address, token721Id)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash)).logs;
    var tokenId = web3.eth.abi.decodeParameter(
      "uint256",
      logs.filter(
        (it) =>
          it.topics[0] === web3.utils.sha3("Token(address,uint256,uint256)")
      )[0].topics[3]
    );

    console.log(await mainInterface.methods.item(tokenId).call());

    itemsList.push({
      tokenName: "ens",
      tokenAddress: knowledgeBase.ensTokenAddress,
      account: accounts[1],
      tokenId: token721Id,
      itemId: tokenId,
    });

    assert.equal(
      await wrapper.methods.balanceOf(accounts[1], tokenId).call(),
      "1000000000000000000"
    );
    assert.equal(await wrapper.methods.decimals(tokenId).call(), "18");
    assert.equal(
      await mainToken.methods.balanceOf(tokenHolder).call(),
      prevResult.sub(1)
    );

    var mainToken1 = new web3.eth.Contract(
      knowledgeBase.IERC721ABI,
      knowledgeBase.uniV3PositionTokenAddress
    );
    var prevResult1 = await mainToken1.methods.balanceOf(tokenHolder).call();

    await mainToken1.methods
      .safeTransferFrom(tokenHolder, accounts[1], token721Id1)
      .send(blockchainConnection.getSendingOptions({ from: tokenHolder }));
    var tx1 = await mainToken1.methods
      .safeTransferFrom(accounts[1], wrapper.options.address, token721Id1)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var logs = (await web3.eth.getTransactionReceipt(tx1.transactionHash)).logs;
    var tokenId = web3.eth.abi.decodeParameter(
      "uint256",
      logs.filter(
        (it) =>
          it.topics[0] === web3.utils.sha3("Token(address,uint256,uint256)")
      )[0].topics[3]
    );
    console.log(tokenId);

    console.log(await mainInterface.methods.item(tokenId).call());

    itemsList.push({
      tokenName: "uniV3Position",
      tokenAddress: knowledgeBase.uniV3PositionTokenAddress,
      account: utilities.voidEthereumAddress,
      tokenId: token721Id1,
      itemId: tokenId,
    });
    assert.equal(
      await wrapper.methods.balanceOf(accounts[1], tokenId).call(),
      "1000000000000000000"
    );
    assert.equal(await wrapper.methods.decimals(tokenId).call(), "18");
    assert.equal(
      await mainToken1.methods.balanceOf(tokenHolder).call(),
      prevResult1.sub(1)
    );
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
      accounts[1],
      accounts[3],
      accounts[4],
    ];
    var mainToken = new web3.eth.Contract(
      knowledgeBase.IERC721ABI,
      "0x0e3a2a1f2146d86a604adc220b4967a898d7fe07"
    );
    var prevResult = await Promise.all(
      receivers.map(async (address, index) => {
        return await mainToken.methods.balanceOf(tokenHolder).call();
      })
    );

    console.log(await mainToken.methods.balanceOf(accounts[1]).call());
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
        assert.equal(await mainToken.methods.balanceOf(tokenHolder).call(), prevResult[index].sub(receivers.length));
      })
    );

    var tx = await wrapper.methods
      .mint(
        Array(tokenList.length).fill(
          "0x0e3a2a1f2146d86a604adc220b4967a898d7fe07"
        ),
        tokenList,
        receivers
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash)).logs;

    var itemIds = logs
      .filter(
        (it) =>
          it.topics[0] === web3.utils.sha3("Token(address,uint256,uint256)")
      )
      .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

    itemIds.map(async (item, index) => {
      assert.equal(await wrapper.methods.decimals(item).call(), "18");
      assert.equal(await wrapper.methods.balanceOf(receivers[index], item).call(), "1000000000000000000");
      itemsList.push({
        tokenName: "CARD",
        tokenAddress: "0x0e3a2a1f2146d86a604adc220b4967a898d7fe07",
        account: receivers[index],
        tokenId: tokenList[index],
        itemId: item,
      });
    });

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
    var mainToken = new web3.eth.Contract(
      knowledgeBase.IERC721ABI,
      knowledgeBase.godsTokenAddress
    );

    var receive721 = [itemsList[0].account, accounts[9], accounts[3]];
    // var prev721Balance = Promise.all(receive721.map(async(address, index) => {

    // }));
    console.log(itemsList);
    // await blockchainConnection.unlockAccounts(tokenHolder);
    console.log(
      await wrapper.methods
        .balanceOf(itemsList[0].account, itemsList[0].itemId)
        .call()
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

    console.log(prevItemBalance)

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

    assert.equal(await wrapper.methods
      .balanceOf(itemsList[0].account, itemsList[0].itemId)
      .call(), prevItemBalance.sub("1000000000000000000"));

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
        blockchainConnection.getSendingOptions({ from: itemsList[0].account })
      );

      assert.equal(await wrapper.methods
        .balanceOf(itemsList[1].account, itemsList[1].itemId)
        .call(), prevItemBalance2.sub(itemsList[1].account));

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

      assert.equal(await wrapper.methods
        .balanceOf(itemsList[2].account, itemsList[2].itemId)
        .call(), prevItemBalance3.sub("1000000000000000000"));
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
    }));

    var itemIds = await Promise.all(itemsList.slice(3).map(async (item, index) => {
      return item.itemId;
    }));
    var amounts = await Promise.all(itemsList.slice(3).map(async (item, index) => {
      console.log("iiiiiiiiiii")
      console.log(item.account)
      console.log(item.itemId)
      console.log(await wrapper.methods.balanceOf(item.account, item.itemId).call())
      console.log("fffffffff")

      return await wrapper.methods.balanceOf(item.account, item.itemId).call();
    }));

    var burn = await Promise.all(itemsList.slice(3).map(async (item, index) => {
      return web3.eth.abi.encodeParameters(
        ["address", "uint256", "address", "bytes", "bool", "bool"],
        [item.tokenAddress, item.tokenId, accounts[index], "0x", false, false]
      );
    }));

    console.log(amounts)

    var datas = web3.eth.abi.encodeParameters(["bytes[]"], [burn]);

    await wrapper.methods
      .burnBatch(accounts[7], itemIds, amounts, datas)
      .send(blockchainConnection.getSendingOptions({ from: accounts[7] }));
  });

  it("#656 Testing some different unwrap and rewrap scenarios with different balances", async () => {
    tokenHolder = "0x721931508df2764fd4f70c53da646cb8aed16ace";
    await blockchainConnection.unlockAccounts(tokenHolder);
    var tokenAddress = "0x57a204aa1042f6e66dd7730813f4024114d74f37"

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

    var tx = await wrapper.methods
      .mint(
        Array(tokenList.length).fill(
          tokenAddress
        ),
        tokenList,
        receivers
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash)).logs;
    // TODO: assert balance

    var itemIds = logs
      .filter(
        (it) =>
          it.topics[0] === web3.utils.sha3("Token(address,uint256,uint256)")
      )
      .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

    await wrapper.methods.safeTransferFrom(accounts[1], accounts[2], itemIds[0], "400000000000000000", "0x").send(blockchainConnection.getSendingOptions({from: accounts[1]}));

    // TODO: assert balance

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

    console.log(await wrapper.methods
      .balanceOf(accounts[1], itemIds[0])
      .call());

    await wrapper.methods
      .burn(
        accounts[1],
        itemIds[0],
        await wrapper.methods
          .balanceOf(accounts[1], itemIds[0])
          .call(),
        burn1
      )
      .send(
        blockchainConnection.getSendingOptions({ from: accounts[1] })
      );

      await mainToken.methods
          .approve(wrapper.options.address, tokenList[0])
          .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));


      var tx = await wrapper.methods
      .mint(
        Array(tokenList.length).fill(
          "0x57a204aa1042f6e66dd7730813f4024114d74f37"
        ),
        tokenList,
        receivers
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

      assert.equal(await wrapper.methods
      .balanceOf(accounts[1], itemIds[0])
      .call(), "600000000000000000");
  })

  it("scenario2 ", async () => {
    tokenHolder = "0x721931508df2764fd4f70c53da646cb8aed16ace";
    await blockchainConnection.unlockAccounts(tokenHolder);
    var tokenAddress = "0x57a204aa1042f6e66dd7730813f4024114d74f37"

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

    var tx = await wrapper.methods
      .mint(
        Array(tokenList.length).fill(
          tokenAddress
        ),
        tokenList,
        receivers
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash)).logs;
    // TODO: assert balance

    var itemIds = logs
      .filter(
        (it) =>
          it.topics[0] === web3.utils.sha3("Token(address,uint256,uint256)")
      )
      .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

    await wrapper.methods.safeTransferFrom(accounts[1], accounts[2], itemIds[0], "500000000000000000", "0x").send(blockchainConnection.getSendingOptions({from: accounts[1]}));

    // TODO: assert balance

    var burn1 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes", "bool", "bool"],
      [
        tokenAddress,
        tokenList[0],
        accounts[1],
        "0x",
        false,
        false,
      ]
    );

    assert.equal(await wrapper.methods
      .balanceOf(accounts[1], itemIds[0])
      .call(), "500000000000000000");

    await wrapper.methods
      .burn(
        accounts[1],
        itemIds[0],
        await wrapper.methods
          .balanceOf(accounts[1], itemIds[0])
          .call(),
        burn1
      )
      .send(
        blockchainConnection.getSendingOptions({ from: accounts[1] })
      );
  })

  it("#scenario3", async () => {
    tokenHolder = "0x721931508df2764fd4f70c53da646cb8aed16ace";
    await blockchainConnection.unlockAccounts(tokenHolder);
    var tokenAddress = "0x57a204aa1042f6e66dd7730813f4024114d74f37"

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

    var tx = await wrapper.methods
      .mint(
        Array(tokenList.length).fill(
          tokenAddress
        ),
        tokenList,
        receivers
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash)).logs;
    // TODO: assert balance

    var itemIds = logs
      .filter(
        (it) =>
          it.topics[0] === web3.utils.sha3("Token(address,uint256,uint256)")
      )
      .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

    await wrapper.methods.safeTransferFrom(accounts[1], accounts[2], itemIds[0], "490000000000000000", "0x").send(blockchainConnection.getSendingOptions({from: accounts[1]}));

    // TODO: assert balance

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

    console.log(await wrapper.methods
      .balanceOf(accounts[1], itemIds[0])
      .call());

    await wrapper.methods
      .burn(
        accounts[1],
        itemIds[0],
        await wrapper.methods
          .balanceOf(accounts[1], itemIds[0])
          .call(),
        burn1
      )
      .send(
        blockchainConnection.getSendingOptions({ from: accounts[1] })
      );

      await mainToken.methods
          .approve(wrapper.options.address, tokenList[0])
          .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));


      var tx = await wrapper.methods
      .mint(
        Array(tokenList.length).fill(
          "0x57a204aa1042f6e66dd7730813f4024114d74f37"
        ),
        tokenList,
        receivers
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

      assert.equal(await wrapper.methods
      .balanceOf(accounts[1], itemIds[0])
      .call(), "510000000000000000");
  })


  it("scenario4 ", async () => {
    tokenHolder = "0x721931508df2764fd4f70c53da646cb8aed16ace";
    await blockchainConnection.unlockAccounts(tokenHolder);
    var tokenAddress = "0x57a204aa1042f6e66dd7730813f4024114d74f37"

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

    var tx = await wrapper.methods
      .mint(
        Array(tokenList.length).fill(
          tokenAddress
        ),
        tokenList,
        receivers
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash)).logs;
    // TODO: assert balance

    var itemIds = logs
      .filter(
        (it) =>
          it.topics[0] === web3.utils.sha3("Token(address,uint256,uint256)")
      )
      .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

      await wrapper.methods.safeTransferFrom(accounts[1], accounts[2], itemIds[0], "300000000000000000", "0x").send(blockchainConnection.getSendingOptions({from: accounts[1]}));
      await wrapper.methods.safeTransferFrom(accounts[1], accounts[3], itemIds[0], "300000000000000000", "0x").send(blockchainConnection.getSendingOptions({from: accounts[1]}));

    // TODO: assert balance

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

    console.log(await wrapper.methods
      .balanceOf(accounts[1], itemIds[0])
      .call());

    await wrapper.methods
      .burn(
        accounts[1],
        itemIds[0],
        await wrapper.methods
          .balanceOf(accounts[1], itemIds[0])
          .call(),
        burn1
      )
      .send(
        blockchainConnection.getSendingOptions({ from: accounts[1] })
      );
  })

});
