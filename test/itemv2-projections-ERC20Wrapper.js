const blockchainConnection = require("../util/blockchainConnection");
var utilities = require("../util/utilities");
var itemsv2 = require("../resources/itemsv2");
var wrapperResource = require("../resources/wrapper");
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

    await Promise.all(
      itemsList[0].account.map(async (acc, i) => {
        acc = acc == utilities.voidEthereumAddress ? accounts[1] : acc;
        var burn = web3.eth.abi.encodeParameters(
          ["address", "address"],
          [itemsList[0].tokenAddress, accounts[i]]
        );
        var prevBal = await uniToken.methods.balanceOf(accounts[i]).call();
        await wrapper.methods
          .burn(acc, itemsList[0].itemId, "1000000000000000000", burn)
          .send(blockchainConnection.getSendingOptions({ from: acc }));
        assert.equal(
          await uniToken.methods.balanceOf(accounts[i]).call(),
          prevBal.add("1000000000000000000")
        );
      })
    );

    await Promise.all(
      itemsList[1].account.map(async (acc, i) => {
        acc = acc == utilities.voidEthereumAddress ? accounts[1] : acc;
        var burn = web3.eth.abi.encodeParameters(
          ["address", "address"],
          [itemsList[1].tokenAddress, accounts[i]]
        );
        var prevBal = await daiToken.methods.balanceOf(accounts[i]).call();
        await wrapper.methods
          .burn(acc, itemsList[1].itemId, "1000000000000000000", burn)
          .send(blockchainConnection.getSendingOptions({ from: acc }));
        assert.equal(
          await daiToken.methods.balanceOf(accounts[i]).call(),
          prevBal.add("1000000000000000000")
        );
      })
    );

    await Promise.all(
      itemsList[2].account.map(async (acc, i) => {
        acc = acc == utilities.voidEthereumAddress ? accounts[1] : acc;
        var burn = web3.eth.abi.encodeParameters(
          ["address", "address"],
          [itemsList[2].tokenAddress, accounts[i]]
        );
        var prevBal = await web3.eth.getBalance(accounts[i]);
        await wrapper.methods
          .burn(acc, itemsList[2].itemId, itemsList[2].amounts[i].div(10), burn)
          .send(blockchainConnection.getSendingOptions({ from: acc }));
        assert.equal(
          await web3.eth.getBalance(accounts[i]),
          prevBal.add(itemsList[2].amounts[i].div(10))
        );
      })
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
    var amounts = [];
    await Promise.all(
      itemsList.slice(0, 3).map(async (item, index) => {
        await Promise.all(
          item.account.map(async (am, i) => {
            amounts.push("100000000");
          })
        );
      })
    );

    var burn = [];

    await Promise.all(
      itemsList.slice(0, 3).map(async (item, index) => {
        await Promise.all(
          item.account.map(async (acc, i) => {
            burn.push(
              web3.eth.abi.encodeParameters(
                ["address", "uint256"],
                [item.tokenAddress, accounts[index]]
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
                  .balanceOf(accounts[index])
                  .call()
              : await web3.eth.getBalance(accounts[index]);
          })
        );
      })
    );

    var datas = web3.eth.abi.encodeParameters(["bytes[]"], [burn]);

    await wrapper.methods
      .burnBatch(accounts[7], items, amounts, datas)
      .send(blockchainConnection.getSendingOptions({ from: accounts[7] }));

    await Promise.all(
      itemsList.slice(0, 3).map(async (item, index) => {
        await Promise.all(
          item.account.map(async (am, i) => {
            item.tokenName != "ETH"
              ? assert.equal(
                  await tokenContractList[index].methods
                    .balanceOf(accounts[index])
                    .call(),
                  prevBal[index][i].add("200000000")
                )
              : assert.equal(
                  await web3.eth.getBalance(accounts[index]),
                  prevBal[index][i].add("200000000")
                );
          })
        );
      })
    );
  });
});
