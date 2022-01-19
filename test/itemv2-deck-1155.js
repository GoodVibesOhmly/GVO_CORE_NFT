var utilities = require("../util/utilities");
var itemsv2 = require("../resources/itemsv2");
var itemProjection = require("../resources/itemProjection");
var wrapperResource = require("../resources/wrapper");
const blockchainConnection = require("../util/blockchainConnection");
var keccak = require("keccak");
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
                utilities.voidBytes32,
            ]
        );

        mainInterface = await itemsv2.getMainInterface();

        deployParam = abi.encode(
            ["address", "bytes"],
            [accounts[1], deployParam]
        );

        var ERC1155DeckWrapperUtilities = await compile(
            "projection/ERC1155Deck/ERC1155DeckWrapper",
            "ERC1155DeckWrapperUtilities"
        );
        var eRC1155DeckWrapperUtilities = await new web3.eth.Contract(
            ERC1155DeckWrapperUtilities.abi
        )
            .deploy({ data: ERC1155DeckWrapperUtilities.bin })
            .send(blockchainConnection.getSendingOptions());
        var contractPath =
            ERC1155DeckWrapperUtilities.ast.absolutePath +
            ":" +
            ERC1155DeckWrapperUtilities.contractName;
        var contractKey =
            "__$" +
            keccak("keccak256")
                .update(contractPath)
                .digest()
                .toString("hex")
                .slice(0, 34) +
            "$__";

        var ERC1155Wrapper = await compile(
            "projection/ERC1155Deck/ERC1155DeckWrapper"
        );
        ERC1155Wrapper.bin = ERC1155Wrapper.bin
            .split(contractKey)
            .join(eRC1155DeckWrapperUtilities.options.address.substring(2));
        var wrapperData = await new web3.eth.Contract(ERC1155Wrapper.abi)
            .deploy({ data: ERC1155Wrapper.bin, arguments: ["0x"] })
            .encodeABI();

        var blockNumber = abi.encode(["uint256"], [blockToSkip]);

        var data = await itemsv2.createCollection(
            headerCollection.host,
            items,
            wrapperData,
            blockNumber,
            headerCollection
        );

        wrapper = new web3.eth.Contract(
            ERC1155Wrapper.abi,
            data.projection.options.address
        );

        console.log("Wrapper Uri", await wrapper.methods.uri().call());
        assert.equal(
            await wrapper.methods.uri().call(),
            await mainInterface.methods
                .collectionUri(await wrapper.methods.collectionId().call())
                .call()
        );

        var ZeroDecimals = await compile("../resources/ERC1155ZeroDecimals");
        wrapperData = await new web3.eth.Contract(ZeroDecimals.abi)
            .deploy({ data: ZeroDecimals.bin, arguments: ["0x"] })
            .encodeABI();

        data = await itemsv2.createCollection(
            headerCollection.host,
            items,
            wrapperData,
            "0x",
            headerCollection
        );

        zeroDecimals = new web3.eth.Contract(
            ZeroDecimals.abi,
            data.projection.options.address
        );
    });

    it("#1", async () => {
        /**
         * Label                ||   Operation        || Token              || From  || Receiver address     || amount               || Token Reference       || Lock
         * #W_ZRN_1_1.1              Wrap                Zerion                Acc1     Acc1                    3                       A                        yes
         * #W_PRL_1_1.2              Wrap                Parallel              Acc2     Acc3                    1                       B                        no
         * #W_PRL_1_1.3              Wrap                Parallel              Acc2     Acc2                    1                       C                        yes
         * #W_OS_1_1.4               Wrap                OS                    Acc3     Acc4, Acc4              x, y                    D, D+                    yes, no
         *
         * #UW_DZRN_1_1.5            MF: Unwrap          DZRN                   Acc1    Acc3                    2.51                    A                        yes
         * #TRA_DZRN_1_1.6           Transfer            DZRN                   Acc1    Acc3                    1                       //                       //
         * #UW_DZRN_1_1.7            MF: Unwrap          DZRN                   Acc3    Acc1                    1                       A                        yes
         * #UW_DZRN_1_1.8            Unwrap              DZRN                   Acc1    Acc4                    2                       A                        yes
         * #UW_DZRN_1_1.9            MF: Unwrap          DZRN                   Acc3    Acc1                    1                       A (passing C key)        yes
         * #UW_DZRN_1_2.1            Unwrap              DZRN                   Acc3    Acc1                    1                       A                        yes
         * #UW_DZRN_1_2.2            MF: Unwrap          DZRN                   Acc3    Acc3                    1                       A                        yes
         * #UW_DZRN_1_2.3            Unwrap              DPRL                   Acc2    Acc3                    1                       B                        no
         * #UW_DZRN_1_2.4            MF: Unwrap          DOS                    Acc4    Acc3                    z                       D                        yes
         * #UW_DZRN_1_2.5            Unwrap              DOS                    Acc4    Acc4                    y/2                     D+                       no
         * #UW_DZRN_1_2.6            MF: Unwrap          DOS                    Acc4    Acc4                    y/2                     D                        yes
         * JumpToBlock -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
         * #UW_DZRN_1_2.7            MF: Unwrap          DPRL                   Acc3    Acc2                    0.51                    C (passing empty key)    yes
         * #UW_DZRN_1_2.8            MF: Unwrap          DPRL                   Acc3    Acc2                    0.51                    C (passing D key)        yes
         * #UW_DZRN_1_2.9            Unwrap              DPRL                   Acc3    Acc2                    0.51                    C                        yes
         * #UWB_DZRN_1_3.1           Unwrap Batch        DOS                    Acc4    Acc3, Acc3              x, y/2                  D,D+                     yes,no
         */
        var tokenHolderZerion = "0xecde04e088828c93a1003b9388727a25c064e5e3";

        var zerionTokenAddresss = "0x74EE68a33f6c9f113e22B3B77418B75f85d07D22";

        var zerionTokenId = ["10"];

        var zerion = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            zerionTokenAddresss
        );

        await approveHost(tokenHolderZerion);

        await Promise.all(
            zerionTokenId.map(async (id, index) => {
                await zerion.methods
                    .safeTransferFrom(
                        tokenHolderZerion,
                        accounts[1],
                        id,
                        3,
                        "0x"
                    )
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderZerion,
                        })
                    );
            })
        );

        await zerion.methods
            .setApprovalForAll(wrapper.options.address, accounts[1])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        // #W_ZRN_1_1.1 START

        var createItem = await wrapperResource.generateCreateItem(
            zerionTokenId,
            [accounts[1]],
            [zerionTokenAddresss],
            ["3"]
        );

        var lock = [true];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var zerionItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        var zerionKey = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3(
                        "ReserveData(address,address,uint256,uint256,uint256,bytes32)"
                    )
            )
            .map(
                (it) =>
                    web3.eth.abi.decodeParameters(
                        ["uint256", "uint256", "bytes32"],
                        it.data
                    )[2]
            );

        assert.equal(
            (await wrapper.methods.source(zerionItemIds[0]).call())
                .tokenAddress,
            web3.utils.toChecksumAddress(zerionTokenAddresss)
        );

        await wrapperResource.checkBalance1155(
            tx,
            accounts[1],
            wrapper.options.address,
            "3",
            zerion,
            zerionTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            "3000000000000000000",
            zerionItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "3000000000000000000",
            zerionItemIds[0],
            wrapper
        );

        // #W_ZRN_1_1.1 END

        var tokenHolderParallel = "0xd0829f8dda953e85da70b0a62a2f4e9a774ebf16";

        var parallelTokenAddresss =
            "0x76be3b62873462d2142405439777e971754e8e77";

        var parallelTokenId = ["10144", "10150"];

        var parallel = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            parallelTokenAddresss
        );

        await approveHost(tokenHolderParallel);

        await Promise.all(
            parallelTokenId.map(async (id, index) => {
                await parallel.methods
                    .safeTransferFrom(
                        tokenHolderParallel,
                        accounts[2],
                        id,
                        1,
                        "0x"
                    )
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderParallel,
                        })
                    );
            })
        );

        await parallel.methods
            .setApprovalForAll(wrapper.options.address, accounts[2])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        // #W_PRL_1_1.2 START

        var createItem = await wrapperResource.generateCreateItem(
            [parallelTokenId[0]],
            [accounts[3]],
            [parallelTokenAddresss],
            ["1"]
        );

        var lock = [false];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[2] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var parallelItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        await wrapperResource.checkBalance1155(
            tx,
            accounts[2],
            wrapper.options.address,
            "1",
            parallel,
            parallelTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "1000000000000000000",
            parallelItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "1000000000000000000",
            parallelItemIds[0],
            wrapper
        );

        // #W_PRL_1_1.2 END

        // #W_PRL_1_1.3 START

        var data = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [["1"], [accounts[2]], true]
        );

        tx = await parallel.methods
            .safeTransferFrom(
                accounts[2],
                wrapper.options.address,
                parallelTokenId[1],
                1,
                data
            )
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[2] })
            );
        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var parallelKey = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3(
                        "ReserveData(address,address,uint256,uint256,uint256,bytes32)"
                    )
            )
            .map(
                (it) =>
                    web3.eth.abi.decodeParameters(
                        ["uint256", "uint256", "bytes32"],
                        it.data
                    )[2]
            );

        await wrapperResource.checkBalance1155(
            tx,
            accounts[2],
            wrapper.options.address,
            "1",
            parallel,
            parallelTokenId[1]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            "1000000000000000000",
            parallelItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "1000000000000000000",
            parallelItemIds[0],
            wrapper
        );

        // #W_PRL_1_1.3 END

        var tokenHolderOs = "0x43126fb5e1fe86bb44b084d09f651358b97ebf0c";

        var osTokenAddresss = "0x8d53aFBEB62C18917B5F71385d52E8ba87669794";

        var osTokenId = ["553791398095120659341456634783597180523460212593"];

        var os = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            osTokenAddresss
        );

        await approveHost(tokenHolderOs);

        await Promise.all(
            osTokenId.map(async (id, index) => {
                await os.methods
                    .safeTransferFrom(
                        tokenHolderOs,
                        accounts[3],
                        id,
                        await os.methods.balanceOf(tokenHolderOs, id).call(),
                        "0x"
                    )
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderOs,
                        })
                    );
            })
        );

        await os.methods
            .setApprovalForAll(wrapper.options.address, accounts[3])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        var balance = await os.methods
            .balanceOf(accounts[3], osTokenId[0])
            .call();

        // #W_OS_1_1.4 START

        var amountToWrap = [balance.div(6), balance.div(9)];
        var createItem = await wrapperResource.generateCreateItem(
            [osTokenId[0], osTokenId[0]],
            [accounts[4], accounts[4]],
            [osTokenAddresss, osTokenAddresss],
            amountToWrap
        );

        console.log(balance);
        console.log(amountToWrap);

        var lock = [true, false];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[3] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var osItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        var osKey = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3(
                        "ReserveData(address,address,uint256,uint256,uint256,bytes32)"
                    )
            )
            .map(
                (it) =>
                    web3.eth.abi.decodeParameters(
                        ["uint256", "uint256", "bytes32"],
                        it.data
                    )[2]
            );

        await wrapperResource.checkBalance1155(
            tx,
            accounts[3],
            wrapper.options.address,
            amountToWrap[0].add(amountToWrap[1]),
            os,
            osTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[4],
            amountToWrap[0].add(amountToWrap[1]),
            osItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToWrap[0].add(amountToWrap[1]),
            osItemIds[0],
            wrapper
        );

        // #W_OS_1_1.4 END

        // #UW_DZRN_1_1.5 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                zerionTokenAddresss,
                zerionTokenId[0],
                accounts[3],
                zerionKey,
                "0x",
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[1],
                    zerionItemIds[0],
                    "2510000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "amount"
        );

        // #UW_DZRN_1_1.5 END

        // #TRA_DZRN_1_1.6 START

        await wrapper.methods
            .safeTransferFrom(
                accounts[1],
                accounts[3],
                zerionItemIds[0],
                "1000000000000000000",
                "0x"
            )
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        // #TRA_DZRN_1_1.6 END

        // #UW_DZRN_1_1.7 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                zerionTokenAddresss,
                zerionTokenId[0],
                accounts[1],
                zerionKey,
                "0x",
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[3],
                    zerionItemIds[0],
                    "1000000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "cannot unlock"
        );

        // #UW_DZRN_1_1.7 END

        // #UW_DZRN_1_1.8 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                zerionTokenAddresss,
                zerionTokenId[0],
                accounts[4],
                zerionKey,
                "0x",
            ]
        );

        var tx = await wrapper.methods
            .burn(accounts[1], zerionItemIds[0], "2000000000000000000", data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[4],
            "2",
            zerion,
            zerionTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            "-2000000000000000000",
            zerionItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-2000000000000000000",
            zerionItemIds[0],
            wrapper
        );

        // #UW_DZRN_1_1.8 END

        // #UW_DZRN_1_1.9 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                zerionTokenAddresss,
                zerionTokenId[0],
                accounts[1],
                parallelKey,
                "0x",
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[3],
                    zerionItemIds[0],
                    "1000000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "invalid reserve"
        );

        // #UW_DZRN_1_1.9 END

        // #UW_DZRN_1_2.1 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                zerionTokenAddresss,
                zerionTokenId[0],
                accounts[1],
                [utilities.voidBytes32],
                "0x",
            ]
        );

        var tx = await wrapper.methods
            .burn(accounts[3], zerionItemIds[0], "1000000000000000000", data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[1],
            "1",
            zerion,
            zerionTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "-1000000000000000000",
            zerionItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-1000000000000000000",
            zerionItemIds[0],
            wrapper
        );

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                zerionTokenAddresss,
                zerionTokenId[0],
                accounts[3],
                zerionKey,
                "0x",
            ]
        );

        // #UW_DZRN_1_2.1 END

        // #UW_DZRN_1_2.2 START

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[3],
                    zerionItemIds[0],
                    "1000000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "insuff"
        );

        // #UW_DZRN_1_2.2 END

        // #UW_DZRN_1_2.3 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                parallelTokenAddresss,
                parallelTokenId[0],
                accounts[3],
                zerionKey,
                "0x",
            ]
        );

        await wrapper.methods
            .burn(accounts[2], parallelItemIds[0], "1000000000000000000", data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[3],
            "1",
            parallel,
            parallelTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            "-1000000000000000000",
            parallelItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-1000000000000000000",
            parallelItemIds[0],
            wrapper
        );

        // #UW_DZRN_1_2.3 END

        // #UW_DZRN_1_2.4 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [osTokenAddresss, osTokenId[0], accounts[3], osKey, "0x"]
        );

        var amountToUnwrap = amountToWrap[0].add(amountToWrap[1]).div(2);

        await catchCall(
            wrapper.methods
                .burn(accounts[4], osItemIds[0], amountToUnwrap, data)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[4],
                    })
                ),
            "Cannot unlock"
        );

        // #UW_DZRN_1_2.4 END

        // #UW_DZRN_1_2.5 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                osTokenAddresss,
                osTokenId[0],
                accounts[4],
                [utilities.voidBytes32],
                "0x",
            ]
        );

        var amountToUnwrap = amountToWrap[1].div(2);

        await wrapper.methods
            .burn(accounts[4], osItemIds[0], amountToUnwrap, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[4],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[4],
            amountToUnwrap,
            os,
            osTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[4],
            amountToUnwrap.mul(-1),
            osItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnwrap.mul(-1),
            osItemIds[0],
            wrapper
        );

        // #UW_DZRN_1_2.5 END

        // #UW_DZRN_1_2.6 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [osTokenAddresss, osTokenId[0], accounts[4], osKey, "0x"]
        );

        var amountToUnwrap = amountToWrap[0].add(amountToWrap[1]).div(2);

        await catchCall(
            wrapper.methods
                .burn(accounts[4], osItemIds[0], amountToUnwrap, data)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[4],
                    })
                ),
            "cannot unlock"
        );

        // #UW_DZRN_1_2.6 END

        // JumpToBlock START

        await blockchainConnection.fastForward(blockToSkip);

        // JumpToBlock END

        // #UW_DZRN_1_2.7 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                parallelTokenAddresss,
                parallelTokenId[1],
                accounts[2],
                [utilities.voidBytes32],
                "0x",
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[3],
                    parallelItemIds[0],
                    "510000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "Insufficient amount"
        );

        // #UW_DZRN_1_2.7 END

        // #UW_DZRN_1_2.8 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                parallelTokenAddresss,
                parallelTokenId[1],
                accounts[2],
                osKey,
                "0x",
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[3],
                    parallelItemIds[0],
                    "510000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "invalid reserve"
        );

        // #UW_DZRN_1_2.8 END

        // #UW_DZRN_1_2.9 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                parallelTokenAddresss,
                parallelTokenId[1],
                accounts[2],
                parallelKey,
                "0x",
            ]
        );

        var tx = await wrapper.methods
            .burn(accounts[3], parallelItemIds[0], "510000000000000000", data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[2],
            "1",
            parallel,
            parallelTokenId[1]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "-510000000000000000",
            parallelItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-510000000000000000",
            parallelItemIds[0],
            wrapper
        );

        // #UW_DZRN_1_2.9 END

        // #UWB_DZRN_1_3.1 START

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [osTokenAddresss, osTokenId[0], accounts[3], osKey, "0x"]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                osTokenAddresss,
                osTokenId[0],
                accounts[3],
                [utilities.voidBytes32],
                "0x",
            ]
        );
        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        var amountToUnWrap = [amountToWrap[0], amountToWrap[1].div(2)];

        var tx = await wrapper.methods
            .burnBatch(
                accounts[4],
                [osItemIds[0], osItemIds[0]],
                amountToUnWrap,
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[4],
                })
            );

        var amount = amountToUnWrap[0].add(amountToUnWrap[1]);

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[3],
            amount,
            os,
            osTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[4],
            amount.mul(-1),
            osItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amount.mul(-1),
            osItemIds[0],
            wrapper
        );

        // #UWB_DZRN_1_3.1 END
    });

    it("#2", async () => {
        /**
         * Label                ||   Operation        || Token              || From  || Receiver address     || amount               || Token Reference       || Lock
         * #W_APE_2_1.1              Wrap                Elite Ape             Acc1     Acc1, Acc1              3,4                     A,A+                     yes,yes
         * #W_ADI_2_1.2              Wrap                Adidas                Acc2     Acc2                    3                       B                        yes
         * #W_ADI_2_1.3              Wrap                Adidas                Acc3     Acc3                    3                       B+                       yes
         *
         * #W_DAPE_2_1.4             MF: Wrap            DAPE                   Acc1    Acc1                    3                       A                        yes
         * #UW_DAPE_2_1.5            Unwrap              DAPE                   Acc1    Acc2                    1                       A                        yes
         * #TRA_DAPE_2_1.6           Transfer            DAPE                   Acc1    Acc2                    2                       //                       //
         * #UW_DAPE_2_1.7            Unwrap              DAPE                   Acc1    Acc2                    2                       A                        yes
         * #UW_DADI_2_1.8            MF: Unwrap          DADI                   Acc3    Acc3                    3                       B                        yes
         * #UW_DAPE_2_1.9            MF: Unwrap          DAPE                   Acc1    Acc1                    3                       A (passing ADI key)      yes
         * #TRA_DADI_2_2.1           Transfer            DADI                   Acc2    Acc3                    3                       //                        //
         * #UWB_ADI_2_2.2            MF: Unwrap Batch    DADI                   Acc3    Acc3                    3,3                     B,B+                     yes,yes
         * JumpToBlock -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
         * #UWB_DADI_2_2.3           Unwrap Batch        DADI                   Acc3    Acc3                    3,3                     B,B+                     yes,yes
         * #UW_DAPE_2_2.4            Unwrap              DAPE                   Acc1    Acc3                    4                       A+                       yes
         */
        var tokenHolderElite = "0x6cd2d84298f731fa443061255a9a84a09dbca769";

        var eliteAddresss = "0xd0B53410454370a482979C0adaf3667c6308a801";

        var eliteTokenId = ["0"];

        var elite = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            eliteAddresss
        );

        await approveHost(tokenHolderElite);

        await Promise.all(
            eliteTokenId.map(async (id, index) => {
                await elite.methods
                    .safeTransferFrom(
                        tokenHolderElite,
                        accounts[1],
                        id,
                        7,
                        "0x"
                    )
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderElite,
                        })
                    );
            })
        );

        await elite.methods
            .setApprovalForAll(wrapper.options.address, accounts[1])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        // #W_APE_2_1.1 START

        var amountToWrap = [3, 4];
        var createItem = await wrapperResource.generateCreateItem(
            [eliteTokenId[0], eliteTokenId[0]],
            [accounts[1], accounts[1]],
            [eliteAddresss, eliteAddresss],
            amountToWrap
        );

        var lock = [true, true];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var eliteItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        var eliteKey = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3(
                        "ReserveData(address,address,uint256,uint256,uint256,bytes32)"
                    )
            )
            .map(
                (it) =>
                    web3.eth.abi.decodeParameters(
                        ["uint256", "uint256", "bytes32"],
                        it.data
                    )[2]
            );

        await wrapperResource.checkBalance1155(
            tx,
            accounts[1],
            wrapper.options.address,
            amountToWrap[0].add(amountToWrap[1]),
            elite,
            eliteTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            utilities.normalizeValue(amountToWrap[0].add(amountToWrap[1]), 0),
            eliteItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amountToWrap[0].add(amountToWrap[1]), 0),
            eliteItemIds[0],
            wrapper
        );

        // #W_APE_2_1.1 END

        var tokenHolderAdidas = "0x41e8bf3d9288eddacc3206f9ab21b61a1c59df31";

        var adidasTokenAddresss = "0x28472a58a490c5e09a238847f66a68a47cc76f0f";

        var adidasTokenId = ["0"];

        var adidas = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            adidasTokenAddresss
        );

        await approveHost(tokenHolderAdidas);

        await adidas.methods
            .safeTransferFrom(
                tokenHolderAdidas,
                accounts[2],
                adidasTokenId[0],
                3,
                "0x"
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: tokenHolderAdidas,
                })
            );

        await adidas.methods
            .safeTransferFrom(
                tokenHolderAdidas,
                accounts[3],
                adidasTokenId[0],
                3,
                "0x"
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: tokenHolderAdidas,
                })
            );

        // #W_ADI_2_1.2 START

        var data = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [["3"], [accounts[2]], true]
        );

        tx = await adidas.methods
            .safeTransferFrom(
                accounts[2],
                wrapper.options.address,
                adidasTokenId[0],
                3,
                data
            )
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[2] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var adidasItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        var adidasKey = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3(
                        "ReserveData(address,address,uint256,uint256,uint256,bytes32)"
                    )
            )
            .map(
                (it) =>
                    web3.eth.abi.decodeParameters(
                        ["uint256", "uint256", "bytes32"],
                        it.data
                    )[2]
            );

        await wrapperResource.checkBalance1155(
            tx,
            accounts[2],
            wrapper.options.address,
            "3",
            adidas,
            adidasTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            "3000000000000000000",
            adidasItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "3000000000000000000",
            adidasItemIds[0],
            wrapper
        );

        // #W_ADI_2_1.2 END

        // #W_ADI_2_1.3 START

        await adidas.methods
            .setApprovalForAll(wrapper.options.address, accounts[3])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        var createItem = await wrapperResource.generateCreateItem(
            [adidasTokenId[0]],
            [accounts[3]],
            [adidasTokenAddresss],
            ["3"]
        );

        var lock = [true];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[3] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var adidasKey2 = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3(
                        "ReserveData(address,address,uint256,uint256,uint256,bytes32)"
                    )
            )
            .map(
                (it) =>
                    web3.eth.abi.decodeParameters(
                        ["uint256", "uint256", "bytes32"],
                        it.data
                    )[2]
            );

        await wrapperResource.checkBalance1155(
            tx,
            accounts[3],
            wrapper.options.address,
            "3",
            adidas,
            adidasTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "3000000000000000000",
            adidasItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "3000000000000000000",
            adidasItemIds[0],
            wrapper
        );

        // #W_ADI_2_1.3 END

        // #W_DAPE_2_1.4 START

        var amountToWrap = [3];
        var createItem = await wrapperResource.generateCreateItem(
            [eliteTokenId[0]],
            [accounts[1]],
            [eliteAddresss],
            amountToWrap
        );

        var lock = [true];

        await catchCall(
            wrapper.methods.mintItems(createItem, lock).send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            ),
            "insufficient balance for transfer"
        );

        // #W_DAPE_2_1.4 END

        // #UW_DAPE_2_1.5 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [eliteAddresss, eliteTokenId[0], accounts[2], eliteKey, "0x"]
        );

        var amountToUnwrap = "1000000000000000000";

        var tx = await wrapper.methods
            .burn(accounts[1], eliteItemIds[0], amountToUnwrap, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[2],
            1,
            elite,
            eliteTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToUnwrap.mul(-1),
            eliteItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnwrap.mul(-1),
            eliteItemIds[0],
            wrapper
        );

        // #UW_DAPE_2_1.5 END

        // #TRA_DAPE_2_1.6 START

        wrapper.methods
            .safeTransferFrom(
                accounts[1],
                accounts[2],
                eliteItemIds[0],
                "4000000000000000000",
                "0x"
            )
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        // #TRA_DAPE_2_1.6 END

        // #UW_DAPE_2_1.7 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [eliteAddresss, eliteTokenId[0], accounts[2], eliteKey, "0x"]
        );

        var amountToUnwrap = "2000000000000000000";

        var tx = await wrapper.methods
            .burn(accounts[1], eliteItemIds[0], amountToUnwrap, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[2],
            2,
            elite,
            eliteTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToUnwrap.mul(-1),
            eliteItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnwrap.mul(-1),
            eliteItemIds[0],
            wrapper
        );

        // #UW_DAPE_2_1.7 END

        // #UW_DADI_2_1.8 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                adidasTokenAddresss,
                adidasTokenId[0],
                accounts[3],
                adidasKey,
                "0x",
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[3],
                    adidasItemIds[0],
                    "3000000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "cannot unlock"
        );

        // #UW_DADI_2_1.8 END

        // #UW_DAPE_2_1.9 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [eliteAddresss, eliteTokenId[0], accounts[1], eliteKey, "0x"]
        );

        await catchCall(
            wrapper.methods
                .burn(accounts[1], eliteItemIds[0], "3000000000000000000", data)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "insuff"
        );

        // #UW_DAPE_2_1.9 END

        // #TRA_DADI_2_2.1 START

        wrapper.methods
            .safeTransferFrom(
                accounts[2],
                accounts[3],
                adidasItemIds[0],
                "3000000000000000000",
                "0x"
            )
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[2] })
            );

        // #TRA_DADI_2_2.1 END

        // #UWB_ADI_2_2.2 START

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                adidasTokenAddresss,
                adidasTokenId[0],
                accounts[3],
                adidasKey,
                "0x",
            ]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                adidasTokenAddresss,
                adidasTokenId[0],
                accounts[3],
                adidasKey,
                "0x",
            ]
        );
        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        var amountToUnWrap = ["3000000000000000000", "3000000000000000000"];

        await catchCall(
            wrapper.methods
                .burnBatch(
                    accounts[3],
                    [adidasItemIds[0], adidasItemIds[0]],
                    amountToUnWrap,
                    encodeDatas
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "cannot unlock"
        );

        // #UWB_ADI_2_2.2 END

        // JumpToBlock START

        await blockchainConnection.fastForward(blockToSkip);

        // JumpToBlock END

        // #UWB_DADI_2_2.3 START

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                adidasTokenAddresss,
                adidasTokenId[0],
                accounts[3],
                adidasKey,
                "0x",
            ]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                adidasTokenAddresss,
                adidasTokenId[0],
                accounts[3],
                adidasKey2,
                "0x",
            ]
        );
        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        var amountToUnWrap = ["3000000000000000000", "3000000000000000000"];

        var tx = await wrapper.methods
            .burnBatch(
                accounts[3],
                [adidasItemIds[0], adidasItemIds[0]],
                amountToUnWrap,
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        var amount = amountToUnWrap[0].add(amountToUnWrap[1]);

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[3],
            6,
            adidas,
            adidasTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            amount.mul(-1),
            adidasItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amount.mul(-1),
            adidasItemIds[0],
            wrapper
        );

        // #UWB_DADI_2_2.3 END

        // #UW_DAPE_2_2.4 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [eliteAddresss, eliteTokenId[0], accounts[3], eliteKey, "0x"]
        );

        var amountToUnwrap = "4000000000000000000";

        var tx = await wrapper.methods
            .burn(accounts[2], eliteItemIds[0], amountToUnwrap, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[3],
            4,
            elite,
            eliteTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            amountToUnwrap.mul(-1),
            eliteItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnwrap.mul(-1),
            eliteItemIds[0],
            wrapper
        );

        // #UW_DAPE_2_2.4 END
    });

    it("#3", async () => {
        var tokenHolderOpensea = "0xeea89c8843e8beb56e411bb4cac6dbc2d937ee1d";

        var openseaAddresss = "0x495f947276749ce646f68ac8c248420045cb7b5e";

        var openseaTokenId = [
            "57410037754672571264739567782498400843114500082247629786531933482096386899969",
            "18024890227566502247768699122836641523078737603476603287028741122087903559780",
            "65423712643887032042488748359236551000215163492589935922997446439823617294532",
        ];

        var opensea = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            openseaAddresss
        );

        await approveHost(tokenHolderOpensea);

        await Promise.all(
            openseaTokenId.map(async (id, index) => {
                await opensea.methods
                    .safeTransferFrom(
                        tokenHolderOpensea,
                        accounts[1],
                        id,
                        1,
                        "0x"
                    )
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderOpensea,
                        })
                    );
            })
        );

        // var data = abi.encode(
        //     ["uint256[]", "address[]", "bool"],
        //     [["1"], [accounts[1]], true]
        // );

        // tx = await opensea.methods
        //     .safeTransferFrom(
        //         accounts[1],
        //         wrapper.options.address,
        //         openseaTokenId[0],
        //         1,
        //         data
        //     )
        //     .send(
        //         blockchainConnection.getSendingOptions({ from: accounts[1] })
        //     );
        // var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
        //     .logs;

        // var openseaItemIds = logs
        //     .filter(
        //         (it) =>
        //             it.topics[0] ===
        //             web3.utils.sha3("Token(address,uint256,uint256)")
        //     )
        //     .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        // var openseaKey = logs
        //     .filter(
        //         (it) =>
        //             it.topics[0] ===
        //             web3.utils.sha3(
        //                 "ReserveData(address,address,uint256,uint256,uint256,bytes32)"
        //             )
        //     )
        //     .map(
        //         (it) =>
        //             web3.eth.abi.decodeParameters(
        //                 ["uint256", "uint256", "bytes32"],
        //                 it.data
        //             )[2]
        //     );

        // var data = abi.encode(
        //     ["uint256[]", "address[]", "bool"],
        //     [["1"], [accounts[1]], true]
        // );

        // tx = await opensea.methods
        //     .safeTransferFrom(
        //         accounts[1],
        //         wrapper.options.address,
        //         openseaTokenId[1],
        //         1,
        //         data
        //     )
        //     .send(
        //         blockchainConnection.getSendingOptions({ from: accounts[1] })
        //     );
        // var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
        //     .logs;

        // var openseaKey1 = logs
        //     .filter(
        //         (it) =>
        //             it.topics[0] ===
        //             web3.utils.sha3(
        //                 "ReserveData(address,address,uint256,uint256,uint256,bytes32)"
        //             )
        //     )
        //     .map(
        //         (it) =>
        //             web3.eth.abi.decodeParameters(
        //                 ["uint256", "uint256", "bytes32"],
        //                 it.data
        //             )[2]
        //     );

        // var openseaItemIds = logs
        //     .filter(
        //         (it) =>
        //             it.topics[0] ===
        //             web3.utils.sha3("Token(address,uint256,uint256)")
        //     )
        //     .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        var datas = [];

        datas[0] = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [["1"], [accounts[1]], true]
        );
        datas[1] = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [["1"], [accounts[1]], true]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        tx = await opensea.methods
            .safeBatchTransferFrom(
                accounts[1],
                wrapper.options.address,
                [openseaTokenId[0], openseaTokenId[1]],
                [1,1],
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var openseaItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        var openseaKey = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3(
                        "ReserveData(address,address,uint256,uint256,uint256,bytes32)"
                    )
            )
            .map(
                (it) =>
                    web3.eth.abi.decodeParameters(
                        ["uint256", "uint256", "bytes32"],
                        it.data
                    )[2]
            );

        await opensea.methods
            .setApprovalForAll(wrapper.options.address, accounts[1])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        var amountToWrap = [1];
        var createItem = await wrapperResource.generateCreateItem(
            [openseaTokenId[2]],
            [accounts[3]],
            [openseaAddresss],
            amountToWrap
        );

        var lock = [false];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var openseaItemIds2 = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        // await wrapperResource.checkBalance1155(
        //     tx,
        //     accounts[1],
        //     wrapper.options.address,
        //     amountToWrap[0],
        //     opensea,
        //     openseaTokenId[2]
        // );

        // await wrapperResource.checkBalanceItem(
        //     tx,
        //     accounts[3],
        //     utilities.normalizeValue(amountToWrap[0], 0),
        //     openseaItemIds[0],
        //     wrapper
        // );

        // await wrapperResource.checkSupply(
        //     tx,
        //     utilities.normalizeValue(amountToWrap[0], 0),
        //     openseaItemIds[0],
        //     wrapper
        // );

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                openseaAddresss,
                openseaTokenId[2],
                accounts[1],
                [utilities.voidBytes32],
                "0x",
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[3],
                    openseaItemIds[0],
                    "600000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "amount"
        );

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                openseaAddresss,
                openseaTokenId[2],
                accounts[1],
                [utilities.voidBytes32],
                "0x",
            ]
        );

        var amountToUnWrap = "1000000000000000000";

        var tx = await wrapper.methods
            .burn(accounts[3], openseaItemIds[0], amountToUnWrap, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[1],
            "1",
            opensea,
            openseaTokenId[2]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            amountToUnWrap.mul(-1),
            openseaItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap.mul(-1),
            openseaItemIds[0],
            wrapper
        );

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [openseaAddresss, openseaTokenId[0], accounts[3], openseaKey, "0x"]
        );

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[3],
                    openseaItemIds[0],
                    "1000000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "insuff"
        );

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [openseaAddresss, openseaTokenId[1], accounts[1], openseaKey1, "0x"]
        );

        var amountToUnWrap = "1000000000000000000";

        var tx = await wrapper.methods
            .burn(accounts[1], openseaItemIds[0], amountToUnWrap, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[1],
            "1",
            opensea,
            openseaTokenId[1]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToUnWrap.mul(-1),
            openseaItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap.mul(-1),
            openseaItemIds[0],
            wrapper
        );

        await opensea.methods
            .setApprovalForAll(wrapper.options.address, accounts[1])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        var amountToWrap = [1];
        var createItem = await wrapperResource.generateCreateItem(
            [openseaTokenId[1]],
            [accounts[1]],
            [openseaAddresss],
            amountToWrap
        );

        var lock = [true];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var openseaKeyBPlus = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3(
                        "ReserveData(address,address,uint256,uint256,uint256,bytes32)"
                    )
            )
            .map(
                (it) =>
                    web3.eth.abi.decodeParameters(
                        ["uint256", "uint256", "bytes32"],
                        it.data
                    )[2]
            );

        await wrapperResource.checkBalance1155(
            tx,
            accounts[1],
            wrapper.options.address,
            amountToWrap[0],
            opensea,
            openseaTokenId[1]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            utilities.normalizeValue(amountToWrap[0], 0),
            openseaItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amountToWrap[0], 0),
            openseaItemIds[0],
            wrapper
        );

        await blockchainConnection.fastForward(blockToSkip);

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [openseaAddresss, openseaTokenId[0], accounts[3], openseaKey, "0x"]
        );

        var amountToUnWrap = "1000000000000000000";

        var tx = await wrapper.methods
            .burn(accounts[1], openseaItemIds[0], amountToUnWrap, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[3],
            "1",
            opensea,
            openseaTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToUnWrap.mul(-1),
            openseaItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap.mul(-1),
            openseaItemIds[0],
            wrapper
        );

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [openseaAddresss, openseaTokenId[1], accounts[1], openseaKey1, "0x"]
        );

        // await catchCall(wrapper.methods
        //     .burn(accounts[1], openseaItemIds[0], "700000000000000000", data)
        //     .send(
        //         blockchainConnection.getSendingOptions({
        //             from: accounts[1],
        //         })
        //     ), "");

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                openseaAddresss,
                openseaTokenId[1],
                accounts[1],
                openseaKeyBPlus,
                "0x",
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[1],
                    openseaItemIds[0],
                    "400000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "amount"
        );

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                openseaAddresss,
                openseaTokenId[1],
                accounts[1],
                openseaKeyBPlus,
                "0x",
            ]
        );

        var amountToUnWrap = "700000000000000000";

        var tx = await wrapper.methods
            .burn(accounts[1], openseaItemIds[0], amountToUnWrap, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[1],
            "1",
            opensea,
            openseaTokenId[1]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToUnWrap.mul(-1),
            openseaItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap.mul(-1),
            openseaItemIds[0],
            wrapper
        );
    });

    it("#4", async () => {
        var tokenHolderOs = "0x43126fb5e1fe86bb44b084d09f651358b97ebf0c";

        var osAddress = "0x8d53aFBEB62C18917B5F71385d52E8ba87669794";

        var osTokenId = ["553791398095120659341456634783597180523460212593"];

        var os = new web3.eth.Contract(knowledgeBase.IERC1155ABI, osAddress);

        var osAmount = await os.methods
            .balanceOf(tokenHolderOs, osTokenId[0])
            .call();

        await approveHost(tokenHolderOs);

        await Promise.all(
            osTokenId.map(async (id, index) => {
                await os.methods
                    .safeTransferFrom(
                        tokenHolderOs,
                        accounts[3],
                        id,
                        osAmount,
                        "0x"
                    )
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderOs,
                        })
                    );
            })
        );

        var tokenHolderHo = "0xf1fced5b0475a935b49b95786adbda2d40794d2d";

        var hoAddress = "0x8d53aFBEB62C18917B5F71385d52E8ba87669794";

        var hoTokenId = ["578341054725116502893129430711564539037968047002"];

        var ho = new web3.eth.Contract(knowledgeBase.IERC1155ABI, hoAddress);

        var hoAmount = await ho.methods
            .balanceOf(tokenHolderHo, hoTokenId[0])
            .call();

        await approveHost(tokenHolderHo);

        await ho.methods
            .safeTransferFrom(
                tokenHolderHo,
                accounts[3],
                hoTokenId[0],
                hoAmount,
                "0x"
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: tokenHolderHo,
                })
            );

        var data = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [[osAmount], [accounts[3]], true]
        );

        tx = await os.methods
            .safeTransferFrom(
                accounts[3],
                wrapper.options.address,
                osTokenId[0],
                osAmount,
                data
            )
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[3] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var osItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        var osKeys = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3(
                        "ReserveData(address,address,uint256,uint256,uint256,bytes32)"
                    )
            )
            .map(
                (it) =>
                    web3.eth.abi.decodeParameters(
                        ["uint256", "uint256", "bytes32"],
                        it.data
                    )[2]
            );

        await wrapperResource.checkBalance1155(
            tx,
            accounts[3],
            wrapper.options.address,
            osAmount,
            os,
            osTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            osAmount,
            osItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(tx, osAmount, osItemIds[0], wrapper);

        var data = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [[hoAmount], [accounts[1]], true]
        );

        tx = await ho.methods
            .safeTransferFrom(
                accounts[3],
                wrapper.options.address,
                hoTokenId[0],
                hoAmount,
                data
            )
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[3] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var hoItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        var hoKeys = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3(
                        "ReserveData(address,address,uint256,uint256,uint256,bytes32)"
                    )
            )
            .map(
                (it) =>
                    web3.eth.abi.decodeParameters(
                        ["uint256", "uint256", "bytes32"],
                        it.data
                    )[2]
            );

        await wrapperResource.checkBalance1155(
            tx,
            accounts[3],
            wrapper.options.address,
            hoAmount,
            ho,
            hoTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            hoAmount,
            hoItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(tx, hoAmount, hoItemIds[0], wrapper);

        var tokenHolderWeth = "0xa9b95d7b0dc294078d8c61507460342045e6d5c4";

        var wethTokenAddresss = "0x8d53aFBEB62C18917B5F71385d52E8ba87669794";

        var wethTokenId = ["424598707882341362120214388976627581791055360979"];

        var weth = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            wethTokenAddresss
        );

        var wethAmount = (
            await weth.methods.balanceOf(tokenHolderWeth, wethTokenId[0]).call()
        ).div(2);

        await approveHost(tokenHolderWeth);

        await weth.methods
            .safeTransferFrom(
                tokenHolderWeth,
                accounts[3],
                wethTokenId[0],
                wethAmount,
                "0x"
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: tokenHolderWeth,
                })
            );

        await weth.methods
            .setApprovalForAll(wrapper.options.address, accounts[3])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        var amountToWrap = [wethAmount];
        var createItem = await wrapperResource.generateCreateItem(
            [wethTokenId[0]],
            [accounts[3]],
            [wethTokenAddresss],
            amountToWrap
        );

        var lock = [true];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[3] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var wethItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        var wethKey = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3(
                        "ReserveData(address,address,uint256,uint256,uint256,bytes32)"
                    )
            )
            .map(
                (it) =>
                    web3.eth.abi.decodeParameters(
                        ["uint256", "uint256", "bytes32"],
                        it.data
                    )[2]
            );

        await wrapperResource.checkBalance1155(
            tx,
            accounts[3],
            wrapper.options.address,
            amountToWrap[0],
            weth,
            wethTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            amountToWrap[0],
            wethItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToWrap[0],
            wethItemIds[0],
            wrapper
        );

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [hoAddress, hoTokenId[0], accounts[1], hoKeys, "0x"]
        );

        await catchCall(
            wrapper.methods
                .burn(accounts[1], hoItemIds[0], hoAmount, data)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "cannot unlock"
        );

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                hoAddress,
                hoTokenId[0],
                accounts[3],
                [utilities.voidBytes32],
                "0x",
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(accounts[3], hoItemIds[0], hoAmount, data)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "insuff"
        );

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [hoAddress, hoTokenId[0], accounts[3], osKeys, "0x"]
        );

        await catchCall(
            wrapper.methods
                .burn(accounts[3], hoItemIds[0], hoAmount, data)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "insuff"
        );

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [wethTokenAddresss, wethTokenId[0], accounts[1], [wethKey[0]], "0x"]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [osAddress, osTokenId[0], accounts[1], [osKeys[0]], "0x"]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        var amountToUnWrap = [wethAmount.div(2), osAmount.div(2)];

        var tx = await wrapper.methods
            .burnBatch(
                accounts[3],
                [wethItemIds[0], osItemIds[0]],
                amountToUnWrap,
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[1],
            amountToUnWrap[0],
            weth,
            wethTokenId[0]
        );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[1],
            amountToUnWrap[1],
            os,
            osTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            amountToUnWrap[0].mul(-1),
            wethItemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            amountToUnWrap[1].mul(-1),
            osItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap[0].mul(-1),
            wethItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap[1].mul(-1),
            osItemIds[0],
            wrapper
        );

        await os.methods
            .setApprovalForAll(wrapper.options.address, accounts[1])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );
        await weth.methods
            .setApprovalForAll(wrapper.options.address, accounts[1])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        var amountToWrap = [osAmount.div(2), wethAmount.div(2)];
        var createItem = await wrapperResource.generateCreateItem(
            [osTokenId[0], wethTokenId[0]],
            [accounts[1], accounts[1]],
            [osAddress, wethTokenAddresss],
            amountToWrap
        );

        var lock = [true, true];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        await wrapperResource.checkBalance1155(
            tx,
            accounts[1],
            wrapper.options.address,
            amountToWrap[0],
            os,
            osTokenId[0]
        );

        await wrapperResource.checkBalance1155(
            tx,
            accounts[1],
            wrapper.options.address,
            amountToWrap[1],
            weth,
            wethTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToWrap[0],
            osItemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToWrap[1],
            wethItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToWrap[0],
            osItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToWrap[1],
            wethItemIds[0],
            wrapper
        );

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [wethTokenAddresss, wethTokenId[0], accounts[1], [wethKey[0]], "0x"]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [osAddress, osTokenId[0], accounts[1], [osKeys[0]], "0x"]
        );
        datas[2] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [hoAddress, hoTokenId[0], accounts[3], [hoKeys[0]], "0x"]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        var amountToUnWrap = [wethAmount.div(2), osAmount.div(2), hoAmount];

        await catchCall(
            wrapper.methods
                .burnBatch(
                    accounts[1],
                    [wethItemIds[0], osItemIds[0], hoItemIds[0]],
                    amountToUnWrap,
                    encodeDatas
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "cannot unlock"
        );

        await blockchainConnection.fastForward(blockToSkip);

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [wethTokenAddresss, wethTokenId[0], accounts[3], [wethKey[0]], "0x"]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [osAddress, osTokenId[0], accounts[3], [osKeys[0]], "0x"]
        );
        datas[2] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [hoAddress, hoTokenId[0], accounts[3], [hoKeys[0]], "0x"]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        var amountToUnWrap = [wethAmount.div(2), osAmount.div(2), hoAmount];

        var tx = await wrapper.methods
            .burnBatch(
                accounts[1],
                [wethItemIds[0], osItemIds[0], hoItemIds[0]],
                amountToUnWrap,
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[3],
            amountToUnWrap[0],
            weth,
            wethTokenId[0]
        );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[3],
            amountToUnWrap[1],
            os,
            osTokenId[0]
        );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[3],
            amountToUnWrap[2],
            ho,
            hoTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToUnWrap[0].mul(-1),
            wethItemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToUnWrap[1].mul(-1),
            osItemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToUnWrap[2].mul(-1),
            hoItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap[0].mul(-1),
            wethItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap[1].mul(-1),
            osItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap[2].mul(-1),
            hoItemIds[0],
            wrapper
        );
    });

    it("#5", async () => {
        var tokenHolderZapper = "0xdcd299415efc9717564c6f23ccce25b5dbfec335";

        var zapperAddress = "0xF1F3ca6268f330fDa08418db12171c3173eE39C9";

        var zapperTokenId = ["11"];

        var zapper = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            zapperAddress
        );

        await approveHost(tokenHolderZapper);

        await Promise.all(
            zapperTokenId.map(async (id, index) => {
                await zapper.methods
                    .safeTransferFrom(
                        tokenHolderZapper,
                        accounts[1],
                        id,
                        12,
                        "0x"
                    )
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderZapper,
                        })
                    );
            })
        );

        await zapper.methods
            .setApprovalForAll(wrapper.options.address, accounts[1])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        var createItem = await wrapperResource.generateCreateItem(
            [zapperTokenId[0], zapperTokenId[0], zapperTokenId[0]],
            [accounts[1], accounts[1], accounts[1]],
            [zapperAddress, zapperAddress, zapperAddress],
            ["3", "4", "5"]
        );

        var lock = [true, true, true];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var zapperItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        var zapperKey = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3(
                        "ReserveData(address,address,uint256,uint256,uint256,bytes32)"
                    )
            )
            .map(
                (it) =>
                    web3.eth.abi.decodeParameters(
                        ["uint256", "uint256", "bytes32"],
                        it.data
                    )[2]
            );

        await wrapperResource.checkBalance1155(
            tx,
            accounts[1],
            wrapper.options.address,
            "12",
            zapper,
            zapperTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            "12000000000000000000",
            zapperItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "12000000000000000000",
            zapperItemIds[0],
            wrapper
        );

        await wrapper.methods
            .safeTransferFrom(
                accounts[1],
                accounts[2],
                zapperItemIds[0],
                6,
                "0x"
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [zapperAddress, zapperTokenId[0], accounts[3], [zapperKey[0]], "0x"]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [zapperAddress, zapperTokenId[0], accounts[3], [zapperKey[1]], "0x"]
        );
        datas[2] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [zapperAddress, zapperTokenId[0], accounts[3], [zapperKey[2]], "0x"]
        );
        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        var amountToUnWrap = [1, 2, 3];

        console.log(await wrapper.methods.reserveData(zapperKey[0]).call());
        console.log(await wrapper.methods.reserveData(zapperKey[1]).call());
        console.log(await wrapper.methods.reserveData(zapperKey[2]).call());

        console.log(accounts[1])
        var tx = await wrapper.methods
            .burnBatch(
                accounts[1],
                [zapperItemIds[0], zapperItemIds[0], zapperItemIds[0]],
                amountToUnWrap,
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        // var amount = "6000000000000000000";

        // await wrapperResource.checkBalance1155(
        //     tx,
        //     wrapper.options.address,
        //     accounts[3],
        //     6,
        //     zapper,
        //     zapperTokenId[0]
        // );

        // await wrapperResource.checkBalanceItem(
        //     tx,
        //     accounts[1],
        //     amount.mul(-1),
        //     zapperItemIds[0],
        //     wrapper
        // );

        // await wrapperResource.checkSupply(
        //     tx,
        //     amount.mul(-1),
        //     zapperItemIds[0],
        //     wrapper
        // );
    });
});
