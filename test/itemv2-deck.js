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

        await approveHost(tokenHolderBoredApe);

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

        var lock = [true, true, false];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
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

        await wrapperResource.checkReserveData(
            tx,
            accounts[1],
            createItem,
            lock,
            blockToSkip,
            wrapper
        );

        assert.equal(
            await wrapper.methods.source(boredApeItemIds[0]).call(),
            web3.utils.toChecksumAddress(boredApeTokenAddresss)
        );

        await wrapperResource.checkBalance(
            tx,
            accounts[1],
            wrapper.options.address,
            "3",
            boredApe,
            boredApeTokenId
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

        var headerCollection = {
            host: accounts[1],
            name: "newCollection",
            symbol: "newC1",
            uri: "newUriC1",
        };

        await catchCall(
            wrapper.methods.setHeader(headerCollection).send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            ),
            "unauthorized"
        );

        await wrapper.methods
            .setHeader(headerCollection)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );
        headerCollection.host = wrapper.options.address;
        await itemProjection.assertCheckHeader(
            headerCollection,
            mainInterface.methods
                .collection(await wrapper.methods.collectionId().call())
                .call()
        );

        await catchCall(
            wrapper.methods
                .setItemsCollection(
                    boredApeItemIds,
                    Array(boredApeItemIds.length).fill(
                        await wrapper.methods.collectionId().call()
                    )
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "Impossibru"
        );

        var tokenHolder = "0x7891f796a5d43466fC29F102069092aEF497a290";

        var godsTokenAddresss = "0x0e3a2a1f2146d86a604adc220b4967a898d7fe07";

        var godsTokenId = ["81046035", "81046037"];

        var gods = new web3.eth.Contract(
            knowledgeBase.IERC721ABI,
            godsTokenAddresss
        );

        await approveHost(tokenHolder);

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
            .mintItems(createItem)
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
            gods,
            [godsTokenId[0]]
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
            gods,
            [godsTokenId[1]]
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
            boredApe,
            [boredApeTokenId[0], boredApeTokenId[1], boredApeTokenId[2]]
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
            gods,
            [godsTokenId[0]]
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

        await blockchainConnection.fastForward(blockToSkip);

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
            gods,
            [godsTokenId[1]]
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
         * #W_ENS_2_1.1          Wrap              ENS              Acc1        Acc1,Acc3          2          A,B                  yes,no
         * #W_UNI_2_1.2          Wrap              UNI v3           Acc3        Acc3               2          C, D                 yes, no
         * #W_UNI_2_1.3          Wrap              UNI v3           Acc3        Acc1               1          E                    no
         *
         * #UWB_DENS_DUNI_2_1.4  MF: Unwrap batch  DENS, DUNI       Acc1        Acc2               1+1        A, C                 yes, yes
         * #UWB_DENS_DUNI_2_1.5  MF: Unwrap batch  DENS, DUNI       Acc3        Acc3               1+1        A, E                 yes, no
         * #UWB_DENS_DUNI_2_1.6  Unwrap Batch      DENS, DUNI       Acc1        Acc2               1+1        B,E                  yes, no
         * JumpToBlock ---------------------------------------------------------------------------------------------------------------------------
         * #UWB_DENS_DUNI_2_1.7  MF: Unwrap batch  DENS, DUNI       Acc3        Acc3           0.51+0.51+1    A,C,D                yes, yes, no
         * #UWB_DENS_DUNI_2_1.8  Unwrap Batch      DENS, DUNI       Acc3        Acc3           0.51+1+0.51    A,C,D                yes, yes, no
         * #W_ENS_UNI_2_1.9      Wrap              ENS, UNI         Acc3        Acc3            1+1           A+, C+               no, no
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

        await approveHost(tokenHolderENS);

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

        var createItem = await wrapperResource.generateCreateItem(
            ENSTokenId,
            [accounts[1], accounts[3]],
            [utilities.voidEthereumAddress, utilities.voidEthereumAddress],
            ["1000000000000000000", "1000000000000000000"]
        );

        var lock = [true, false];

        await catchCall(
            wrapper.methods.mintItems(createItem, lock).send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            ),
            ""
        );

        var createItem = await wrapperResource.generateCreateItem(
            [0],
            [accounts[1]],
            [ENSTokenAddresss],
            ["1000000000000000000"]
        );

        var lock = [true];

        await catchCall(
            wrapper.methods.mintItems(createItem, lock).send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            ),
            ""
        );

        // #W_ENS_2_1.1 START

        var createItem = await wrapperResource.generateCreateItem(
            ENSTokenId,
            [accounts[1], accounts[3]],
            [ENSTokenAddresss, ENSTokenAddresss],
            ["1000000000000000000", "1000000000000000000"]
        );

        var lock = [true, false];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var ENSItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        await wrapperResource.checkReserveData(
            tx,
            accounts[1],
            createItem,
            lock,
            blockToSkip,
            wrapper
        );

        assert.equal(
            await wrapper.methods.source(ENSItemIds[0]).call(),
            web3.utils.toChecksumAddress(ENSTokenAddresss)
        );

        await wrapperResource.checkBalance(
            tx,
            accounts[1],
            wrapper.options.address,
            "2",
            ens,
            ENSTokenId
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            "1000000000000000000",
            ENSItemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "1000000000000000000",
            ENSItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "2000000000000000000",
            ENSItemIds[0],
            wrapper
        );

        // #W_ENS_2_1.1 END

        var tokenHolderUni = "0x6dd91bdab368282dc4ea4f4befc831b78a7c38c0";

        var uniTokenAddresss = "0xc36442b4a4522e871399cd717abdd847ab11fe88";

        var uniTokenId = ["179846", "179826", "179819"];

        var uni = new web3.eth.Contract(
            knowledgeBase.IERC721ABI,
            uniTokenAddresss
        );

        await approveHost(tokenHolderUni);

        uniTokenId.map(async (id, index) => {
            await uni.methods
                .safeTransferFrom(tokenHolderUni, accounts[3], id)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: tokenHolderUni,
                    })
                );
        });

        // #W_UNI_2_1.2 START

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

        var lock = [true, false];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
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

        await wrapperResource.checkReserveData(
            tx,
            accounts[3],
            createItem,
            lock,
            blockToSkip,
            wrapper
        );

        assert.equal(
            await wrapper.methods.source(uniItemIds[0]).call(),
            web3.utils.toChecksumAddress(uniTokenAddresss)
        );

        await wrapperResource.checkBalance(
            tx,
            accounts[3],
            wrapper.options.address,
            "2",
            uni,
            [uniTokenId[0], uniTokenId[1]]
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

        // #W_UNI_2_1.2 END

        // #W_UNI_2_1.3 START

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
            uni,
            [uniTokenId[2]]
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

        // #W_UNI_2_1.3 END

        // #UWB_DENS_DUNI_2_1.4 START

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

        // #UWB_DENS_DUNI_2_1.4 END

        // #UWB_DENS_DUNI_2_1.5 START

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

        // #UWB_DENS_DUNI_2_1.5 END

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [ENSTokenAddresss, uniTokenId[2], accounts[2], "0x", false, false]
        );

        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [uniTokenAddresss, ENSTokenId[1], accounts[2], "0x", false, false]
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
            ""
        );

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [uniTokenAddresss, ENSTokenId[1], accounts[2], "0x", false, false]
        );

        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [ENSTokenAddresss, uniTokenId[2], accounts[2], "0x", false, false]
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
            "Wrong ERC721"
        );

        // #UWB_DENS_DUNI_2_1.6 START

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
            uni,
            [uniTokenId[2]]
        );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[2],
            "1",
            ens,
            [ENSTokenId[1]]
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

        // #UWB_DENS_DUNI_2_1.6 END

        // JumpToBlock START

        await blockchainConnection.fastForward(blockToSkip);

        // JumpToBlock END

        // #UWB_DENS_DUNI_2_1.7 START

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

        // #UWB_DENS_DUNI_2_1.7 END

        // #UWB_DENS_DUNI_2_1.8 START

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

        // #UWB_DENS_DUNI_2_1.8 END

        // #W_ENS_UNI_2_1.9 START

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

        var createWrongItem = await wrapperResource.generateCreateItem(
            [ENSTokenId[0], uniTokenId[0]],
            [accounts[3], accounts[3]],
            [ENSTokenAddresss, uniTokenAddresss],
            ["710000000000000000", "710000000000000000"]
        );

        await catchCall(
            wrapper.methods.mintItems(createWrongItem, [false, false]).send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            ),
            "SafeMath over-/under-flows"
        );

        var createWrongItem = await wrapperResource.generateCreateItem(
            [ENSTokenId[0], uniTokenId[0]],
            [accounts[3], accounts[3]],
            [ENSTokenAddresss, uniTokenAddresss],
            ["410000000000000000", "410000000000000000"]
        );

        await catchCall(
            wrapper.methods.mintItems(createWrongItem, [false, false]).send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            ),
            "amount"
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
            ens,
            [ENSTokenId[0]]
        );

        await wrapperResource.checkBalance(
            tx,
            accounts[3],
            wrapper.options.address,
            "1",
            uni,
            [uniTokenId[0]]
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

        // #W_ENS_UNI_2_1.9 END
    });

    it("#3", async () => {
        /**
         * Label            ||   Operation      || Token         || From || Receiver address || amount    || Token Reference    || Lock
         * #W_GODS_3_1.1          Wrap              GODS            Acc3        Acc3              2            A,B                  yes,yes
         * #W_BA_3_1.2            Wrap              BORED APE       Acc4        Acc4              1            C                    no
         * #W_BA_3_1.3            Wrap              BORED APE       Acc4        Acc4              1            D                    yes
         *
         * #UW_DGODS_3_1.4        MF: Unwrap        DGODS           Acc3        Acc3              0.51         A                    yes
         * #BRN_DGODS_3_1.5       Burn(Interop.)    DGODS           Acc3        //                0.8          //                   //
         * #UW_DGODS_3_1.6        MF: Unwrap        DGODS           Acc3        Acc3              0.6          A                    yes
         * #UW_DGODS_3_1.7        Unwrap            DGODS           Acc3        Acc3              1            A                    yes
         * #W_GODS_3_1.8          Wrap              GODS            Acc3        Acc3              1            A+                   no
         * #UW_DGODS_3_1.9        Unwrap            DGODS           Acc3        Acc3              0.6          A+                   no
         * #UW_DGODS_3_2.1        MF: Unwrap        DGODS           Acc3        Acc3              0.4          B                    yes
         * #W_GODS_3_2.2          Wrap              GODS            Acc2        Acc2              1            A++                  no
         * #UW_DBA_3_2.3          MF: Unwrap        DBA             Acc3        Acc3              0.6          C                    no
         * #UW_DGODS_3_2.4        Unwrap            DGODS           Acc3        Acc3              0.51         B                    yes
         * #BRN_DBA_3_2.5         Burn(Interop.)    DBA             Acc4        //                1.4          //                   //
         * #UW_DBA_3_2.6          Unwrap            DBA             Acc3        Acc3              0.6          C                    no
         * #W_BA_3_2.7            Wrap              BORED APE       Acc4        Acc4              1            C+                   no
         * #UW_DBA_3_2.8          Unwrap            DBA             Acc4        Acc4              0.6          D                    yes
         * #W_BA_3_2.9            Wrap              BORED APE       Acc4        Acc5              1            D+                   no
         * #UW_DBA_3_3.1          Unwrap            DBA             Acc5        Acc4              1            D+                   no
         */

        var tokenHolderGods = "0x7891f796a5d43466fC29F102069092aEF497a290";

        var godsTokenAddresss = "0x0e3a2a1f2146d86a604adc220b4967a898d7fe07";

        var godsTokenId = ["83257853", "83257854"];

        var gods = new web3.eth.Contract(
            knowledgeBase.IERC721ABI,
            godsTokenAddresss
        );

        await approveHost(tokenHolderGods);

        godsTokenId.map(async (id, index) => {
            await gods.methods
                .safeTransferFrom(tokenHolderGods, accounts[3], id)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: tokenHolderGods,
                    })
                );
        });

        // #W_GODS_3_1.1 START

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

        var lock = [true, true];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
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

        await wrapperResource.checkReserveData(
            tx,
            accounts[3],
            createItem,
            lock,
            blockToSkip,
            wrapper
        );

        assert.equal(
            await wrapper.methods.source(godsItemIds[0]).call(),
            web3.utils.toChecksumAddress(godsTokenAddresss)
        );

        await wrapperResource.checkBalance(
            tx,
            accounts[3],
            wrapper.options.address,
            "2",
            gods,
            godsTokenId
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

        // #W_GODS_3_1.1 END

        var tokenHolderBoredApe = "0x1b523DC90A79cF5ee5d095825e586e33780f7188";

        var boredApeTokenAddresss =
            "0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d";

        var boredApeTokenId = ["8188", "8187"];

        var boredApe = new web3.eth.Contract(
            knowledgeBase.IERC721ABI,
            boredApeTokenAddresss
        );

        await approveHost(tokenHolderBoredApe);

        boredApeTokenId.map(async (id, index) => {
            await boredApe.methods
                .safeTransferFrom(tokenHolderBoredApe, accounts[4], id)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: tokenHolderBoredApe,
                    })
                );
        });

        // #W_BA_3_1.2 START

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
            .mintItems(createItem)
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
            boredApe,
            [boredApeTokenId[0]]
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

        // #W_BA_3_1.2 END

        // #W_BA_3_1.3 START

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
            boredApe,
            [boredApeTokenId[1]]
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

        // #W_BA_3_1.3 END

        // #UW_DGODS_3_1.4 START

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

        // #UW_DGODS_3_1.4 END

        // #BRN_DGODS_3_1.5 START

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

        // #BRN_DGODS_3_1.5 END

        // #UW_DGODS_3_1.6 START
        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [godsTokenAddresss, godsTokenId[0], accounts[3], "0x", false, false]
        );

        await catchCall(wrapper.methods
            .burn(accounts[3], godsItemIds[0], "600000000000000000", data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            ), "Invalid amount");
        // #BRN_DGODS_3_1.6 END

        // #UW_DGODS_3_1.7 START

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
            gods,
            [godsTokenId[0]]
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

        // #UW_DGODS_3_1.7 END

        // #W_GODS_3_1.8 START

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
            gods,
            [godsTokenId[0]]
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

        // #W_GODS_3_1.8 END

        // #UW_DGODS_3_1.9 START

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
            gods,
            [godsTokenId[0]]
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

        // #UW_DGODS_3_1.9 END

        // #UW_DGODS_3_2.1 START

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

        // #UW_DGODS_3_2.1 END

        // #W_GODS_3_2.2 START

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
            gods,
            [godsTokenId[0]]
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

        // #W_GODS_3_2.2 END

        // #UW_DGODS_3_2.3 START

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
            gods,
            [godsTokenId[1]]
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

        // #UW_DGODS_3_2.3 END

        // #BRN_DBA_3_2.4 START
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

        await catchCall(wrapper.methods
            .burn(accounts[4], boredApeItemIds[0], "600000000000000000", data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[4],
                })
            ), "revert Invalid amount");
         // #UW_DGODS_3_2.4 END

        // #BRN_DBA_3_2.5 START

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

        // #BRN_DBA_3_2.5 END

        // #UW_DBA_3_2.6 START

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
            boredApe,
            [boredApeTokenId[0]]
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

        // #UW_DBA_3_2.6 END

        // #W_BA_3_2.7 START

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
            boredApe,
            [boredApeTokenId[0]]
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

        // #W_BA_3_2.7 END

        // #UW_DBA_3_2.8 START

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
            boredApe,
            [boredApeTokenId[1]]
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

        // #UW_DBA_3_2.8 END

        // #W_BA_3_2.9 START

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
            boredApe,
            [boredApeTokenId[1]]
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

        // #W_BA_3_2.9 END

        // #UW_DBA_3_3.1 START

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
            boredApe,
            [boredApeTokenId[1]]
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

        // #UW_DBA_3_3.1 END
    });

    it("#4", async () => {
        /**
         * Label            ||   Operation      || Token         || From || Receiver address || amount    || Token Reference    || Lock
         * #W_CS_4_1.1           Wrap              Crypto Skulls    Acc1        Acc1               1          A                    no
         *
         * #TRA_DCS_4_1.2        Transfer          DCS              Acc1        Acc2               1          //                   //
         * #UW_DCS_4_1.3         Unwrap            DCS              Acc2        Acc2               0.55       A                    no
         * #W_CS_4_1.4           Wrap              CS               Acc2        Acc1               1          A+                   yes
         * #UW_DCS_4_1.5         MF: Unwrap        DCS              Acc1        Acc2               1          A+                   yes
         * JumpToBlock ---------------------------------------------------------------------------------------------------------------------------
         * #UW_DCS_4_1.6         Unwrap            DCS              Acc1        Acc2               0.55       A+                   yes
         */
        var tokenHolderCryptoSkulls =
            "0x9aaf2f84afb2162a1efa57018bd4b1ae0da28cce";

        var cryptoSkullsTokenAddresss =
            "0xc1caf0c19a8ac28c41fe59ba6c754e4b9bd54de9";

        var cryptoSkullsTokenId = ["2344"];

        var cryptoSkulls = new web3.eth.Contract(
            knowledgeBase.IERC721ABI,
            cryptoSkullsTokenAddresss
        );

        await approveHost(tokenHolderCryptoSkulls);

        cryptoSkullsTokenId.map(async (id, index) => {
            await cryptoSkulls.methods
                .safeTransferFrom(tokenHolderCryptoSkulls, accounts[1], id)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: tokenHolderCryptoSkulls,
                    })
                );
        });

        cryptoSkullsTokenId.map(async (id, index) => {
            await cryptoSkulls.methods
                .approve(wrapper.options.address, id)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                );
        });

        // #W_CS_4_1.1 START

        var createItem = await wrapperResource.generateCreateItem(
            cryptoSkullsTokenId,
            [accounts[1]],
            [cryptoSkullsTokenAddresss],
            ["1000000000000000000"]
        );

        var tx = await wrapper.methods
            .mintItems(createItem, [false])
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var cryptoSkullsItemIds = logs
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
            "1",
            cryptoSkulls,
            cryptoSkullsTokenId
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            "1000000000000000000",
            cryptoSkullsItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "1000000000000000000",
            cryptoSkullsItemIds[0],
            wrapper
        );

        // #W_CS_4_1.1 END

        // #TRA_DCS_4_1.2 START

        var tx = await wrapper.methods
            .safeTransferFrom(
                accounts[1],
                accounts[2],
                cryptoSkullsItemIds[0],
                "1000000000000000000",
                "0x"
            )
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        // #TRA_DCS_4_1.2 END

        // #UW_DCS_4_1.3 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                cryptoSkullsTokenAddresss,
                cryptoSkullsTokenId[0],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );

        var amountToUnwrap = "550000000000000000";

        var tx = await wrapper.methods
            .burn(accounts[2], cryptoSkullsItemIds[0], amountToUnwrap, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[2],
            "1",
            cryptoSkulls,
            [cryptoSkullsTokenId[0]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            amountToUnwrap.mul(-1),
            cryptoSkullsItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnwrap.mul(-1),
            cryptoSkullsItemIds[0],
            wrapper
        );

        // #UW_DCS_4_1.3 END

        // #W_CS_4_1.4 START

        await cryptoSkulls.methods
            .approve(wrapper.options.address, cryptoSkullsTokenId[0])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        var createItem = await wrapperResource.generateCreateItem(
            cryptoSkullsTokenId,
            [accounts[1]],
            [cryptoSkullsTokenAddresss],
            ["550000000000000000"]
        );

        var tx = await wrapper.methods
            .mintItems(createItem, [true])
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[2] })
            );

        await wrapperResource.checkBalance(
            tx,
            accounts[2],
            wrapper.options.address,
            "1",
            cryptoSkulls,
            cryptoSkullsTokenId
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            "550000000000000000",
            cryptoSkullsItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "550000000000000000",
            cryptoSkullsItemIds[0],
            wrapper
        );

        // #W_CS_4_1.4 END

        // #UW_DCS_4_1.5 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                cryptoSkullsTokenAddresss,
                cryptoSkullsTokenId[0],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[1],
                    cryptoSkullsItemIds[0],
                    "1000000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "Cannot unlock"
        );

        // #UW_DCS_4_1.5 END

        // JumpToBlock START

        await blockchainConnection.fastForward(blockToSkip);

        // JumpToBlock END

        // #UW_DCS_4_1.6 START

        var tx = await wrapper.methods
            .burn(
                accounts[1],
                cryptoSkullsItemIds[0],
                "550000000000000000",
                data
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
            cryptoSkulls,
            [cryptoSkullsTokenId[0]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            "-550000000000000000",
            cryptoSkullsItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-550000000000000000",
            cryptoSkullsItemIds[0],
            wrapper
        );

        // #UW_DCS_4_1.6 END
    });

    it("#5", async () => {
        /**
         * Label            ||   Operation      || Token         || From || Receiver address || amount    || Token Reference    || Lock
         * #W_EP_5_1.1           Wrap              Ether Pirates    Acc1        Acc1               1          A                    yes
         *
         * #UW_DEP_5_1.2         Unwrap            DEP              Acc1        Acc2               0.6        A                    yes
         * #W_EP_5_1.3           Wrap              Ether Pirates    Acc2        Acc1               1          A+                   no
         * #UW_DEP_5_1.4         Unwrap            DEP              Acc1        Acc2               0.7        A+                   no
         */

        var tokenHolderEtherPirates =
            "0x43cf525d63987d17052d9891587bcfb9592c3ee2";

        var etherPiratesTokenAddresss =
            "0x62365089075e3fc959952134c283e0375b49f648";

        var etherPiratesTokenId = ["3456"];

        var etherPirates = new web3.eth.Contract(
            knowledgeBase.IERC721ABI,
            etherPiratesTokenAddresss
        );

        await approveHost(tokenHolderEtherPirates);

        etherPiratesTokenId.map(async (id, index) => {
            await etherPirates.methods
                .safeTransferFrom(tokenHolderEtherPirates, accounts[1], id)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: tokenHolderEtherPirates,
                    })
                );
        });

        etherPiratesTokenId.map(async (id, index) => {
            await etherPirates.methods
                .approve(wrapper.options.address, id)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                );
        });

        // #W_EP_5_1.1 START

        var amountToWrap = "1000000000000000000";

        var createItem = await wrapperResource.generateCreateItem(
            etherPiratesTokenId,
            [accounts[1]],
            [etherPiratesTokenAddresss],
            [amountToWrap]
        );

        var tx = await wrapper.methods
            .mintItems(createItem, [false])
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var etherPiratesItemIds = logs
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
        //     "1",
        //     etherPirates
        // );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToWrap,
            etherPiratesItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToWrap,
            etherPiratesItemIds[0],
            wrapper
        );

        // #W_EP_5_1.1 END

        // #UW_DEP_5_1.2 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                etherPiratesTokenAddresss,
                etherPiratesTokenId[0],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );

        var amountToUnwrap = "600000000000000000";

        var tx = await wrapper.methods
            .burn(accounts[1], etherPiratesItemIds[0], amountToUnwrap, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        // await wrapperResource.checkBalance(
        //     tx,
        //     wrapper.options.address,
        //     accounts[2],
        //     "1",
        //     etherPirates
        // );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToUnwrap.mul(-1),
            etherPiratesItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnwrap.mul(-1),
            etherPiratesItemIds[0],
            wrapper
        );

        // #UW_DEP_5_1.2 END

        // #W_EP_5_1.3 START

        await etherPirates.methods
            .approve(wrapper.options.address, etherPiratesTokenId[0])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        var amountToWrap = "600000000000000000";

        var createItem = await wrapperResource.generateCreateItem(
            etherPiratesTokenId,
            [accounts[1]],
            [etherPiratesTokenAddresss],
            [amountToWrap]
        );

        var tx = await wrapper.methods
            .mintItems(createItem, [false])
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[2] })
            );

        // await wrapperResource.checkBalance(
        //     tx,
        //     accounts[2],
        //     wrapper.options.address,
        //     "1",
        //     etherPirates
        // );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToWrap,
            etherPiratesItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToWrap,
            etherPiratesItemIds[0],
            wrapper
        );

        // #W_EP_5_1.3 END

        // #UW_DEP_5_1.4 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                etherPiratesTokenAddresss,
                etherPiratesTokenId[0],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );

        var amountToUnwrap = "700000000000000000";

        var tx = await wrapper.methods
            .burn(accounts[1], etherPiratesItemIds[0], amountToUnwrap, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        // await wrapperResource.checkBalance(
        //     tx,
        //     wrapper.options.address,
        //     accounts[2],
        //     "1",
        //     etherPirates
        // );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToUnwrap.mul(-1),
            etherPiratesItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnwrap.mul(-1),
            etherPiratesItemIds[0],
            wrapper
        );

        // #UW_DEP_5_1.4 START
    });

    it("#5.1", async () => {
        /**
         * Label            ||   Operation      || Token         || From || Receiver address || amount    || Token Reference    || Lock
         * #W_EP_5_1.1           Wrap              Ether Pirates    Acc1        Acc1               1          A                    yes
         *
         * #UW_DEP_5_1.2         Unwrap            DEP              Acc1        Acc2               0.6        A                    yes
         * #W_EP_5_1.3           Wrap              Ether Pirates    Acc2        Acc1               1          A+                   no
         * #UW_DEP_5_1.4         Unwrap            DEP              Acc1        Acc2               0.7        A+                   no
         */

        var tokenHolderDoodle = "0xc41a84d016b1391fa0f4048d37d3131988412360";

        var doodleTokenAddresss = "0x8a90cab2b38dba80c64b7734e58ee1db38b8992e";

        var doodleTokenId = ["5505"];

        var doodle = new web3.eth.Contract(
            knowledgeBase.IERC721ABI,
            doodleTokenAddresss
        );

        await approveHost(tokenHolderDoodle);

        doodleTokenId.map(async (id, index) => {
            await doodle.methods
                .safeTransferFrom(tokenHolderDoodle, accounts[1], id)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: tokenHolderDoodle,
                    })
                );
        });

        doodleTokenId.map(async (id, index) => {
            await doodle.methods.approve(wrapper.options.address, id).send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );
        });

        // #W_EP_5_1.1 START

        var amountToWrap = "1000000000000000000";

        var createItem = await wrapperResource.generateCreateItem(
            doodleTokenId,
            [accounts[1]],
            [doodleTokenAddresss],
            [amountToWrap]
        );

        var tx = await wrapper.methods
            .mintItems(createItem, [false])
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var doodleItemIds = logs
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
            "1",
            doodle,
            doodleTokenId
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToWrap,
            doodleItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToWrap,
            doodleItemIds[0],
            wrapper
        );

        // #W_EP_5_1.1 END

        // #UW_DEP_5_1.2 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                doodleTokenAddresss,
                doodleTokenId[0],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );

        var amountToUnwrap = "600000000000000000";

        var tx = await wrapper.methods
            .burn(accounts[1], doodleItemIds[0], amountToUnwrap, data)
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
            doodle,
            doodleTokenId
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToUnwrap.mul(-1),
            doodleItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnwrap.mul(-1),
            doodleItemIds[0],
            wrapper
        );

        // #UW_DEP_5_1.2 END

        // #W_EP_5_1.3 START

        await doodle.methods
            .approve(wrapper.options.address, doodleTokenId[0])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        var amountToWrap = "600000000000000000";

        var createItem = await wrapperResource.generateCreateItem(
            doodleTokenId,
            [accounts[1]],
            [doodleTokenAddresss],
            [amountToWrap]
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
            doodle,
            doodleTokenId
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToWrap,
            doodleItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToWrap,
            doodleItemIds[0],
            wrapper
        );

        // #W_EP_5_1.3 END

        // #UW_DEP_5_1.4 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                doodleTokenAddresss,
                doodleTokenId[0],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );

        var amountToUnwrap = "700000000000000000";

        var tx = await wrapper.methods
            .burn(accounts[1], doodleItemIds[0], amountToUnwrap, data)
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
            doodle,
            doodleTokenId
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToUnwrap.mul(-1),
            doodleItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnwrap.mul(-1),
            doodleItemIds[0],
            wrapper
        );

        // #UW_DEP_5_1.4 START
    });

    it("#6", async () => {
        /**
         * Label                ||   Operation        || Token              || From  || Receiver address                  || amount               || Token Reference       || Lock
         * #W_VOX_SB_NFF_6_1.1       Wrap                VOX, Sandbox, Fungi    Acc1    Acc2, Acc3,Acc2, Acc3,Acc2, Acc3    1+1+1+1+1+1                 A, B, C, D, E, F      yes, no, yes, no, yes,no
         *
         * #UW_DVOX_DSB_DNFF_6_1.2   MF: Unwrap Batch    DVOX,DSB,DNFF          Acc2        Acc2                            1+1+1                       A, C, E               yes, yes, yes
         * #UW_DVOX_DSB_DNFF_6_1.3   MF: Unwrap Batch    DVOX,DSB,DNFF          Acc3        Acc3                            0.51+0.51+0.51              B,D,F                 no, no, no
         * JumpToBlock -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
         * #UW_DVOX_DSB_DNFF_6_1.4   Unwrap Batch        DVOX,DSB,DNFF          Acc2        Acc2                            1+1+1                       A, C, E               yes, yes, yes
         * #W_VOX_SB_NFF_6_1.5       Wrap                VOX, Sandbox, Fungi    Acc2        Acc3                            1+1+1+1+1+1                 A+,C+,E+,G,H,I        yes, yes, yes,yes, yes, yes
         * #UW_DVOX_DSB_DNFF_6_1.6   MF: Unwrap Batch    DVOX,DSB,DNFF          Acc3        Acc2                            1+1+1+1+1+1+1+1+1           A+,B,G,C+,D,H,E+,F,I  yes, no, yes, no, yes,no, yes, yes, yes
         * JumpToBlock -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
         * #UW_DVOX_DSB_DNFF_6_1.7   MF: Unwrap Batch    DVOX,DSB,DNFF          Acc3        Acc2                            1+0.51+1+1+1+0.51+1+1+0.51  A+,B,G,C+,D,H,E+,F,I  yes, no, yes, no, yes,no, yes, yes, yes
         * #UW_DVOX_DSB_DNFF_6_1.8   Unwrap Batch        DVOX,DSB,DNFF          Acc3        Acc2                            1+1+0.51+1+1+0.51+1+1+0.51  A+,B,G,C+,D,H,E+,F,I  yes, no, yes, no, yes,no, yes, yes, yes
         */

        var tokenHolderVox = "0xe995a353a97a33e2dbac9e70ba6778db86728f4e";

        var voxTokenAddresss = "0xad9fd7cb4fc7a0fbce08d64068f60cbde22ed34c";

        var voxTokenId = ["4160", "4161", "4162"];

        var vox = new web3.eth.Contract(
            knowledgeBase.IERC721ABI,
            voxTokenAddresss
        );

        await approveHost(tokenHolderVox);

        await Promise.all(voxTokenId.map(id => vox.methods
                .safeTransferFrom(tokenHolderVox, accounts[1], id)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: tokenHolderVox,
                    })
                )
        ));

        await Promise.all(voxTokenId.map(id => vox.methods.approve(wrapper.options.address, id).send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            )
        ));

        var tokenHolderSandbox = "0x9cfA73B8d300Ec5Bf204e4de4A58e5ee6B7dC93C";

        var sandboxTokenAddresss = "0x50f5474724e0ee42d9a4e711ccfb275809fd6d4a";

        var sandboxTokenId = ["19200", "19201", "19203"];

        var sandbox = new web3.eth.Contract(
            knowledgeBase.IERC721ABI,
            sandboxTokenAddresss
        );

        await approveHost(tokenHolderSandbox);

        await Promise.all(sandboxTokenId.map(id => sandbox.methods
                .safeTransferFrom(tokenHolderSandbox, accounts[1], id)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: tokenHolderSandbox,
                    })
                )
        ));

        await Promise.all(sandboxTokenId.map(id => sandbox.methods.approve(wrapper.options.address, id).send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            )
        ));

        var tokenHolderFunghi = "0x1d2c4cd9bee9dfe088430b95d274e765151c32db";

        var funghiTokenAddresss = "0x5f47079d0e45d95f5d5167a480b695883c4e47d9";

        var funghiTokenId = ["18", "97", "20"];

        var funghi = new web3.eth.Contract(
            knowledgeBase.IERC721ABI,
            funghiTokenAddresss
        );

        await approveHost(tokenHolderFunghi);

        await Promise.all(funghiTokenId.map(id => funghi.methods
                .safeTransferFrom(tokenHolderFunghi, accounts[1], id)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: tokenHolderFunghi,
                    })
                )
        ));

        await Promise.all(funghiTokenId.map(id => funghi.methods.approve(wrapper.options.address, id).send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            )
        ));

        // #W_VOX_SB_NFF_6_1.1 START

        var createItem = await wrapperResource.generateCreateItem(
            [
                voxTokenId[0],
                voxTokenId[1],
                sandboxTokenId[0],
                sandboxTokenId[1],
                funghiTokenId[0],
                funghiTokenId[1],
            ],
            [
                accounts[2],
                accounts[3],
                accounts[2],
                accounts[3],
                accounts[2],
                accounts[3],
            ],
            [
                voxTokenAddresss,
                voxTokenAddresss,
                sandboxTokenAddresss,
                sandboxTokenAddresss,
                funghiTokenAddresss,
                funghiTokenAddresss,
            ],
            [
                "1000000000000000000",
                "1000000000000000000",
                "1000000000000000000",
                "1000000000000000000",
                "1000000000000000000",
                "1000000000000000000",
            ]
        );

        var tx = await wrapper.methods
            .mintItems(createItem, [true, false, true, false, true, false])
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var itemIds = logs
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
            "2",
            vox,
            [voxTokenId[0], voxTokenId[1]]
        );

        await wrapperResource.checkBalance(
            tx,
            accounts[1],
            wrapper.options.address,
            "2",
            sandbox,
            [sandboxTokenId[0], sandboxTokenId[1]]
        );

        await wrapperResource.checkBalance(
            tx,
            accounts[1],
            wrapper.options.address,
            "2",
            funghi,
            [funghiTokenId[0], funghiTokenId[1]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            "1000000000000000000",
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "1000000000000000000",
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            "1000000000000000000",
            itemIds[2],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "1000000000000000000",
            itemIds[2],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            "1000000000000000000",
            itemIds[4],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "1000000000000000000",
            itemIds[4],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "2000000000000000000",
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "2000000000000000000",
            itemIds[2],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "2000000000000000000",
            itemIds[4],
            wrapper
        );

        // #W_VOX_SB_NFF_6_1.1 END

        // #UW_DVOX_DSB_DNFF_6_1.2 START

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [voxTokenAddresss, voxTokenId[0], accounts[3], "0x", false, false]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                sandboxTokenAddresss,
                sandboxTokenId[0],
                accounts[3],
                "0x",
                false,
                false,
            ]
        );
        datas[2] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                funghiTokenAddresss,
                funghiTokenId[0],
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
                    accounts[2],
                    [itemIds[0], itemIds[2], itemIds[4]],
                    [
                        "1000000000000000000",
                        "1000000000000000000",
                        "1000000000000000000",
                    ],
                    encodeDatas
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[2],
                    })
                ),
            "Cannot unlock"
        );

        // #UW_DVOX_DSB_DNFF_6_1.2 END

        // #UW_DVOX_DSB_DNFF_6_1.3 START

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [voxTokenAddresss, voxTokenId[1], accounts[3], "0x", false, false]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                sandboxTokenAddresss,
                sandboxTokenId[1],
                accounts[3],
                "0x",
                false,
                false,
            ]
        );
        datas[2] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                funghiTokenAddresss,
                funghiTokenId[1],
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
                    accounts[3],
                    [itemIds[0], itemIds[2], itemIds[4]],
                    [
                        "510000000000000000",
                        "510000000000000000",
                        "510000000000000000",
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

        // #UW_DVOX_DSB_DNFF_6_1.3 END

        // JumpToBlock START
        await blockchainConnection.fastForward(blockToSkip);
        // JumpToBlock END

        // #UW_DVOX_DSB_DNFF_6_1.4 START

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [voxTokenAddresss, voxTokenId[0], accounts[2], "0x", false, false]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                sandboxTokenAddresss,
                sandboxTokenId[0],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );
        datas[2] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                funghiTokenAddresss,
                funghiTokenId[0],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        var tx = await wrapper.methods
            .burnBatch(
                accounts[2],
                [itemIds[0], itemIds[2], itemIds[4]],
                [
                    "1000000000000000000",
                    "1000000000000000000",
                    "1000000000000000000",
                ],
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[2],
            "1",
            vox,
            [voxTokenId[0]]
        );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[2],
            "1",
            sandbox,
            [sandboxTokenId[0]]
        );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[2],
            "1",
            funghi,
            [funghiTokenId[0]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            "-1000000000000000000",
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            "-1000000000000000000",
            itemIds[2],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            "-1000000000000000000",
            itemIds[4],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-1000000000000000000",
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-1000000000000000000",
            itemIds[2],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-1000000000000000000",
            itemIds[4],
            wrapper
        );

        // #UW_DVOX_DSB_DNFF_6_1.4 END

        await sandbox.methods
            .safeTransferFrom(accounts[1], accounts[2], sandboxTokenId[2])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await vox.methods
            .safeTransferFrom(accounts[1], accounts[2], voxTokenId[2])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await funghi.methods
            .safeTransferFrom(accounts[1], accounts[2], funghiTokenId[2])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await funghi.methods
            .approve(wrapper.options.address, funghiTokenId[0])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        await funghi.methods
            .approve(wrapper.options.address, funghiTokenId[2])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        await vox.methods.approve(wrapper.options.address, voxTokenId[0]).send(
            blockchainConnection.getSendingOptions({
                from: accounts[2],
            })
        );

        await vox.methods.approve(wrapper.options.address, voxTokenId[2]).send(
            blockchainConnection.getSendingOptions({
                from: accounts[2],
            })
        );

        await sandbox.methods
            .approve(wrapper.options.address, sandboxTokenId[0])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        await sandbox.methods
            .approve(wrapper.options.address, sandboxTokenId[2])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        // #W_VOX_SB_NFF_6_1.5 START

        var createItem = await wrapperResource.generateCreateItem(
            [
                voxTokenId[0],
                sandboxTokenId[0],
                funghiTokenId[0],
                voxTokenId[2],
                sandboxTokenId[2],
                funghiTokenId[2],
            ],
            [
                accounts[3],
                accounts[3],
                accounts[3],
                accounts[3],
                accounts[3],
                accounts[3],
            ],
            [
                voxTokenAddresss,
                sandboxTokenAddresss,
                funghiTokenAddresss,
                voxTokenAddresss,
                sandboxTokenAddresss,
                funghiTokenAddresss,
            ],
            [
                "1000000000000000000",
                "1000000000000000000",
                "1000000000000000000",
                "1000000000000000000",
                "1000000000000000000",
                "1000000000000000000",
            ]
        );

        var tx = await wrapper.methods
            .mintItems(createItem, [true, true, true, true, true, true])
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[2] })
            );

        await wrapperResource.checkBalance(
            tx,
            accounts[2],
            wrapper.options.address,
            "2",
            vox,
            [voxTokenId[0], voxTokenId[2]]
        );

        await wrapperResource.checkBalance(
            tx,
            accounts[2],
            wrapper.options.address,
            "2",
            sandbox,
            [sandboxTokenId[0], sandboxTokenId[2]]
        );

        await wrapperResource.checkBalance(
            tx,
            accounts[2],
            wrapper.options.address,
            "2",
            funghi,
            [funghiTokenId[0], funghiTokenId[2]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "2000000000000000000",
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "2000000000000000000",
            itemIds[2],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "2000000000000000000",
            itemIds[4],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "2000000000000000000",
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "2000000000000000000",
            itemIds[2],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "2000000000000000000",
            itemIds[4],
            wrapper
        );

        // #W_VOX_SB_NFF_6_1.5 END

        // #UW_DVOX_DSB_DNFF_6_1.6 START

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [voxTokenAddresss, voxTokenId[0], accounts[2], "0x", false, false]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [voxTokenAddresss, voxTokenId[1], accounts[2], "0x", false, false]
        );
        datas[2] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [voxTokenAddresss, voxTokenId[2], accounts[2], "0x", false, false]
        );
        datas[3] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                sandboxTokenAddresss,
                sandboxTokenId[0],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );
        datas[4] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                sandboxTokenAddresss,
                sandboxTokenId[1],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );
        datas[5] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                sandboxTokenAddresss,
                sandboxTokenId[2],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );
        datas[6] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                funghiTokenAddresss,
                funghiTokenId[0],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );
        datas[7] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                funghiTokenAddresss,
                funghiTokenId[1],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );
        datas[8] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                funghiTokenAddresss,
                funghiTokenId[2],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        await catchCall(
            wrapper.methods
                .burnBatch(
                    accounts[3],
                    [
                        itemIds[0],
                        itemIds[0],
                        itemIds[0],
                        itemIds[2],
                        itemIds[2],
                        itemIds[2],
                        itemIds[4],
                        itemIds[4],
                        itemIds[4],
                    ],
                    [
                        "1000000000000000000",
                        "1000000000000000000",
                        "1000000000000000000",
                        "1000000000000000000",
                        "1000000000000000000",
                        "1000000000000000000",
                        "1000000000000000000",
                        "1000000000000000000",
                        "1000000000000000000",
                    ],
                    encodeDatas
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "Cannot unlock"
        );

        // #UW_DVOX_DSB_DNFF_6_1.6 END

        // JumpToBlock START

        await blockchainConnection.fastForward(blockToSkip);

        // JumpToBlock END

        // #UW_DVOX_DSB_DNFF_6_1.7 START

        await catchCall(
            wrapper.methods
                .burnBatch(
                    accounts[3],
                    [
                        itemIds[0],
                        itemIds[0],
                        itemIds[0],
                        itemIds[2],
                        itemIds[2],
                        itemIds[2],
                        itemIds[4],
                        itemIds[4],
                        itemIds[4],
                    ],
                    [
                        "1000000000000000000",
                        "510000000000000000",
                        "1000000000000000000",
                        "1000000000000000000",
                        "1000000000000000000",
                        "510000000000000000",
                        "1000000000000000000",
                        "1000000000000000000",
                        "510000000000000000",
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

        // #UW_DVOX_DSB_DNFF_6_1.7 END

        // #UW_DVOX_DSB_DNFF_6_1.8 START

        var tx = await wrapper.methods
            .burnBatch(
                accounts[3],
                [
                    itemIds[0],
                    itemIds[0],
                    itemIds[0],
                    itemIds[2],
                    itemIds[2],
                    itemIds[2],
                    itemIds[4],
                    itemIds[4],
                    itemIds[4],
                ],
                [
                    "1000000000000000000",
                    "1000000000000000000",
                    "510000000000000000",
                    "1000000000000000000",
                    "1000000000000000000",
                    "510000000000000000",
                    "1000000000000000000",
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

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[2],
            "3",
            vox,
            voxTokenId
        );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[2],
            "3",
            sandbox,
            sandboxTokenId
        );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[2],
            "3",
            funghi,
            funghiTokenId
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "-2510000000000000000",
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "-2510000000000000000",
            itemIds[2],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "-2510000000000000000",
            itemIds[4],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-2510000000000000000",
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-2510000000000000000",
            itemIds[2],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-2510000000000000000",
            itemIds[4],
            wrapper
        );

        // #UW_DVOX_DSB_DNFF_6_1.8 END
    });
});
