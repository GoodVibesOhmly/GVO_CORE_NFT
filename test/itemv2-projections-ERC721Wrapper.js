var utilities = require("../util/utilities");
var itemsv2 = require("../resources/itemsv2");
var itemProjection = require("../resources/itemProjection");
describe("itemv2 projections ERC721Wrapper", () => {

    var tokenHolder = "0xcfB586d08633fC36953be8083B63a7d96D50265B";
    var wrapper;
    var MainInterface;
    var mainInterface;
    var itemsList = [];
    
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
      
          var ERC721Wrapper = await compile("projection/ERC721/ERC721Wrapper");
          wrapper = await new web3.eth.Contract(ERC721Wrapper.abi).deploy({data : ERC721Wrapper.bin, arguments: ["0x"]}).send(blockchainConnection.getSendingOptions());
      
          await wrapper.methods
            .lazyInit(deployParam)
            .send(blockchainConnection.getSendingOptions());

          MainInterface = await compile("model/IItemMainInterface");
            mainInterface = new web3.eth.Contract(
              MainInterface.abi,
              knowledgeBase.mainInterfaceAddress
          );
    });

    it("#000 ", async () => {
        var mainToken = new web3.eth.Contract(knowledgeBase.IERC20ABI, knowledgeBase.daiTokenAddress);
        var prevResult = await mainToken.methods.balanceOf(accounts[1]).call()
        // console.log(prevResult)
        await buyForETH(mainToken, 1, accounts[1]);
        var result = await mainToken.methods.balanceOf(accounts[1]).call()
        // console.log(result)
        // console.log(result.sub(prevResult))
    })

    it("#001 ", async () => {
        var oldHost = "0x6b175474e89094c44da98b954eedeac495271d0f"
        await blockchainConnection.unlockAccounts(oldHost);
        var mainToken = new web3.eth.Contract(knowledgeBase.IERC20ABI, knowledgeBase.daiTokenAddress);
        var prevResult = await mainToken.methods.balanceOf(oldHost).call()
        console.log(prevResult)
        await mainToken.methods.transfer(accounts[0], 1000).send(blockchainConnection.getSendingOptions({from : oldHost}));
        var result = await mainToken.methods.balanceOf(oldHost).call()
        console.log(result)
        console.log(result.sub(prevResult))
    })

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
        var token721Id = "76209759912004573400534475157126407931116638124477574818832130517944945631566";
        var token721Id1 = "62388";
        var mainToken = new web3.eth.Contract(knowledgeBase.IERC721ABI, knowledgeBase.ensTokenAddress);
        var prevResult = await mainToken.methods.balanceOf(tokenHolder).call()
        var prevResultTo = await mainToken.methods.balanceOf(wrapper.options.address).call()
        await blockchainConnection.unlockAccounts(tokenHolder);

        var tx = await mainToken.methods.safeTransferFrom(tokenHolder, wrapper.options.address, token721Id).send(blockchainConnection.getSendingOptions({from : tokenHolder}));

        var result = await mainToken.methods.balanceOf(tokenHolder).call()
        var resultTo = await mainToken.methods.balanceOf(wrapper.options.address).call()

        assert.equal(prevResult.sub(1), result);
        assert.equal(prevResultTo.add(1), resultTo);



        var mainToken1 = new web3.eth.Contract(knowledgeBase.IERC721ABI, knowledgeBase.uniV3PositionTokenAddress);
        var prevResult1 = await mainToken1.methods.balanceOf(tokenHolder).call()
        var prevResultTo1 = await mainToken1.methods.balanceOf(wrapper.options.address).call()

        var tx1 = await mainToken1.methods.safeTransferFrom(tokenHolder, wrapper.options.address, token721Id1).send(blockchainConnection.getSendingOptions({from : tokenHolder}));

        var result1 = await mainToken1.methods.balanceOf(tokenHolder).call()
        var resultTo1 = await mainToken1.methods.balanceOf(wrapper.options.address).call()

        assert.equal(prevResult1.sub(1), result1);
        assert.equal(prevResultTo1.add(1), resultTo1);

        var logs = (
          await web3.eth.getTransactionReceipt(tx.transactionHash)
        ).logs;
        var tokenId = web3.eth.abi.decodeParameter(
          "uint256",
          logs.filter(
            (it) =>
              it.topics[0] ===
              web3.utils.sha3("Token(address,uint256,uint256)")
          )[0].topics[3]
        );
        console.log(tokenId)

        console.log(await mainInterface.methods.item(tokenId).call())

        itemsList.push({"tokenName": "ens", "tokenAddress": knowledgeBase.ensTokenAddress, "account": utilities.voidEthereumAddress, "tokenId": token721Id, "itemId": tokenId})



        var logs = (
          await web3.eth.getTransactionReceipt(tx1.transactionHash)
        ).logs;
        var tokenId = web3.eth.abi.decodeParameter(
          "uint256",
          logs.filter(
            (it) =>
              it.topics[0] ===
              web3.utils.sha3("Token(address,uint256,uint256)")
          )[0].topics[3]
        );
        console.log(tokenId)

        console.log(await mainInterface.methods.item(tokenId).call())

        itemsList.push({"tokenName": "uniV3Position", "tokenAddress": knowledgeBase.uniV3PositionTokenAddress, "account": utilities.voidEthereumAddress, "tokenId": token721Id1, "itemId": tokenId})
    })

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
        var tokenList = ["350687", "586005", "586006", "586007", "586008"];
        var receivers = [utilities.voidEthereumAddress, accounts[0], accounts[1], accounts[2], accounts[3]]
        var mainToken = new web3.eth.Contract(knowledgeBase.IERC721ABI, knowledgeBase.godsTokenAddress);
        var prevResultTo = await Promise.all(
          receivers.map(async(address, index) => {
            await mainToken.methods.balanceOf(address).call()
          })
        )
        await blockchainConnection.unlockAccounts(tokenHolder);
        var tx = await wrapper.methods.mint(Array(tokenList.length).fill(knowledgeBase.godsTokenAddress), tokenList, receivers).send(blockchainConnection.getSendingOptions({from : tokenHolder}));

        await Promise.all(
          receivers.map(async(address, index) => {
            assert.equal(await mainToken.methods.balanceOf(address).call(), prevResultTo[index].add(1));
          })
        )
    })

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
      var mainToken = new web3.eth.Contract(knowledgeBase.IERC721ABI, knowledgeBase.godsTokenAddress);

      await blockchainConnection.unlockAccounts(tokenHolder);
      await wrapper.methods.burn(itemsList[0].account, itemsList[0].itemId, 1, "0x").send(blockchainConnection.getSendingOptions({from : itemsList[0].account}));
      await wrapper.methods.burn(itemsList[0].account, itemsList[0].itemId, 1, abi.encode(["address"],[accounts[9]])).send(blockchainConnection.getSendingOptions({from : itemsList[0].account}));
  })

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
    var receivers = [utilities.voidEthereumAddress, accounts[0], accounts[1], accounts[2], accounts[3]]
    var mainToken = new web3.eth.Contract(knowledgeBase.IERC721ABI, knowledgeBase.godsTokenAddress);
    var prevResultTo = await Promise.all(
      receivers.map(async(address, index) => {
        await mainToken.methods.balanceOf(address).call()
      })
    )
    await blockchainConnection.unlockAccounts(tokenHolder);
    await wrapper.methods.burnBatch(itemsList[0].account, [itemsList[0].itemId, itemsList[1].itemId], [1, 1], "0x").send(blockchainConnection.getSendingOptions({from : itemsList[0].account}));

    await Promise.all(
      receivers.map(async(address, index) => {
        assert.equal(await mainToken.methods.balanceOf(address).call(), prevResultTo[index].add(1));
      })
    )
})
})