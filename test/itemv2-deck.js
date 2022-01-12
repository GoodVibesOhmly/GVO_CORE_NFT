var utilities = require("../util/utilities");
var itemsv2 = require("../resources/itemsv2");
var itemProjection = require("../resources/itemProjection");
var wrapperResource = require("../resources/wrapper");
const blockchainConnection = require("../util/blockchainConnection");
var erc20Contract;

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
            [
                boredApeTokenAddresss,
                boredApeTokenAddresss,
                boredApeTokenAddresss,
            ],
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

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            "3000000000000000000",
            boredApeItemIds[2],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "3000000000000000000",
            boredApeItemIds[2],
            wrapper
        );

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
            [godsTokenAddresss],
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
            [["1000000000000000000"], [accounts[3]], true]
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
            accounts[3],
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

        // #UWB_DBA_1_1.4 START

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                boredApeTokenAddresss,
                boredApeTokenId[0],
                accounts[3],
                "0x",
                false,
                false,
            ]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                boredApeTokenAddresss,
                boredApeTokenId[1],
                accounts[3],
                "0x",
                false,
                false,
            ]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        await catchCall(
            wrapper.methods
                .burnBatch(
                    accounts[1],
                    [boredApeItemIds[0], boredApeItemIds[1]],
                    ["1000000000000000000", "510000000000000000"],
                    encodeDatas
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "Invalid amount"
        );

        // #UWB_DBA_1_1.4 END

        // #UW_DBA_1_1.5 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                boredApeTokenAddresss,
                boredApeTokenId[0],
                accounts[3],
                "0x",
                false,
                false,
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[1],
                    boredApeItemIds[2],
                    "510000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "Invalid amount"
        );

        // #UW_DBA_1_1.5 END

        // #UW_DBA_1_1.6 START

        data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                boredApeTokenAddresss,
                boredApeTokenId[2],
                accounts[3],
                "0x",
                false,
                false,
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[1],
                    boredApeItemIds[2],
                    "510000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "Invalid amount"
        );

        // #UW_DBA_1_1.6 END

        // #UWB_DGODS_1_1.7 START

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                boredApeTokenAddresss,
                boredApeTokenId[0],
                accounts[4],
                "0x",
                false,
                false,
            ]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                boredApeTokenAddresss,
                boredApeTokenId[1],
                accounts[4],
                "0x",
                false,
                false,
            ]
        );
        datas[2] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                boredApeTokenAddresss,
                boredApeTokenId[2],
                accounts[4],
                "0x",
                false,
                false,
            ]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        await wrapper.methods
            .burnBatch(
                accounts[1],
                [boredApeItemIds[0], boredApeItemIds[1], boredApeItemIds[2]],
                [
                    "1000000000000000000",
                    "1000000000000000000",
                    "1000000000000000000",
                ],
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[4],
            "3",
            boredApe
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            "-3000000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-3000000000000000000",
            boredApeItemIds[0],
            wrapper
        );

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

        var tx = await wrapper.methods
            .burn(accounts[2], godsItemIds[0], "1000000000000000000", data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[3],
            "1",
            gods
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            "-1000000000000000000",
            godsItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-1000000000000000000",
            godsItemIds[0],
            wrapper
        );

        // #UW_DGODS_1_1.9 END

        // JumpToBlock START

        await blockchainConnection.fastForward(blockToSkip);

        // JumpToBlock END

        // #UW_DGods_1_2.1 START

        data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [godsTokenAddresss, godsTokenId[1], accounts[2], "0x", false, false]
        );

        var tx = await wrapper.methods
            .burn(accounts[3], godsItemIds[0], "1000000000000000000", data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[2],
            "1",
            gods
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "-1000000000000000000",
            godsItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-1000000000000000000",
            godsItemIds[0],
            wrapper
        );

        // #UW_DGods_1_2.1 END
    });

    it("#2", async () => {
        /**
         * Label            ||   Operation      || Token         || From || Receiver address || amount    || Token Reference    || Lock
         * #W_ENS_1_1.1          Wrap              ENS              Acc1        Acc1,Acc3          2          A,B                  yes,no
         * #W_UNI_1_1.2          Wrap              UNI v3           Acc3        Acc3               2          C, D                 yes, no
         * #W_UNI_1_1.3          Wrap              UNI v3           Acc3        Acc1               1          E                    no
         *
         * #UWB_DENS_DUNI_1_1.4  MF: Unwrap batch  DENS, DUNI       Acc1        Acc2               1+1        A, C                 yes, yes
         * #UWB_DENS_DUNI_1_1.5  MF: Unwrap batch  DENS, DUNI       Acc3        Acc3               1+1        A, E                 yes, no
         * #UWB_DENS_DUNI_1_1.6  Unwrap Batch      DENS, DUNI       Acc1        Acc2               1+1        B,E                  yes, no
         * JumpToBlock ---------------------------------------------------------------------------------------------------------------------------
         * #UWB_DENS_DUNI_1_1.7  MF: Unwrap batch  DENS, DUNI       Acc3        Acc3           0.51+0.51+1    A,C,D                yes, yes, no
         * #UWB_DENS_DUNI_1_1.8  Unwrap Batch      DENS, DUNI       Acc3        Acc3           0.51+1+0.51    A,C,D                yes, yes, no
         * #W_ENS_UNI_1_1.9      Wrap              ENS, UNI         Acc3        Acc3            1+1           A+, C+               no, no
         */

        var tokenHolderENS = "0xcfB586d08633fC36953be8083B63a7d96D50265B";

        var ENSTokenAddresss = "0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85";

        var ENSTokenId = [
            "76209759912004573400534475157126407931116638124477574818832130517944945631566",
            "101180787059894841371179306178306111501534425305686398917862181098735580637363",
        ];

        var ens = new web3.eth.Contract(
            knowledgeBase.IERC721ABI,
            ENSTokenAddresss
        );

        await blockchainConnection.unlockAccounts(tokenHolderENS);

        ENSTokenId.map(async (id, index) => {
            await ens.methods
                .safeTransferFrom(tokenHolderENS, accounts[1], id)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: tokenHolderENS,
                    })
                );
        });

        ENSTokenId.map(async (id, index) => {
            await ens.methods.approve(wrapper.options.address, id).send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );
        });

        // var createItem = await wrapperResource.generateCreateItem(
        //     ENSTokenId,
        //     [accounts[1], accounts[3]],
        //     [ENSTokenAddresss, ENSTokenAddresss],
        //     ["1000000000000000000", "1000000000000000000"]
        // );

        // #W_ENS_1_1.1 START

        var createItem = await wrapperResource.generateCreateItem(
            [ENSTokenId[0]],
            [accounts[1]],
            [ENSTokenAddresss],
            ["1000000000000000000"]
        );

        var createItem1 = await wrapperResource.generateCreateItem(
            [ENSTokenId[1]],
            [accounts[3]],
            [ENSTokenAddresss],
            ["1000000000000000000"]
        );

        console.log("-----------------------pre----------------------");
        console.log(await ens.methods.balanceOf(accounts[1]).call());
        console.log(
            await ens.methods.balanceOf(wrapper.options.address).call()
        );
        console.log("-----------------------end pre----------------------");

        // var tx = await wrapper.methods
        //     .mintItems(createItem, [true, false])
        //     .send(
        //         blockchainConnection.getSendingOptions({ from: accounts[1] })
        //     );

        var tx = await wrapper.methods
            .mintItems(createItem, [true])
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        var tx = await wrapper.methods
            .mintItems(createItem1, [false])
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        console.log("-----------------------post----------------------");
        console.log(await ens.methods.balanceOf(accounts[1]).call());
        console.log(
            await ens.methods.balanceOf(wrapper.options.address).call()
        );

        console.log(await ens.methods.ownerOf(ENSTokenId[0]).call());
        console.log(await ens.methods.ownerOf(ENSTokenId[1]).call());
        console.log("-----------------------end post----------------------");

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var ENSItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        // await wrapperResource.checkBalance(
        //     tx,
        //     accounts[1],
        //     wrapper.options.address,
        //     "2",
        //     ens
        // );

        // await wrapperResource.checkBalanceItem(
        //     tx,
        //     accounts[1],
        //     "1000000000000000000",
        //     ENSItemIds[0],
        //     wrapper
        // );

        // await wrapperResource.checkBalanceItem(
        //     tx,
        //     accounts[3],
        //     "1000000000000000000",
        //     ENSItemIds[0],
        //     wrapper
        // );

        // await wrapperResource.checkSupply(
        //     tx,
        //     "2000000000000000000",
        //     ENSItemIds[0],
        //     wrapper
        // );

        // #W_ENS_1_1.1 END

        var tokenHolderUni = "0x6dd91bdab368282dc4ea4f4befc831b78a7c38c0";

        var uniTokenAddresss = "0xc36442b4a4522e871399cd717abdd847ab11fe88";

        var uniTokenId = ["179846", "179826", "179819"];

        var uni = new web3.eth.Contract(
            knowledgeBase.IERC721ABI,
            uniTokenAddresss
        );

        await blockchainConnection.unlockAccounts(tokenHolderUni);

        uniTokenId.map(async (id, index) => {
            await uni.methods
                .safeTransferFrom(tokenHolderUni, accounts[3], id)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: tokenHolderUni,
                    })
                );
        });

        // #W_UNI_1_1.2 START

        uniTokenId.map(async (id, index) => {
            await uni.methods.approve(wrapper.options.address, id).send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );
        });

        var createItem = await wrapperResource.generateCreateItem(
            [uniTokenId[0], uniTokenId[1]],
            [accounts[3], accounts[3]],
            [uniTokenAddresss, uniTokenAddresss],
            ["1000000000000000000", "1000000000000000000"]
        );

        var tx = await wrapper.methods
            .mintItems(createItem, [true, false])
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[3] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var uniItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        await wrapperResource.checkBalance(
            tx,
            accounts[3],
            wrapper.options.address,
            "2",
            uni
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "2000000000000000000",
            uniItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "2000000000000000000",
            uniItemIds[0],
            wrapper
        );

        // #W_UNI_1_1.2 END

        // #W_UNI_1_1.3 START

        var data = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [["1000000000000000000"], [accounts[1]], false]
        );

        tx = await uni.methods
            .safeTransferFrom(
                accounts[3],
                wrapper.options.address,
                uniTokenId[2],
                data
            )
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[3] })
            );

        await wrapperResource.checkBalance(
            tx,
            accounts[3],
            wrapper.options.address,
            "1",
            uni
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            "1000000000000000000",
            uniItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "1000000000000000000",
            uniItemIds[0],
            wrapper
        );

        // #W_UNI_1_1.3 END

        // #UWB_DENS_DUNI_1_1.4 START

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [ENSTokenAddresss, ENSTokenId[0], accounts[2], "0x", false, false]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [uniTokenAddresss, uniTokenId[0], accounts[2], "0x", false, false]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        await catchCall(
            wrapper.methods
                .burnBatch(
                    accounts[1],
                    [ENSItemIds[0], uniItemIds[0]],
                    ["1000000000000000000", "1000000000000000000"],
                    encodeDatas
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "Cannot unlock"
        );

        // #UWB_DENS_DUNI_1_1.4 END

        // #UWB_DENS_DUNI_1_1.5 START

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [ENSTokenAddresss, ENSTokenId[0], accounts[3], "0x", false, false]
        );

        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [uniTokenAddresss, uniTokenId[2], accounts[3], "0x", false, false]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        await catchCall(
            wrapper.methods
                .burnBatch(
                    accounts[3],
                    [ENSItemIds[0], uniItemIds[0]],
                    ["1000000000000000000", "1000000000000000000"],
                    encodeDatas
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "Cannot unlock"
        );

        // #UWB_DENS_DUNI_1_1.5 END

        // #UWB_DENS_DUNI_1_1.6 START

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [ENSTokenAddresss, ENSTokenId[1], accounts[2], "0x", false, false]
        );

        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [uniTokenAddresss, uniTokenId[2], accounts[2], "0x", false, false]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        var tx = await wrapper.methods
            .burnBatch(
                accounts[1],
                [ENSItemIds[0], uniItemIds[0]],
                ["1000000000000000000", "1000000000000000000"],
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[2],
            "1",
            uni
        );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[2],
            "1",
            ens
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            "-1000000000000000000",
            uniItemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            "-1000000000000000000",
            ENSItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-1000000000000000000",
            uniItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-1000000000000000000",
            ENSItemIds[0],
            wrapper
        );

        // #UWB_DENS_DUNI_1_1.6 END

        // JumpToBlock START

        await blockchainConnection.fastForward(blockToSkip);

        // JumpToBlock END

        // #UWB_DENS_DUNI_1_1.7 START

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [ENSTokenAddresss, ENSTokenId[0], accounts[3], "0x", false, false]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [uniTokenAddresss, uniTokenId[0], accounts[3], "0x", false, false]
        );
        datas[2] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [uniTokenAddresss, uniTokenId[1], accounts[3], "0x", false, false]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        await catchCall(
            wrapper.methods
                .burnBatch(
                    accounts[3],
                    [ENSItemIds[0], uniItemIds[0], uniItemIds[0]],
                    [
                        "510000000000000000",
                        "510000000000000000",
                        "1000000000000000000",
                    ],
                    encodeDatas
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "Invalid amount"
        );

        // #UWB_DENS_DUNI_1_1.7 END

        // #UWB_DENS_DUNI_1_1.8 START

        await wrapper.methods
            .burnBatch(
                accounts[3],
                [ENSItemIds[0], uniItemIds[0], uniItemIds[0]],
                [
                    "510000000000000000",
                    "1000000000000000000",
                    "510000000000000000",
                ],
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        // #UWB_DENS_DUNI_1_1.8 END

        // #W_ENS_UNI_1_1.9 START

        await uni.methods.approve(wrapper.options.address, uniTokenId[0]).send(
            blockchainConnection.getSendingOptions({
                from: accounts[3],
            })
        );

        await ens.methods.approve(wrapper.options.address, ENSTokenId[0]).send(
            blockchainConnection.getSendingOptions({
                from: accounts[3],
            })
        );

        var createItem = await wrapperResource.generateCreateItem(
            [ENSTokenId[0], uniTokenId[0]],
            [accounts[3], accounts[3]],
            [ENSTokenAddresss, uniTokenAddresss],
            ["510000000000000000", "510000000000000000"]
        );

        var tx = await wrapper.methods
            .mintItems(createItem, [false, false])
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[3] })
            );

        await wrapperResource.checkBalance(
            tx,
            accounts[3],
            wrapper.options.address,
            "1",
            ens
        );

        await wrapperResource.checkBalance(
            tx,
            accounts[3],
            wrapper.options.address,
            "1",
            uni
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "510000000000000000",
            uniItemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "510000000000000000",
            ENSItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "510000000000000000",
            uniItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "510000000000000000",
            ENSItemIds[0],
            wrapper
        );

        // #W_ENS_UNI_1_1.9 END
    });

    it("#3", async () => {
        /**
         * Label            ||   Operation      || Token         || From || Receiver address || amount    || Token Reference    || Lock
         * #W_GODS_1_1.1          Wrap              GODS            Acc3        Acc3              2            A,B                  yes,yes
         * #W_BA_1_1.2            Wrap              BORED APE       Acc4        Acc4              1            C                    no
         * #W_BA_1_1.3            Wrap              BORED APE       Acc4        Acc4              1            D                    yes
         *
         * #UW_DGODS_1_1.4        MF: Unwrap        DGODS           Acc3        Acc3              0.51         A                    yes
         * #BRN_DGODS_1_1.5       Burn(Interop.)    DGODS           Acc3        //                0.8          //                   //
         * #UW_DGODS_1_1.6        Unwrap            DGODS           Acc3        Acc3              1            A                    yes
         * #W_GODS_1_1.7          Wrap              GODS            Acc3        Acc3              1            A+                   no
         * #UW_DGODS_1_1.8        Unwrap            DGODS           Acc3        Acc3              0.6          A+                   no
         * #UW_DGODS_1_1.9        MF: Unwrap        DGODS           Acc3        Acc3              0.4          B                    yes
         * #W_GODS_1_2.1          Wrap              GODS            Acc2        Acc2              1            A++                  no
         * #UW_DGODS_1_2.2        Unwrap            DGODS           Acc3        Acc3              0.51         B                    yes
         * #BRN_DBA_1_2.3         Burn(Interop.)    DBA             Acc4        //                1.4          //                   //
         * #UW_DBA_1_2.4          Unwrap            DBA             Acc3        Acc3              0.6          C                    no
         * #W_BA_1_2.5            Wrap              BORED APE       Acc4        Acc4              1            C+                   no
         * #UW_DBA_1_2.6          Unwrap            DBA             Acc4        Acc4              0.6          D                    yes
         * #W_BA_1_2.7            Wrap              BORED APE       Acc4        Acc5              1            D+                   no
         * #UW_DBA_1_2.6          Unwrap            DBA             Acc5        Acc4              1            D+                   no
         */

        var tokenHolderGods = "0x7891f796a5d43466fC29F102069092aEF497a290";

        var godsTokenAddresss = "0x0e3a2a1f2146d86a604adc220b4967a898d7fe07";

        var godsTokenId = ["83257853", "83257854"];

        var gods = new web3.eth.Contract(
            knowledgeBase.IERC721ABI,
            godsTokenAddresss
        );

        await blockchainConnection.unlockAccounts(tokenHolderGods);

        godsTokenId.map(async (id, index) => {
            await gods.methods
                .safeTransferFrom(tokenHolderGods, accounts[3], id)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: tokenHolderGods,
                    })
                );
        });

        // #W_GODS_1_1.1 START

        godsTokenId.map(async (id, index) => {
            await gods.methods.approve(wrapper.options.address, id).send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );
        });

        var createItem = await wrapperResource.generateCreateItem(
            godsTokenId,
            [accounts[3], accounts[3]],
            [godsTokenAddresss, godsTokenAddresss],
            ["1000000000000000000", "1000000000000000000"]
        );

        var tx = await wrapper.methods
            .mintItems(createItem, [true, true])
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[3] })
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
            accounts[3],
            wrapper.options.address,
            "2",
            gods
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "2000000000000000000",
            godsItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "2000000000000000000",
            godsItemIds[0],
            wrapper
        );

        // #W_GODS_1_1.1 END

        var tokenHolderBoredApe = "0x1b523DC90A79cF5ee5d095825e586e33780f7188";

        var boredApeTokenAddresss =
            "0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d";

        var boredApeTokenId = ["8188", "8187"];

        var boredApe = new web3.eth.Contract(
            knowledgeBase.IERC721ABI,
            boredApeTokenAddresss
        );

        await blockchainConnection.unlockAccounts(tokenHolderBoredApe);

        boredApeTokenId.map(async (id, index) => {
            await boredApe.methods
                .safeTransferFrom(tokenHolderBoredApe, accounts[4], id)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: tokenHolderBoredApe,
                    })
                );
        });

        // #W_BA_1_1.2 START

        boredApeTokenId.map(async (id, index) => {
            await boredApe.methods.approve(wrapper.options.address, id).send(
                blockchainConnection.getSendingOptions({
                    from: accounts[4],
                })
            );
        });

        var createItem = await wrapperResource.generateCreateItem(
            [boredApeTokenId[0]],
            [accounts[4]],
            [boredApeTokenAddresss],
            ["1000000000000000000"]
        );

        var tx = await wrapper.methods
            .mintItems(createItem, [false])
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[4] })
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
            accounts[4],
            wrapper.options.address,
            "1",
            boredApe
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[4],
            "1000000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "1000000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        // #W_BA_1_1.2 END

        // #W_BA_1_1.3 START

        var data = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [["1000000000000000000"], [accounts[4]], true]
        );

        tx = await boredApe.methods
            .safeTransferFrom(
                accounts[4],
                wrapper.options.address,
                boredApeTokenId[1],
                data
            )
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[4] })
            );

        await wrapperResource.checkBalance(
            tx,
            accounts[4],
            wrapper.options.address,
            "1",
            boredApe
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[4],
            "1000000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "1000000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        // #W_BA_1_1.3 END

        // #UW_DGODS_1_1.4 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [godsTokenAddresss, godsTokenId[0], accounts[3], "0x", false, false]
        );

        await catchCall(
            wrapper.methods
                .burn(accounts[3], godsItemIds[0], "510000000000000000", data)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "Invalid amount"
        );

        // #UW_DGODS_1_1.4 END

        // #BRN_DGODS_1_1.5 START

        var burnValue = "800000000000000000";

        erc20Contract = await asInteroperableInterface(godsItemIds[0]);
        await erc20Contract.methods
            .burn(burnValue)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[3] })
            );

        await wrapperResource.checkSupply(
            tx,
            burnValue.mul(-1),
            godsItemIds[0],
            wrapper
        );

        // #BRN_DGODS_1_1.5 END

        // #UW_DGODS_1_1.6 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [godsTokenAddresss, godsTokenId[0], accounts[3], "0x", false, false]
        );

        var tx = await wrapper.methods
            .burn(accounts[3], godsItemIds[0], "1000000000000000000", data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[3],
            "1",
            gods
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "-1000000000000000000",
            godsItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-1000000000000000000",
            godsItemIds[0],
            wrapper
        );

        // #UW_DGODS_1_1.6 END

        // #W_GODS_1_1.7 START

        await gods.methods
            .approve(wrapper.options.address, godsTokenId[0])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        var createItem = await wrapperResource.generateCreateItem(
            [godsTokenId[0]],
            [accounts[3]],
            [godsTokenAddresss],
            ["800000000000000000"]
        );

        var tx = await wrapper.methods
            .mintItems(createItem, [false])
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[3] })
            );

        await wrapperResource.checkBalance(
            tx,
            accounts[3],
            wrapper.options.address,
            "1",
            gods
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "800000000000000000",
            godsItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "800000000000000000",
            godsItemIds[0],
            wrapper
        );

        // #W_GODS_1_1.7 END

        // #UW_DGODS_1_1.8 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [godsTokenAddresss, godsTokenId[0], accounts[2], "0x", false, false]
        );

        var tx = await wrapper.methods
            .burn(accounts[3], godsItemIds[0], "600000000000000000", data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[2],
            "1",
            gods
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "-600000000000000000",
            godsItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-600000000000000000",
            godsItemIds[0],
            wrapper
        );

        // #UW_DGODS_1_1.8 END

        // #UW_DGODS_1_1.9 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [godsTokenAddresss, godsTokenId[1], accounts[3], "0x", false, false]
        );

        await catchCall(
            wrapper.methods
                .burn(accounts[3], godsItemIds[0], "400000000000000000", data)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "Invalid amount"
        );

        // #UW_DGODS_1_1.9 END

        // #W_GODS_1_2.1 START

        await gods.methods
            .approve(wrapper.options.address, godsTokenId[0])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        var createItem = await wrapperResource.generateCreateItem(
            [godsTokenId[0]],
            [accounts[3]],
            [godsTokenAddresss],
            ["600000000000000000"]
        );

        var tx = await wrapper.methods
            .mintItems(createItem, [false])
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
            accounts[3],
            "600000000000000000",
            godsItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "600000000000000000",
            godsItemIds[0],
            wrapper
        );

        // #W_GODS_1_2.1 END

        // #UW_DGODS_1_2.2 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [godsTokenAddresss, godsTokenId[1], accounts[3], "0x", false, false]
        );

        var tx = await wrapper.methods
            .burn(accounts[3], godsItemIds[0], "510000000000000000", data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[3],
            "1",
            gods
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "-510000000000000000",
            godsItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-510000000000000000",
            godsItemIds[0],
            wrapper
        );

        // #UW_DGODS_1_2.2 END

        // #BRN_DBA_1_2.3 START

        var burnValue = "1400000000000000000";

        erc20Contract = await asInteroperableInterface(boredApeItemIds[0]);
        var tx = await erc20Contract.methods
            .burn(burnValue)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[4] })
            );

        await wrapperResource.checkSupply(
            tx,
            burnValue.mul(-1),
            boredApeItemIds[0],
            wrapper
        );

        // #BRN_DBA_1_2.3 END

        // #UW_DBA_1_2.4 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                boredApeTokenAddresss,
                boredApeTokenId[0],
                accounts[4],
                "0x",
                false,
                false,
            ]
        );

        var tx = await wrapper.methods
            .burn(accounts[4], boredApeItemIds[0], "600000000000000000", data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[4],
                })
            );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[4],
            "1",
            boredApe
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[4],
            "-600000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-600000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        // #UW_DBA_1_2.4 END

        // #W_BA_1_2.5 START

        await boredApe.methods
            .approve(wrapper.options.address, boredApeTokenId[0])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[4],
                })
            );

        var createItem = await wrapperResource.generateCreateItem(
            [boredApeTokenId[0]],
            [accounts[4]],
            [boredApeTokenAddresss],
            ["1000000000000000000"]
        );

        var tx = await wrapper.methods
            .mintItems(createItem, [false])
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[4] })
            );

        await wrapperResource.checkBalance(
            tx,
            accounts[4],
            wrapper.options.address,
            "1",
            boredApe
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[4],
            "1000000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "1000000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        // #W_BA_1_2.5 END

        // #UW_DBA_1_2.6 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                boredApeTokenAddresss,
                boredApeTokenId[1],
                accounts[4],
                "0x",
                false,
                false,
            ]
        );

        var tx = await wrapper.methods
            .burn(accounts[4], boredApeItemIds[0], "600000000000000000", data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[4],
                })
            );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[4],
            "1",
            boredApe
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[4],
            "-600000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-600000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        // #UW_DBA_1_2.6 END

        // #W_BA_1_2.7 START

        await boredApe.methods
            .approve(wrapper.options.address, boredApeTokenId[1])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[4],
                })
            );

        var createItem = await wrapperResource.generateCreateItem(
            [boredApeTokenId[1]],
            [accounts[5]],
            [boredApeTokenAddresss],
            ["600000000000000000"]
        );

        var tx = await wrapper.methods
            .mintItems(createItem, [false])
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[4] })
            );

        await wrapperResource.checkBalance(
            tx,
            accounts[4],
            wrapper.options.address,
            "1",
            boredApe
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[5],
            "600000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "600000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        // #W_BA_1_2.7 END

        // #UW_DBA_1_2.6 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                boredApeTokenAddresss,
                boredApeTokenId[1],
                accounts[4],
                "0x",
                false,
                false,
            ]
        );

        var tx = await wrapper.methods
            .burn(accounts[5], boredApeItemIds[0], "600000000000000000", data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[5],
                })
            );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[4],
            "1",
            boredApe
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[5],
            "-600000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-600000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        // #UW_DBA_1_2.6 END
    });
});