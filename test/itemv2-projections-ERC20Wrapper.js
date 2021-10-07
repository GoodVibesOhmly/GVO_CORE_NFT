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
  var wethToken;
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
    var amounts = [uniAmounts, daiAmounts, ethAmount];
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

    var itemIds = await wrapperResource.mintErc20Wrapper(wrapper, [uniToken.options.address,daiToken.options.address,utilities.voidEthereumAddress,],[[uniAmounts], [daiAmounts], [ethAmount]],[[accounts[1]], [accounts[1]], [accounts[1]]], accounts[1], ethAmount);

    await Promise.all(itemIds.map(async(item, index) => {
      assert.equal(await wrapper.methods.balanceOf(accounts[1], item).call(), amounts[index])
      assert.equal(await wrapper.methods.decimals(item).call(), "18");
    }))

  });
});
