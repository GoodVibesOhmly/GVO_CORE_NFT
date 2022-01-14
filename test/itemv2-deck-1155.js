var utilities = require("../util/utilities");
var itemsv2 = require("../resources/itemsv2");
var itemProjection = require("../resources/itemProjection");
var wrapperResource = require("../resources/wrapper");
const blockchainConnection = require("../util/blockchainConnection");
var keccak = require('keccak');
var erc20Contract;
var blockToSkip = 30;

describe("itemv2 ERC1155DeckWrapper", () => {
    var blockToSkip = 30;
    var wrapper;
    var MainInterface;
    var mainInterface;
    var ItemInteroperableInterface;
    var itemInteroperableInterface;
    var itemInteroperableInterfaceAddress;
    var itemsList = [];
    var approvedHost = [];

    async function approveHost(holder) {
        if (!approvedHost.includes(holder)) {
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

        var NFTDynamicUriRenderer = await compile('util/NFTDynamicUriRenderer');
        var nftDynamicUriRenderer = await new web3.eth.Contract(NFTDynamicUriRenderer.abi).deploy({data : NFTDynamicUriRenderer.bin, arguments : [utilities.voidEthereumAddress, "myUri"]}).send(blockchainConnection.getSendingOptions());

        var uri = web3.eth.abi.encodeParameters(["address", "bytes"], [nftDynamicUriRenderer.options.address, "0x"]);

        var headerCollection = {
          host: accounts[1],
          name: "Colection1",
          symbol: "C1",
          uri
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

        mainInterface = await itemsv2.getMainInterface();

        deployParam = abi.encode(["address", "bytes"], [accounts[1], deployParam]);

        var ERC1155DeckWrapperUtilities = await compile("projection/ERC1155Deck/ERC1155DeckWrapper", 'ERC1155DeckWrapperUtilities');
        var eRC1155DeckWrapperUtilities = await new web3.eth.Contract(ERC1155DeckWrapperUtilities.abi)
        .deploy({ data: ERC1155DeckWrapperUtilities.bin }).send(blockchainConnection.getSendingOptions());
        var contractPath = ERC1155DeckWrapperUtilities.ast.absolutePath + ":" + ERC1155DeckWrapperUtilities.contractName;
        var contractKey = '__$' + keccak('keccak256').update(contractPath).digest().toString('hex').slice(0, 34) + '$__';

        var ERC1155Wrapper = await compile("projection/ERC1155Deck/ERC1155DeckWrapper");
        ERC1155Wrapper.bin = ERC1155Wrapper.bin.split(contractKey).join(eRC1155DeckWrapperUtilities.options.address.substring(2));
        var wrapperData = await new web3.eth.Contract(ERC1155Wrapper.abi)
        .deploy({ data: ERC1155Wrapper.bin, arguments: ["0x"] }).encodeABI();

        var blockNumber = abi.encode(["uint256"], [blockToSkip]);

        var data = await itemsv2.createCollection(headerCollection.host, items, wrapperData, blockNumber, headerCollection);

        wrapper = new web3.eth.Contract(ERC1155Wrapper.abi, data.projection.options.address);

        console.log("Wrapper Uri", await wrapper.methods.uri().call());
        assert.equal(await wrapper.methods.uri().call(), await mainInterface.methods.collectionUri(await wrapper.methods.collectionId().call()).call());

        var ZeroDecimals = await compile("../resources/ERC1155ZeroDecimals");
        wrapperData = await new web3.eth.Contract(ZeroDecimals.abi)
          .deploy({ data: ZeroDecimals.bin, arguments: ["0x"] })
          .encodeABI();

        data = await itemsv2.createCollection(headerCollection.host, items, wrapperData, "0x", headerCollection);

        zeroDecimals = new web3.eth.Contract(ZeroDecimals.abi, data.projection.options.address);

      });

    it("#1", async () => {
       console.log("k");
    });
});
