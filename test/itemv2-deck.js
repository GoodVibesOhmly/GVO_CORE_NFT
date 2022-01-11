var utilities = require("../util/utilities");
var itemsv2 = require("../resources/itemsv2");
var itemProjection = require("../resources/itemProjection");
var wrapperResource = require("../resources/wrapper");
const blockchainConnection = require("../util/blockchainConnection");

describe("itemv2 ERC721DeckWrapper", () => {
    var blockToSkip = 30;
    var wrapper;
    var MainInterface;
    var mainInterface;
    var ItemInteroperableInterface;
    var itemInteroperableInterface;
    var itemInteroperableInterfaceAddress;
    var itemsList = [];
    var approvedHost = [];
    var exec651 = false;
    var exec652 = false;

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

        var NFTDynamicUriRenderer = await compile("util/NFTDynamicUriRenderer");
        var nftDynamicUriRenderer = await new web3.eth.Contract(
            NFTDynamicUriRenderer.abi
        )
            .deploy({
                data: NFTDynamicUriRenderer.bin,
                arguments: [utilities.voidEthereumAddress, "myUri"],
            })
            .send(blockchainConnection.getSendingOptions());

        var uri = web3.eth.abi.encodeParameters(
            ["address", "bytes"],
            [nftDynamicUriRenderer.options.address, "0x"]
        );

        var headerCollection = {
            host: accounts[1],
            name: "Colection1",
            symbol: "C1",
            uri,
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
                "0x",
            ]
        );

        deployParam = abi.encode(
            ["address", "bytes"],
            [accounts[1], deployParam]
        );

        var ERC721Wrapper = await compile(
            "projection/ERC721Deck/ERC721DeckWrapper"
        );
        var wrapperData = await new web3.eth.Contract(ERC721Wrapper.abi)
            .deploy({ data: ERC721Wrapper.bin, arguments: ["0x"] })
            .encodeABI();

        mainInterface = await itemsv2.getMainInterface();

        var blockNumber = abi.encode(["uint256"], [blockToSkip]);

        var data = await itemsv2.createCollection(
            headerCollection.host,
            items,
            wrapperData,
            blockNumber,
            headerCollection
        );

        wrapper = new web3.eth.Contract(
            ERC721Wrapper.abi,
            data.projection.options.address
        );

        console.log("Wrapper Uri", await wrapper.methods.uri().call());
        assert.equal(
            await wrapper.methods.uri().call(),
            await mainInterface.methods
                .collectionUri(await wrapper.methods.collectionId().call())
                .call()
        );
    });

    it("#1", async () => {
        /**
         * Label            ||   Operation      || Token         || From || Receiver address || amount    || Token Reference    || Lock
         * #W_BA_1_1.1           Wrap              Bored Ape        Acc1        Acc1               3          A,B, C               yes, yes, no
         * #W_GODS_1_1.2         Wrap              Gods             Acc2        Acc3               1          D                    no
         * #W_GODS_1_1.3         Wrap              Gods             Acc2        Acc2               1          E                    yes
         *
         * #UWB_DBA_1_1.4        MF: Unwrap batch  DBA              Acc1        Acc3               1.51       A, B                 yes, yes
         * #UW_DBA_1_1.5         MF: Unwrap        DBA              Acc1        Acc3               0.51       A                    yes
         * #UW_DBA_1_1.6         MF: Unwrap        DBA              Acc1        Acc3               0.51       C                    yes
         * #UWB_DGODS_1_1.7      Unwrap Batch      DGods            Acc1        Acc4               3          A,B,C                yes, yes, no
         * #UW_DGODS_1_1.8       MF: Unwrap        DGods            Acc3        Acc3               1          E                    yes
         * #UW_DGODS_1_1.9       Unwrap            DGods            Acc2        Acc3               1          D                    no
         * JumpToBlock ---------------------------------------------------------------------------------------------------------------------------
         * #UW_DGods_1_2.1       Unwrap            DGods            Acc3        Acc2               1          E                    yes
         */

        var tokenHolderBoredApe = "0x1b523DC90A79cF5ee5d095825e586e33780f7188";

        var boredApeTokenAddresss =
            "0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d";

        var boredApeTokenId = ["1630", "6724", "4428"];

        var boredApe = new web3.eth.Contract(
            knowledgeBase.IERC721ABI,
            boredApeTokenAddresss
        );

        await blockchainConnection.unlockAccounts(tokenHolderBoredApe);

        boredApeTokenId.map(async (id, index) => {
            await boredApe.methods
                .safeTransferFrom(tokenHolderBoredApe, accounts[1], id)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: tokenHolderBoredApe,
                    })
                );
        });

        boredApeTokenId.map(async (id, index) => {
            await boredApe.methods.approve(wrapper.options.address, id).send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );
        });

        var createItem = await wrapperResource.generateCreateItem(
            boredApeTokenId,
            [accounts[1], accounts[1], accounts[1]],
            boredApeTokenAddresss,
            [
                "1000000000000000000",
                "1000000000000000000",
                "1000000000000000000",
            ]
        );

        // #W_BA_1_1.1 START

        var tx = await wrapper.methods
            .mintItems(createItem, [true, true, false])
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var boredApeItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        await wrapperResource.checkBalance(
            tx,
            accounts[1],
            wrapper.options.address,
            "3",
            boredApe
        );

        // await wrapperResource.checkBalanceItem(
        //     tx,
        //     accounts[1],
        //     "3000000000000000000",
        //     boredApeItemIds[2],
        //     wrapper
        // );

        // await wrapperResource.checkSupply(
        //     tx,
        //     "3000000000000000000",
        //     boredApeItemIds[2],
        //     wrapper
        // );

        // #W_BA_1_1.1 END

        var tokenHolder = "0x7891f796a5d43466fC29F102069092aEF497a290";

        var godsTokenAddresss = "0x0e3a2a1f2146d86a604adc220b4967a898d7fe07";

        var godsTokenId = ["81046035", "81046037"];

        var gods = new web3.eth.Contract(
            knowledgeBase.IERC721ABI,
            godsTokenAddresss
        );

        await blockchainConnection.unlockAccounts(tokenHolder);

        godsTokenId.map(async (id, index) => {
            await gods.methods
                .safeTransferFrom(tokenHolder, accounts[2], id)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: tokenHolder,
                    })
                );
        });

        await gods.methods
            .approve(wrapper.options.address, godsTokenId[0])
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[2] })
            );

        var createItem = await wrapperResource.generateCreateItem(
            [godsTokenId[0]],
            [accounts[2]],
            godsTokenAddresss,
            ["1000000000000000000"]
        );

        // #W_GODS_1_1.2 START

        var tx = await wrapper.methods
            .mintItems(createItem, [false])
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[2] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var godsItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        await wrapperResource.checkBalance(
            tx,
            accounts[2],
            wrapper.options.address,
            "1",
            gods
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            "1000000000000000000",
            godsItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "1000000000000000000",
            godsItemIds[0],
            wrapper
        );

        // #W_GODS_1_1.2 END

        // #W_GODS_1_1.3 START

        var data = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [["1000000000000000000"], [accounts[2]], true]
        );

        tx = await gods.methods
            .safeTransferFrom(
                accounts[2],
                wrapper.options.address,
                godsTokenId[1],
                data
            )
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[2] })
            );

        await wrapperResource.checkBalance(
            tx,
            accounts[2],
            wrapper.options.address,
            "1",
            gods
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            "1000000000000000000",
            godsItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "1000000000000000000",
            godsItemIds[0],
            wrapper
        );

        // #W_GODS_1_1.3 END

        // #UW_DBA_1_1.5 START

        // var data = web3.eth.abi.encodeParameters(
        //     ["address", "uint256", "address", "bytes", "bool", "bool"],
        //     [
        //         boredApeTokenAddresss,
        //         boredApeTokenId[0],
        //         accounts[3],
        //         "0x",
        //         false,
        //         false,
        //     ]
        // );

        // await
        //     wrapper.methods
        //         .burn(
        //             accounts[1],
        //             boredApeItemIds[2],
        //             "510000000000000000",
        //             data
        //         )
        //         .send(
        //             blockchainConnection.getSendingOptions({
        //                 from: accounts[1],
        //             })

        // );

        // #UW_DBA_1_1.5 END

        // #UW_DBA_1_1.6 START

        // data = web3.eth.abi.encodeParameters(
        //     ["address", "uint256", "address", "bytes", "bool", "bool"],
        //     [
        //         boredApeTokenAddresss,
        //         boredApeTokenId[2],
        //         accounts[3],
        //         "0x",
        //         false,
        //         false,
        //     ]
        // );

        // await wrapper.methods
        //     .burn(accounts[1], boredApeItemIds[2], "510000000000000000", data)
        //     .send(
        //         blockchainConnection.getSendingOptions({
        //             from: accounts[1],
        //         })
        //     );

        // #UW_DBA_1_1.6 END

        // #UWB_DGODS_1_1.7 START

        // var datas = [];

        // datas[0] = web3.eth.abi.encodeParameters(
        //     ["address", "uint256", "address", "bytes", "bool", "bool"],
        //     [
        //         boredApeTokenAddresss,
        //         boredApeTokenId[0],
        //         accounts[4],
        //         "0x",
        //         false,
        //         false,
        //     ]
        // );
        // datas[1] = web3.eth.abi.encodeParameters(
        //     ["address", "uint256", "address", "bytes", "bool", "bool"],
        //     [
        //         boredApeTokenAddresss,
        //         boredApeTokenId[1],
        //         accounts[4],
        //         "0x",
        //         false,
        //         false,
        //     ]
        // );
        // datas[2] = web3.eth.abi.encodeParameters(
        //     ["address", "uint256", "address", "bytes", "bool", "bool"],
        //     [
        //         boredApeTokenAddresss,
        //         boredApeTokenId[2],
        //         accounts[4],
        //         "0x",
        //         false,
        //         false,
        //     ]
        // );

        // var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        // await wrapper.methods
        //     .burnBatch(
        //         accounts[1],
        //         [boredApeItemIds[0], boredApeItemIds[1], boredApeItemIds[2]],
        //         [
        //             "1000000000000000000",
        //             "1000000000000000000",
        //             "1000000000000000000",
        //         ],
        //         encodeDatas
        //     )
        //     .send(
        //         blockchainConnection.getSendingOptions({
        //             from: accounts[1],
        //         })
        //     );

        // #UWB_DGODS_1_1.7 END

        // #UW_DGODS_1_1.8 START

        data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [godsTokenAddresss, godsTokenId[1], accounts[3], "0x", false, false]
        );

        await catchCall(
            wrapper.methods
                .burn(accounts[3], godsItemIds[0], "1000000000000000000", data)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "Cannot unlock"
        );

        // #UW_DGODS_1_1.8 END

        // #UW_DGODS_1_1.9 START

        data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [godsTokenAddresss, godsTokenId[0], accounts[3], "0x", false, false]
        );

        await wrapper.methods
            .burn(accounts[2], godsItemIds[0], "1000000000000000000", data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        // await wrapperResource.checkBalance(
        //     tx,
        //     wrapper.options.address,
        //     accounts[3],
        //     "1",
        //     gods
        // );

        // await wrapperResource.checkBalanceItem(
        //     tx,
        //     accounts[2],
        //     "-1000000000000000000",
        //     godsItemIds[0],
        //     wrapper
        // );

        // await wrapperResource.checkSupply(
        //     tx,
        //     "0",
        //     godsItemIds[0],
        //     wrapper
        // );

        // #UW_DGODS_1_1.9 END

        // JumpToBlock START

        await blockchainConnection.fastForward(blockToSkip);

        // JumpToBlock END

        // #UW_DGods_1_2.1 START

        data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [godsTokenAddresss, godsTokenId[1], accounts[2], "0x", false, false]
        );

        await wrapper.methods
            .burn(accounts[3], godsItemIds[0], "1000000000000000000", data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        // #UW_DGods_1_2.1 END
    });
});
