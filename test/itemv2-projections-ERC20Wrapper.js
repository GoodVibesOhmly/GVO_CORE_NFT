const blockchainConnection = require("../util/blockchainConnection");
var utilities = require("../util/utilities");
var itemsv2 = require("../resources/itemsv2");
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

    var daiAmounts = (await daiToken.methods.balanceOf(accounts[1]).call()).div(2)
    console.log(daiAmounts)
    console.log(await daiToken.methods.balanceOf(accounts[1]).call());
    await daiToken.methods.approve(
      wrapper.options.address,
      await daiToken.methods.balanceOf(accounts[1]).call()
    );

    console.log(await uniToken.methods.balanceOf(accounts[1]).call());
    await uniToken.methods.approve(
      wrapper.options.address,
      await uniToken.methods.balanceOf(accounts[1]).call()
    );
    //TODO: controlla balance erc20
    var tx = await wrapper.methods
      .mint(
        [uniToken.options.address],
        [
          [(await uniToken.methods.balanceOf(accounts[1]).call()).div(2)],
        ],
        [[accounts[1]]]
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    // TODO: controlla balance item
    var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash)).logs;

    var itemIds = logs
      .filter(
        (it) =>
          it.topics[0] === web3.utils.sha3("Token(address,uint256,uint256)")
      )
      .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));
  });
});
