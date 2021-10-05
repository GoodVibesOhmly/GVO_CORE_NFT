const utilities = require("../util/utilities");
var itemsv2 = require("../resources/itemsv2");
var itemProjection = require("../resources/itemProjection");
describe("itemv2 projections ERC721Wrapper", () => {
    
    async function buyForETH(token, amount, from) {
        var uniswapV2Router = new web3.eth.Contract(knowledgeBase.uniswapV2RouterABI, knowledgeBase.uniswapV2RouterAddress);
        var wethToken = new web3.eth.Contract(knowledgeBase.IERC20ABI, knowledgeBase.wethTokenAddress);
        var path = [
            wethToken.options.address,
            token.options.address
        ];
        var value = utilities.toDecimals(amount.toString(), '18');
        await uniswapV2Router.methods.swapExactETHForTokens("1", path, (from && (from.from || from)) || accounts[0], parseInt((new Date().getTime() / 1000) + 1000)).send(blockchainConnection.getSendingOptions({ from: (from && (from.from || from)) || accounts[0], value }));
    };

    before(async () => {
        var headerCollection = {
            host: accounts[1],
            name: "Colection1",
            symbol: "C1",
            uri: "uriC1",
          };
      
        var items = [];

        var nativeProjectionAddress = await itemsv2.deployNativeProjection();

        var deployParam = abi.encode(
            [
              "bytes32",
              "tuple(address,string,string,string)",
              "tuple(tuple(address,string,string,string),bytes32,uint256,address[],uint256[])[]",
              "bytes",
            ],
            [utilities.voidBytes32, await itemsv2.convertHeader(headerCollection), items, utilities.voidBytes32]
          );
      
          deployParam = abi.encode(
            ["address", "bytes"],
            [knowledgeBase.mainInterfaceAddress, deployParam]
          );
      
          deployParam = abi.encode(["address", "bytes"], [accounts[1], deployParam]);
      
          NativeProjection = await compile("projection/native/NativeProjection");
      
          var native = new web3.eth.Contract(
            NativeProjection.abi,
            nativeProjectionAddress
          );
      
          await native.methods
            .lazyInit(deployParam)
            .send(blockchainConnection.getSendingOptions());
    });

    it("#000 ", async () => {
        var mainToken = new web3.eth.Contract(knowledgeBase.IERC20ABI, knowledgeBase.daiTokenAddress);
        const prevResult = await mainToken.methods.balanceOf(accounts[1]).call()
        console.log(prevResult)
        await buyForETH(mainToken, 1, accounts[1]);
        const result = await mainToken.methods.balanceOf(accounts[1]).call()
        console.log(result)
        console.log(result.sub(prevResult))
    })

    it("#001 ", async () => {
        var oldHost = "0x6b175474e89094c44da98b954eedeac495271d0f"
        await blockchainConnection.unlockAccounts(oldHost);
        var mainToken = new web3.eth.Contract(knowledgeBase.IERC20ABI, knowledgeBase.daiTokenAddress);
        const prevResult = await mainToken.methods.balanceOf(oldHost).call()
        console.log(prevResult)
        await mainToken.methods.transfer(accounts[0], 1000).send(blockchainConnection.getSendingOptions({from : oldHost}));
        const result = await mainToken.methods.balanceOf(oldHost).call()
        console.log(result)
        console.log(result.sub(prevResult))
    })

})