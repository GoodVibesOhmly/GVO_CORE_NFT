const blockchainConnection = require("../util/blockchainConnection");
var utilities = require("../util/utilities");
var itemsv2 = require("../resources/itemsv2");
var wrapperResource = require("../resources/wrapper");
const { calculateTransactionFee } = require("../util/blockchainConnection");
describe("itemv2 projections ERC20Wrapper", () => {
  var wrapper;
  var MainInterface;
  var mainInterface;
  var ItemInteroperableInterface;
  var itemInteroperableInterface;
  var uniToken;
  var daiToken;
  var usdcToken;
  var wethToken;
  var hexToken;
  var celToken;
  var fegToken;
  var osToken;
  var erc20Contract;
  var erc20Contract1;
  var osErc20Contract;
  var host = "0xf1fced5b0475a935b49b95786adbda2d40794d2d";
  var itemInteroperableInterfaceAddress;
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
    uniToken = new web3.eth.Contract(
      knowledgeBase.IERC20ABI,
      knowledgeBase.uniTokenAddress
    );
    daiToken = new web3.eth.Contract(
      knowledgeBase.IERC20ABI,
      knowledgeBase.daiTokenAddress
    );
    wethToken = new web3.eth.Contract(
      knowledgeBase.IERC20ABI,
      knowledgeBase.wethTokenAddress
    );
    usdcToken = new web3.eth.Contract(
      knowledgeBase.IERC20ABI,
      knowledgeBase.usdcTokenAddress
    );
    hexToken = new web3.eth.Contract(
      knowledgeBase.IERC20ABI,
      knowledgeBase.hexTokenAddress
    );
    celToken = new web3.eth.Contract(
      knowledgeBase.IERC20ABI,
      knowledgeBase.celTokenAddress
    );
    fegToken = new web3.eth.Contract(
      knowledgeBase.IERC20ABI,
      knowledgeBase.fegTokenAddress
    );
    osToken = new web3.eth.Contract(
      knowledgeBase.IERC20ABI,
      knowledgeBase.osTokenAddress
    );
    await blockchainConnection.unlockAccounts(host);
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

    var ERC20Wrapper = await compile("projection/ERC20/ERC20Wrapper");
    wrapper = await new web3.eth.Contract(ERC20Wrapper.abi)
      .deploy({ data: ERC20Wrapper.bin, arguments: ["0x"] })
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

  it("#659 Wrap ERC20 (18 decimals) and ETH", async () => {
    await buyForETH(daiToken, 2, accounts[1]);
    await buyForETH(uniToken, 2, accounts[1]);

    var daiAmounts = (await daiToken.methods.balanceOf(accounts[1]).call()).div(
      2
    );
    var uniAmounts = (await uniToken.methods.balanceOf(accounts[1]).call()).div(
      2
    );
    var ethAmount = "1000000000000000000";
    var totalAmounts = [
      [uniAmounts, uniAmounts],
      [daiAmounts, daiAmounts],
      [ethAmount.div(2), ethAmount.div(2)],
    ];
    var receivers = [
      [accounts[2], utilities.voidEthereumAddress],
      [accounts[1], accounts[3]],
      [accounts[4], accounts[5]],
    ];
    var tokenAddress = [
      uniToken.options.address,
      daiToken.options.address,
      utilities.voidEthereumAddress,
    ];
    var tokenName = ["UNI", "DAI", "ETH"];
    await daiToken.methods
      .approve(
        wrapper.options.address,
        await daiToken.methods.balanceOf(accounts[1]).call()
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    await uniToken.methods
      .approve(
        wrapper.options.address,
        await uniToken.methods.balanceOf(accounts[1]).call()
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var res = await wrapperResource.mintErc20Wrapper(
      wrapper,
      tokenAddress,
      totalAmounts,
      receivers,
      accounts[1],
      ethAmount
    );

    var itemIds = res["itemIds"];

    await Promise.all(
      itemIds.map(async (id, index) => {
        itemsList.push({
          tokenName: tokenName[index],
          tokenAddress: tokenAddress[index],
          account: receivers[index],
          itemId: id,
          amounts: totalAmounts[index],
        });
      })
    );

    await wrapperResource.assertDecimals(wrapper, itemIds);

    await wrapperResource.assertCheckErc20ItemBalance(
      wrapper,
      receivers,
      itemIds,
      totalAmounts
    );
  });

  it("#660 Wrap ERC20 (decimals different from 18)", async () => {
    await buyForETH(usdcToken, 2, accounts[1]);
    await buyForETH(hexToken, 2, accounts[1]);
    await buyForETH(celToken, 2, accounts[1]);

    var usdcAmounts = (
      await usdcToken.methods.balanceOf(accounts[1]).call()
    ).div(2);
    var hexAmounts = (await hexToken.methods.balanceOf(accounts[1]).call()).div(
      2
    );
    var celAmounts = (await celToken.methods.balanceOf(accounts[1]).call()).div(
      2
    );
    var totalAmounts = [
      [usdcAmounts, usdcAmounts],
      [hexAmounts, hexAmounts],
      [celAmounts, celAmounts],
    ];
    var receivers = [
      [accounts[2], utilities.voidEthereumAddress],
      [accounts[1], accounts[3]],
      [accounts[4], accounts[5]],
    ];
    var tokenAddress = [
      usdcToken.options.address,
      hexToken.options.address,
      celToken.options.address,
    ];
    var tokenName = ["USDC", "HEX", "CEL"];

    var tokenDecimal = [6, 8, 4];
    await usdcToken.methods
      .approve(
        wrapper.options.address,
        await usdcToken.methods.balanceOf(accounts[1]).call()
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    await hexToken.methods
      .approve(
        wrapper.options.address,
        await hexToken.methods.balanceOf(accounts[1]).call()
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    await celToken.methods
      .approve(
        wrapper.options.address,
        await celToken.methods.balanceOf(accounts[1]).call()
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var res = await wrapperResource.mintErc20Wrapper(
      wrapper,
      tokenAddress,
      totalAmounts,
      receivers,
      accounts[1]
    );

    var itemIds = res["itemIds"];

    await Promise.all(
      itemIds.map(async (id, index) => {
        itemsList.push({
          tokenName: tokenName[index],
          tokenAddress: tokenAddress[index],
          account: receivers[index],
          itemId: id,
          amounts: totalAmounts[index],
        });
      })
    );

    await wrapperResource.assertDecimals(wrapper, itemIds);

    totalAmounts = await Promise.all(
      totalAmounts.map(async (amount, index) => {
        return await Promise.all(
          amount.map(async (am, ind) => {
            return utilities.normalizeValue(am, tokenDecimal[index]);
          })
        );
      })
    );

    await wrapperResource.assertCheckErc20ItemBalance(
      wrapper,
      receivers,
      itemIds,
      totalAmounts
    );
  });

  it("#661 Wrap ERC20 (Item Interoperable)", async () => {
    var prev = "2000000000000000000";
    await osToken.methods
    .transfer(accounts[1], prev)
    .send(blockchainConnection.getSendingOptions({ from: host }));

    var totalAmounts = [[prev]];
    var receivers = [[accounts[1]]];
    var tokenAddress = [osToken.options.address];
    var tokenName = ["Os"];

    await osToken.methods
      .approve(
        wrapper.options.address,
        await osToken.methods.balanceOf(accounts[1]).call()
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var res = await wrapperResource.mintErc20Wrapper(
      wrapper,
      tokenAddress,
      totalAmounts,
      receivers,
      accounts[1]
    );

    var osItemId = res["itemIds"];

    await wrapperResource.assertDecimals(wrapper, osItemId);

    await wrapperResource.assertCheckErc20ItemBalance(
      wrapper,
      receivers,
      osItemId,
      totalAmounts
    );

    osErc20Contract = await asInteroperableInterface(osItemId[0]);

    var item = [];

    var res = await itemsv2.createCollection(accounts[1], item);
    var collectionId = res["collectionId"];

    var CreateItem = [
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
          name: "Item2",
          symbol: "I2",
          uri: "uriItem2",
        },
        collectionId: collectionId,
        id: 0,
        accounts: [accounts[1]],
        amounts: ["10000000000000000"],
      }
    ];

    var mintItem = await mainInterface.methods
      .mintItems(CreateItem)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    var idItems = mintItem.events.CollectionItem.map(
      (event) => event.returnValues["itemId"]
    );
    erc20Contract = await asInteroperableInterface(idItems[0]);
    erc20Contract1 = await asInteroperableInterface(idItems[1]);

    var totalAmounts = [
      ["1000000000000", "3000000000000000"],
      ["10000000000000", "200000000000000"],
      ["5000000000000000", "5000000000000000"],
    ];
    var receivers = [
      [accounts[2], utilities.voidEthereumAddress],
      [accounts[1], accounts[3]],
      [accounts[4], accounts[5]],
    ];
    var tokenAddress = [
      erc20Contract.options.address,
      erc20Contract1.options.address,
      osErc20Contract.options.address,
    ];
    var tokenName = ["interoperable", "interoperable1", "OS"];

    await erc20Contract.methods
      .approve(
        wrapper.options.address,
        await erc20Contract.methods.balanceOf(accounts[1]).call()
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    await erc20Contract1.methods
      .approve(
        wrapper.options.address,
        await erc20Contract1.methods.balanceOf(accounts[1]).call()
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    await osErc20Contract.methods
      .approve(
        wrapper.options.address,
        await osErc20Contract.methods.balanceOf(accounts[1]).call()
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var res = await wrapperResource.mintErc20Wrapper(
      wrapper,
      tokenAddress,
      totalAmounts,
      receivers,
      accounts[1]
    );

    var itemIds = res["itemIds"];

    await Promise.all(
      itemIds.concat(osItemId).map(async (id, index) => {
        itemsList.push({
          tokenName: tokenName[index],
          tokenAddress: tokenAddress[index],
          account: receivers[index],
          itemId: id,
          amounts: totalAmounts[index],
        });
      })
    );

    await wrapperResource.assertDecimals(wrapper, itemIds);

    await wrapperResource.assertCheckErc20ItemBalance(
      wrapper,
      receivers,
      itemIds,
      totalAmounts
    );
  });

  it("#662 Wrap ERC20 (deflationary token)", async () => {
    await buyForETH(fegToken, 2, accounts[1]);

    var fegAmounts = (await fegToken.methods.balanceOf(accounts[1]).call()).div(
      2
    );

    var totalAmounts = [[fegAmounts, fegAmounts]];
    var receivers = [[accounts[2], utilities.voidEthereumAddress]];
    var tokenAddress = [fegToken.options.address];
    var tokenDecimal = [9];
    var tokenName = ["FEG"];

    await fegToken.methods
      .approve(
        wrapper.options.address,
        await fegToken.methods.balanceOf(accounts[1]).call()
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var itemIds = await wrapperResource.revertMintErc20Wrapper(
      wrapper,
      tokenAddress,
      totalAmounts,
      receivers,
      accounts[1]
    );

    totalAmounts = [[fegAmounts]];
    receivers = [[accounts[2]]];
    tokenAddress = [fegToken.options.address];
    await fegToken.methods
      .approve(
        wrapper.options.address,
        await fegToken.methods.balanceOf(accounts[1]).call()
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var res = await wrapperResource.mintErc20Wrapper(
      wrapper,
      tokenAddress,
      totalAmounts,
      receivers,
      accounts[1]
    );

    var itemIds = res["itemIds"];

    await Promise.all(
      itemIds.map(async (id, index) => {
        itemsList.push({
          tokenName: tokenName[index],
          tokenAddress: tokenAddress[index],
          account: receivers[index],
          itemId: id,
          amounts: totalAmounts[index],
        });
      })
    );

    var tx = res["tx"];
    var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash)).logs;
    var deflAmount = web3.eth.abi.decodeParameter(
      "uint256",
      logs.filter(
        (it) =>
          it.topics[0] === web3.utils.sha3("Transfer(address,address,uint256)")
      )[1].data
    );

    totalAmounts = await Promise.all(
      totalAmounts.map(async (amount, index) => {
        return await Promise.all(
          amount.map(async (am, ind) => {
            return utilities.normalizeValue(am, 9);
          })
        );
      })
    );

    await wrapperResource.assertDecimals(wrapper, itemIds);
    totalAmounts = [[deflAmount]];
    await wrapperResource.assertCheckErc20ItemBalance(
      wrapper,
      receivers,
      itemIds,
      totalAmounts
    );
    console.log(itemsList);
  });

  it("#663 Unwrap ERC20 (18 decimals) and ETH", async () => {
    var tokenContractList = [uniToken, daiToken];

    var acc =
      itemsList[0].account[0] == utilities.voidEthereumAddress
        ? accounts[1]
        : itemsList[0].account[0];
    var burnAmounts = ["100000000000000", "20000000000000", "1000000000"];
    var burn = web3.eth.abi.encodeParameters(
      ["address", "address"],
      [itemsList[0].tokenAddress, accounts[6]]
    );
    var prevBal = await uniToken.methods.balanceOf(accounts[6]).call();
    var prevSupply = await wrapper.methods
      .totalSupply(itemsList[0].itemId)
      .call();
    await wrapper.methods
      .burn(acc, itemsList[0].itemId, burnAmounts[0], burn)
      .send(blockchainConnection.getSendingOptions({ from: acc }));
    assert.equal(
      prevSupply.sub(burnAmounts[0]),
      await wrapper.methods.totalSupply(itemsList[0].itemId).call()
    );
    assert.equal(
      await uniToken.methods.balanceOf(accounts[6]).call(),
      prevBal.add(burnAmounts[0])
    );

    var acc =
      itemsList[1].account[0] == utilities.voidEthereumAddress
        ? accounts[1]
        : itemsList[1].account[0];
    var burn = web3.eth.abi.encodeParameters(
      ["address", "address"],
      [itemsList[1].tokenAddress, utilities.voidEthereumAddress]
    );
    var prevBal = await daiToken.methods.balanceOf(acc).call();
    await mainInterface.methods
      .approve(acc, accounts[9], "1000000000000000000", itemsList[1].itemId)
      .send(blockchainConnection.getSendingOptions({ from: acc }));
    var prevSupply = await wrapper.methods
      .totalSupply(itemsList[1].itemId)
      .call();
    await wrapper.methods
      .burn(acc, itemsList[1].itemId, "100000000000000", burn)
      .send(blockchainConnection.getSendingOptions({ from: accounts[9] }));
    assert.equal(
      prevSupply.sub("100000000000000"),
      await wrapper.methods.totalSupply(itemsList[1].itemId).call()
    );
    assert.equal(
      await daiToken.methods.balanceOf(acc).call(),
      prevBal.add("100000000000000")
    );

    acc =
      acc == utilities.voidEthereumAddress
        ? accounts[1]
        : itemsList[2].account[0];
    var burn = web3.eth.abi.encodeParameters(
      ["address", "address"],
      [itemsList[2].tokenAddress, utilities.voidEthereumAddress]
    );
    var prevBal = await web3.eth.getBalance(acc);
    console.log(prevBal);
    console.log(await web3.eth.getBalance(accounts[10]));
    var tx = await wrapper.methods
      .burn(acc, itemsList[2].itemId, burnAmounts[2], burn)
      .send(blockchainConnection.getSendingOptions({ from: acc }));
    assert.equal(
      await web3.eth.getBalance(acc),
      prevBal.add(burnAmounts[2]).sub(await calculateTransactionFee(tx))
    );

    await Promise.all(
      itemsList.slice(0, 3).map(async (item, index) => {
        await Promise.all(
          item.account.map(async (acc, i) => {
            acc = acc == utilities.voidEthereumAddress ? accounts[1] : acc;
            await wrapper.methods
              .safeTransferFrom(
                acc,
                accounts[7],
                item.itemId,
                await wrapper.methods.balanceOf(acc, item.itemId).call(),
                "0x"
              )
              .send(blockchainConnection.getSendingOptions({ from: acc }));
          })
        );
      })
    );

    var items = [];
    await Promise.all(
      itemsList.slice(0, 3).map(async (item, index) => {
        await Promise.all(
          item.amounts.map((am, i) => {
            items.push(item.itemId);
          })
        );
      })
    );
    var amounts = [
      ["100000000", "300000000"],
      ["2000000000", "100000000"],
      ["100000000", "3000000000"],
    ];

    var batchAmounts = [
      "100000000",
      "300000000",
      "2000000000",
      "100000000",
      "100000000",
      "3000000000",
    ];

    var batchReceivers = [
      [accounts[0], utilities.voidEthereumAddress],
      [accounts[2], accounts[3]],
      [accounts[4], accounts[5]],
    ];

    var burn = [];

    await Promise.all(
      itemsList.slice(0, 3).map(async (item, index) => {
        await Promise.all(
          item.account.map(async (acc, i) => {
            burn.push(
              web3.eth.abi.encodeParameters(
                ["address", "uint256"],
                [item.tokenAddress, batchReceivers[index][i]]
              )
            );
          })
        );
      })
    );

    var prevBal = await Promise.all(
      itemsList.slice(0, 3).map(async (item, index) => {
        return await Promise.all(
          item.account.map(async (am, i) => {
            return item.tokenName != "ETH"
              ? await tokenContractList[index].methods
                  .balanceOf(
                    batchReceivers[index][i] == utilities.voidEthereumAddress
                      ? accounts[7]
                      : batchReceivers[index][i]
                  )
                  .call()
              : await web3.eth.getBalance(
                  batchReceivers[index][i] == utilities.voidEthereumAddress
                    ? accounts[7]
                    : batchReceivers[index][i]
                );
          })
        );
      })
    );

    var datas = web3.eth.abi.encodeParameters(["bytes[]"], [burn]);

    var previousTotalSupply = await Promise.all(
      itemsList.slice(0, 3).map(async (item, index) => {
        return await wrapper.methods.totalSupply(item.itemId).call();
      })
    );

    var tx = await wrapper.methods
      .burnBatch(accounts[7], items, batchAmounts, datas)
      .send(blockchainConnection.getSendingOptions({ from: accounts[7] }));

    await Promise.all(
      itemsList.slice(0, 3).map(async (item, index) => {
        assert.equal(
          await wrapper.methods.totalSupply(item.itemId).call(),
          previousTotalSupply[index].sub(
            amounts[index].reduce((total, arg) => total.add(arg), 0)
          )
        );
      })
    );

    await Promise.all(
      itemsList.slice(0, 3).map(async (item, index) => {
        await Promise.all(
          item.account.map(async (am, i) => {
            item.tokenName != "ETH"
              ? assert.equal(
                  await tokenContractList[index].methods
                    .balanceOf(
                      batchReceivers[index][i] == utilities.voidEthereumAddress
                        ? accounts[7]
                        : batchReceivers[index][i]
                    )
                    .call(),
                  prevBal[index][i].add(amounts[index][i])
                )
              : assert.equal(
                  await web3.eth.getBalance(
                    batchReceivers[index][i] == utilities.voidEthereumAddress
                      ? accounts[7]
                      : batchReceivers[index][i]
                  ),
                  prevBal[index][i].add(amounts[index][i])
                );
          })
        );
      })
    );
  });

  it("#664 Unwrap ERC20 (decimals different from 18)", async () => {
    var tokenContractList = [usdcToken, hexToken, celToken];
    var tokenDecDiff = [1e12, 1e10, 1e14];
    var catchCallAmount = [1e11, 1e9, 1e13]
    // USDC
    var acc =
      itemsList[3].account[0] == utilities.voidEthereumAddress
        ? accounts[1]
        : itemsList[3].account[0];
    var burn = web3.eth.abi.encodeParameters(
      ["address", "address"],
      [itemsList[3].tokenAddress, accounts[6]]
    );
    var prevBal = await usdcToken.methods.balanceOf(accounts[6]).call();
    var prevSupply = await wrapper.methods
      .totalSupply(itemsList[3].itemId)
      .call();
    await wrapper.methods
      .burn(acc, itemsList[3].itemId, "100000000000000000", burn)
      .send(blockchainConnection.getSendingOptions({ from: acc }));
    assert.equal(
      prevSupply.sub("100000000000000000"),
      await wrapper.methods.totalSupply(itemsList[3].itemId).call()
    );
    assert.equal(
      await usdcToken.methods.balanceOf(accounts[6]).call(),
      prevBal.add("100000000000000000".div(tokenDecDiff[0]))
    );

    // USDC catchCall
    var acc =
      itemsList[3].account[0] == utilities.voidEthereumAddress
        ? accounts[1]
        : itemsList[3].account[0];
    var burn = web3.eth.abi.encodeParameters(
      ["address", "address"],
      [itemsList[3].tokenAddress, accounts[6]]
    );
    var prevBal = await usdcToken.methods.balanceOf(accounts[6]).call();
    var prevSupply = await wrapper.methods
      .totalSupply(itemsList[3].itemId)
      .call();
    await catchCall(wrapper.methods
      .burn(acc, itemsList[3].itemId, catchCallAmount[0], burn)
      .send(blockchainConnection.getSendingOptions({ from: acc })), "Insufficient amount");

    // HEX catchCall
    var acc =
      itemsList[4].account[0] == utilities.voidEthereumAddress
        ? accounts[1]
        : itemsList[4].account[0];
    var burn = web3.eth.abi.encodeParameters(
      ["address", "address"],
      [itemsList[4].tokenAddress, accounts[6]]
    );
    var prevBal = await usdcToken.methods.balanceOf(accounts[6]).call();
    var prevSupply = await wrapper.methods
      .totalSupply(itemsList[4].itemId)
      .call();
    await catchCall(wrapper.methods
      .burn(acc, itemsList[4].itemId, catchCallAmount[1], burn)
      .send(blockchainConnection.getSendingOptions({ from: acc })), "Insufficient amount");

    // CEL catchCall
    var acc =
      itemsList[5].account[0] == utilities.voidEthereumAddress
        ? accounts[1]
        : itemsList[5].account[0];
    var burn = web3.eth.abi.encodeParameters(
      ["address", "address"],
      [itemsList[5].tokenAddress, accounts[6]]
    );
    var prevBal = await usdcToken.methods.balanceOf(accounts[6]).call();
    var prevSupply = await wrapper.methods
      .totalSupply(itemsList[5].itemId)
      .call();
    await catchCall(wrapper.methods
      .burn(acc, itemsList[5].itemId, catchCallAmount[2], burn)
      .send(blockchainConnection.getSendingOptions({ from: acc })), "Insufficient amount");


    await Promise.all(
      itemsList.slice(3, 6).map(async (item, index) => {
        await Promise.all(
          item.account.map(async (acc, i) => {
            acc = acc == utilities.voidEthereumAddress ? accounts[1] : acc;
            await wrapper.methods
              .safeTransferFrom(
                acc,
                accounts[7],
                item.itemId,
                await wrapper.methods.balanceOf(acc, item.itemId).call(),
                "0x"
              )
              .send(blockchainConnection.getSendingOptions({ from: acc }));
          })
        );
      })
    );

    var items = [];
    await Promise.all(
      itemsList.slice(3, 6).map(async (item, index) => {
        await Promise.all(
          item.amounts.map((am, i) => {
            items.push(item.itemId);
          })
        );
      })
    );
    var amounts = [
      ["100000000000000000", "300000000000000000"],
      ["200000000000000000", "10000000000000000"],
      ["20000000000000000", "300000000000000000"],
    ];

    var batchAmounts = [
      "100000000000000000",
      "300000000000000000",
      "200000000000000000",
      "10000000000000000",
      "20000000000000000",
      "300000000000000000",
    ];

    catchCallAmounts = [
      1e11, 1e11, 
      1e9, 1e9, 
      1e13, 1e13
    ]

    var batchReceivers = [
      [accounts[0], utilities.voidEthereumAddress],
      [accounts[2], accounts[3]],
      [accounts[4], accounts[5]],
    ];

    var burn = [];

    await Promise.all(
      itemsList.slice(3, 6).map(async (item, index) => {
        await Promise.all(
          item.account.map(async (acc, i) => {
            burn.push(
              web3.eth.abi.encodeParameters(
                ["address", "uint256"],
                [item.tokenAddress, batchReceivers[index][i]]
              )
            );
          })
        );
      })
    );

    var prevBal = await Promise.all(
      itemsList.slice(3, 6).map(async (item, index) => {
        return await Promise.all(
          item.account.map(async (am, i) => {
            return item.tokenName != "ETH"
              ? await tokenContractList[index].methods
                  .balanceOf(
                    batchReceivers[index][i] == utilities.voidEthereumAddress
                      ? accounts[7]
                      : batchReceivers[index][i]
                  )
                  .call()
              : await web3.eth.getBalance(
                  batchReceivers[index][i] == utilities.voidEthereumAddress
                    ? accounts[7]
                    : batchReceivers[index][i]
                );
          })
        );
      })
    );

    var datas = web3.eth.abi.encodeParameters(["bytes[]"], [burn]);

    var previousTotalSupply = await Promise.all(
      itemsList.slice(3, 6).map(async (item, index) => {
        return await wrapper.methods.totalSupply(item.itemId).call();
      })
    );

    console.log(items);

    await wrapper.methods
      .burnBatch(accounts[7], items, batchAmounts, datas)
      .send(blockchainConnection.getSendingOptions({ from: accounts[7] }));

    await catchCall(wrapper.methods
      .burnBatch(accounts[7], items, catchCallAmounts, datas)
      .send(blockchainConnection.getSendingOptions({ from: accounts[7] })), "Insufficient amount")

    await Promise.all(
      itemsList.slice(3, 6).map(async (item, index) => {
        assert.equal(
          await wrapper.methods.totalSupply(item.itemId).call(),
          previousTotalSupply[index].sub(
            amounts[index].reduce((total, arg) => total.add(arg), 0)
          )
        );
      })
    );

    await Promise.all(
      itemsList.slice(3, 6).map(async (item, index) => {
        await Promise.all(
          item.account.map(async (am, i) => {
            console.log(item)
            console.log(amounts[index][i])
            console.log(tokenDecDiff[index])
            item.tokenName != "ETH"
              ? assert.equal(
                  await tokenContractList[index].methods
                    .balanceOf(
                      batchReceivers[index][i] == utilities.voidEthereumAddress
                        ? accounts[7]
                        : batchReceivers[index][i]
                    )
                    .call(),
                  prevBal[index][i].add(amounts[index][i] / tokenDecDiff[index])
                )
              : assert.equal(
                  await web3.eth.getBalance(
                    batchReceivers[index][i] == utilities.voidEthereumAddress
                      ? accounts[7]
                      : batchReceivers[index][i]
                  ),
                  prevBal[index][i].add(amounts[index][i])
                );
          })
        );
      })
    );
  });

  it("#665 Unwrap ERC20 (Item Interoperable)", async () => {
    var tokenContractList = [erc20Contract, erc20Contract1, osErc20Contract];

    await Promise.all(
      itemsList.slice(6, 9).map(async (item, index) => {
        await Promise.all(
          item.account.map(async (acc, i) => {
            acc = acc == utilities.voidEthereumAddress ? accounts[1] : acc;
            await wrapper.methods
              .safeTransferFrom(
                acc,
                accounts[7],
                item.itemId,
                await wrapper.methods.balanceOf(acc, item.itemId).call(),
                "0x"
              )
              .send(blockchainConnection.getSendingOptions({ from: acc }));
          })
        );
      })
    );

    var items = [];
    await Promise.all(
      itemsList.slice(6, 9).map(async (item, index) => {
        await Promise.all(
          item.amounts.map((am, i) => {
            items.push(item.itemId);
          })
        );
      })
    );
    var amounts = [
      ["100000000", "300000000"],
      ["2000000000", "100000000"],
      ["100000000", "3000000000"],
    ];

    var batchAmounts = [
      "100000000",
      "300000000",
      "2000000000",
      "100000000",
      "100000000",
      "3000000000",
    ];

    var batchReceivers = [
      [accounts[0], utilities.voidEthereumAddress],
      [accounts[2], accounts[3]],
      [accounts[4], accounts[5]],
    ];

    var burn = [];

    await Promise.all(
      itemsList.slice(6, 9).map(async (item, index) => {
        await Promise.all(
          item.account.map(async (acc, i) => {
            burn.push(
              web3.eth.abi.encodeParameters(
                ["address", "uint256"],
                [item.tokenAddress, batchReceivers[index][i]]
              )
            );
          })
        );
      })
    );

    var prevBal = await Promise.all(
      itemsList.slice(6, 9).map(async (item, index) => {
        return await Promise.all(
          item.account.map(async (am, i) => {
            return item.tokenName != "ETH"
              ? await tokenContractList[index].methods
                  .balanceOf(
                    batchReceivers[index][i] == utilities.voidEthereumAddress
                      ? accounts[7]
                      : batchReceivers[index][i]
                  )
                  .call()
              : await web3.eth.getBalance(
                  batchReceivers[index][i] == utilities.voidEthereumAddress
                    ? accounts[7]
                    : batchReceivers[index][i]
                );
          })
        );
      })
    );

    var datas = web3.eth.abi.encodeParameters(["bytes[]"], [burn]);

    var previousTotalSupply = await Promise.all(
      itemsList.slice(6, 9).map(async (item, index) => {
        return await wrapper.methods.totalSupply(item.itemId).call();
      })
    );

    await wrapper.methods
      .burnBatch(accounts[7], items, batchAmounts, datas)
      .send(blockchainConnection.getSendingOptions({ from: accounts[7] }));

    await Promise.all(
      itemsList.slice(6, 9).map(async (item, index) => {
        assert.equal(
          await wrapper.methods.totalSupply(item.itemId).call(),
          previousTotalSupply[index].sub(
            amounts[index].reduce((total, arg) => total.add(arg), 0)
          )
        );
      })
    );

    await Promise.all(
      itemsList.slice(6, 9).map(async (item, index) => {
        await Promise.all(
          item.account.map(async (am, i) => {
            item.tokenName != "ETH"
              ? assert.equal(
                  await tokenContractList[index].methods
                    .balanceOf(
                      batchReceivers[index][i] == utilities.voidEthereumAddress
                        ? accounts[7]
                        : batchReceivers[index][i]
                    )
                    .call(),
                  prevBal[index][i].add(amounts[index][i])
                )
              : assert.equal(
                  await web3.eth.getBalance(
                    batchReceivers[index][i] == utilities.voidEthereumAddress
                      ? accounts[7]
                      : batchReceivers[index][i]
                  ),
                  prevBal[index][i].add(amounts[index][i])
                );
          })
        );
      })
    );
  });

  it("#666 Unwrap ERC20 (deflationary)", async () => {
    var tokenContractList = [usdcToken, hexToken, celToken];
    var tokenDec = [6, 8, 4];
    var tokenDecDiff = [12, 10, 14];

    var acc = itemsList[10].account[0] == utilities.voidEthereumAddress
        ? accounts[1]
        : itemsList[10].account[0];
    var burn = web3.eth.abi.encodeParameters(
      ["address", "address"],
      [itemsList[10].tokenAddress, accounts[6]]
    );
    var prevBal = await fegToken.methods.balanceOf(accounts[6]).call();
    var prevSupply = await wrapper.methods
      .totalSupply(itemsList[10].itemId)
      .call();
    var tx = await wrapper.methods
      .burn(acc, itemsList[10].itemId, "1000000000000000000", burn)
      .send(blockchainConnection.getSendingOptions({ from: acc }));

    var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash)).logs;
    var deflAmount = web3.eth.abi.decodeParameter(
      "uint256",
      logs.filter(
        (it) =>
          it.topics[0] === web3.utils.sha3("Transfer(address,address,uint256)")
      )[1].data
    );
    assert.equal(
      prevSupply.sub("1000000000000000000"),
      await wrapper.methods.totalSupply(itemsList[10].itemId).call()
    );
    assert.equal(
      await fegToken.methods.balanceOf(accounts[6]).call(),
      prevBal.add(deflAmount)
    );
  });

  it("#667 Testing some different unwrap scenarios with different balances using the Interoperable burn operation: Scenario1", async () => {
    var prev = "1000000000000000000";
    const prevBalance = await osToken.methods.balanceOf(accounts[1]).call();
    await osToken.methods
      .transfer(accounts[1], prev)
      .send(blockchainConnection.getSendingOptions({ from: host }));
    assert.equal(
      await osToken.methods.balanceOf(accounts[1]).call(),
      prevBalance.add(prev)
    );

    var totalAmounts = [[prev]];
    var receivers = [[accounts[1]]];
    var tokenAddress = [osToken.options.address];
    var tokenName = ["erc20"];

    await osToken.methods
      .approve(
        wrapper.options.address,
        await osToken.methods.balanceOf(accounts[1]).call()
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var res = await wrapperResource.mintErc20Wrapper(
      wrapper,
      tokenAddress,
      totalAmounts,
      receivers,
      accounts[1]
    );

    var itemIds = res["itemIds"];

    await wrapperResource.assertDecimals(wrapper, itemIds);

    await wrapperResource.assertCheckErc20ItemBalance(
      wrapper,
      receivers,
      itemIds,
      totalAmounts
    );

    erc20Contract = await asInteroperableInterface(itemIds[0]);

    await erc20Contract.methods
      .burn(prev.mul(80).div(100))
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
      assert.equal(
        prev.mul(20).div(100),
        await wrapper.methods.totalSupply(itemIds[0]).call()
      );
      assert.equal(
        prev.mul(20).div(100),
        await erc20Contract.methods.balanceOf(accounts[1]).call()
      );
    var burn = web3.eth.abi.encodeParameters(
      ["address", "address"],
      [osToken.options.address, accounts[6]]
    );
    await wrapper.methods
      .burn(accounts[1], itemIds[0], prev.mul(20).div(100), burn)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
      assert.equal(
        "0",
        await wrapper.methods.totalSupply(itemIds[0]).call()
      );
      assert.equal(
        "0",
        await erc20Contract.methods.balanceOf(accounts[1]).call()
      );
  });

  it("#667 Testing some different unwrap scenarios with different balances using the Interoperable burn operation: Scenario2", async () => {
    var prev = "1000000000000000000";
    const prevBalance = await osToken.methods.balanceOf(accounts[1]).call();
    await osToken.methods
      .transfer(accounts[1], "1000000000000000000")
      .send(blockchainConnection.getSendingOptions({ from: host }));
    assert.equal(
      await osToken.methods.balanceOf(accounts[1]).call(),
      prevBalance.add(prev)
    );

    var totalAmounts = [[prev]];
    var receivers = [[accounts[1]]];
    var tokenAddress = [osToken.options.address];
    var tokenName = ["Os"];

    await osToken.methods
      .approve(
        wrapper.options.address,
        await osToken.methods.balanceOf(accounts[1]).call()
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var res = await wrapperResource.mintErc20Wrapper(
      wrapper,
      tokenAddress,
      totalAmounts,
      receivers,
      accounts[1]
    );

    var itemIds = res["itemIds"];

    await wrapperResource.assertDecimals(wrapper, itemIds);

    await wrapperResource.assertCheckErc20ItemBalance(
      wrapper,
      receivers,
      itemIds,
      totalAmounts
    );

    erc20Contract = await asInteroperableInterface(itemIds[0]);

    assert.equal(
      await erc20Contract.methods.balanceOf(accounts[1]).call(),
      prev
    );
    assert.equal(await wrapper.methods.totalSupply(itemIds[0]).call(), prev);

    await erc20Contract.methods
      .burn(prev.mul(10).div(100))
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    assert.equal(
      prev.mul(90).div(100),
      await wrapper.methods.totalSupply(itemIds[0]).call()
    );
    assert.equal(
      prev.mul(90).div(100),
      await erc20Contract.methods.balanceOf(accounts[1]).call()
    );
    var burn = web3.eth.abi.encodeParameters(
      ["address", "address"],
      [osToken.options.address, accounts[6]]
    );
    await wrapper.methods
      .burn(accounts[1], itemIds[0], prev.div(2), burn)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    assert.equal(
      prev.mul(40).div(100),
      await wrapper.methods.totalSupply(itemIds[0]).call()
    );
    assert.equal(
      prev.mul(40).div(100),
      await erc20Contract.methods.balanceOf(accounts[1]).call()
    );
    await erc20Contract.methods
      .transferFrom(accounts[1], accounts[3], prev.mul(20).div(100))
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    assert.equal(
      prev.mul(20).div(100),
      await erc20Contract.methods.balanceOf(accounts[3]).call()
    );
    await wrapper.methods
      .burn(accounts[1], itemIds[0], prev.mul(20).div(100), burn)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    assert.equal(
      prev.mul(20).div(100),
      await wrapper.methods.totalSupply(itemIds[0]).call()
    );
    assert.equal(
      "0",
      await erc20Contract.methods.balanceOf(accounts[1]).call()
    );
  });
});
