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
        var tokenHolderZerion = "0xecde04e088828c93a1003b9388727a25c064e5e3";

        var zerionTokenAddresss = "0x74EE68a33f6c9f113e22B3B77418B75f85d07D22";

        var zerionTokenId = ["10"];

        var zerion = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            zerionTokenAddresss
        );

        await approveHost(tokenHolderZerion);

        zerionTokenId.map(async (id, index) => {
            await zerion.methods
                .safeTransferFrom(tokenHolderZerion, accounts[1], id, 3, "0x")
                .send(
                    blockchainConnection.getSendingOptions({
                        from: tokenHolderZerion,
                    })
                );
        });
        await zerion.methods
            .setApprovalForAll(wrapper.options.address, accounts[1])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

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
        console.log(zerionKey);

        // await wrapperResource.checkReserveData(
        //     tx,
        //     accounts[1],
        //     createItem,
        //     lock,
        //     blockToSkip,
        //     wrapper
        // );

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

        var tokenHolderParallel = "0xd0829f8dda953e85da70b0a62a2f4e9a774ebf16";

        var parallelTokenAddresss =
            "0x76be3b62873462d2142405439777e971754e8e77";

        var parallelTokenId = ["10144", "10150"];

        var parallel = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            parallelTokenAddresss
        );

        await approveHost(tokenHolderParallel);

        parallelTokenId.map(async (id, index) => {
            await parallel.methods
                .safeTransferFrom(tokenHolderParallel, accounts[2], id, 1, "0x")
                .send(
                    blockchainConnection.getSendingOptions({
                        from: tokenHolderParallel,
                    })
                );
        });

        await parallel.methods
            .setApprovalForAll(wrapper.options.address, accounts[2])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

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

        var tokenHolderOs = "0x43126fb5e1fe86bb44b084d09f651358b97ebf0c";

        var osTokenAddresss = "0x8d53aFBEB62C18917B5F71385d52E8ba87669794";

        var osTokenId = ["553791398095120659341456634783597180523460212593"];

        var os = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            osTokenAddresss
        );

        await approveHost(tokenHolderOs);

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
        });

        await os.methods
            .setApprovalForAll(wrapper.options.address, accounts[3])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        var balance = await os.methods
            .balanceOf(tokenHolderOs, osTokenId[0])
            .call();
        var amountToWrap = [balance.div(6), balance.div(9)];
        var createItem = await wrapperResource.generateCreateItem(
            [osTokenId[0], osTokenId[0]],
            [accounts[4], accounts[4]],
            [osTokenAddresss, osTokenAddresss],
            amountToWrap
        );

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

        console.log(await wrapper.methods.reserveData(zerionKey[0]).call());

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

        // await catchCall(
        //     wrapper.methods
        //         .burn(
        //             accounts[3],
        //             zerionItemIds[0],
        //             "1000000000000000000",
        //             data
        //         )
        //         .send(
        //             blockchainConnection.getSendingOptions({
        //                 from: accounts[3],
        //             })
        //         ),
        //     ""
        // );

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

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                parallelTokenAddresss,
                parallelTokenId[0],
                accounts[3],
                [utilities.voidBytes32],
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

        await blockchainConnection.fastForward(blockToSkip);

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                parallelTokenAddresss,
                parallelTokenId[0],
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
            "amount"
        );

        var source = await wrapper.methods.source(parallelItemIds[0]).call();

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

        await wrapper.methods
            .burn(accounts[3], parallelItemIds[0], "510000000000000000", data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
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

        // await wrapperResource.checkSupply(
        //     tx,
        //     "-510000000000000000",
        //     parallelItemIds[0],
        //     wrapper
        // );

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
    });

    it("#2", async () => {
        var tokenHolderElite = "0x6cd2d84298f731fa443061255a9a84a09dbca769";

        var eliteAddresss = "0xd0B53410454370a482979C0adaf3667c6308a801";

        var eliteTokenId = ["0"];

        var elite = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            eliteAddresss
        );

        await approveHost(tokenHolderElite);

        eliteTokenId.map(async (id, index) => {
            await elite.methods
                .safeTransferFrom(tokenHolderElite, accounts[1], id, 7, "0x")
                .send(
                    blockchainConnection.getSendingOptions({
                        from: tokenHolderOs,
                    })
                );
        });

        await elite.methods
            .setApprovalForAll(wrapper.options.address, accounts[1])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

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
            amountToWrap[0].add(amountToWrap[1]),
            eliteItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToWrap[0].add(amountToWrap[1]),
            eliteItemIds[0],
            wrapper
        );

        var tokenHolderAdidas = "0x41e8bf3d9288eddacc3206f9ab21b61a1c59df31";

        var adidasTokenAddresss = "0x28472a58a490c5e09a238847f66a68a47cc76f0f";

        var adidasTokenId = ["0"];

        var adidas = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            adidasTokenAddresss
        );

        var addressTo = [accounts[2], accounts[3]];

        await approveHost(tokenHolderAdidas);

        adidasTokenId.map(async (id, index) => {
            await adidas.methods
                .safeTransferFrom(
                    tokenHolderAdidas,
                    addressTo[index],
                    id,
                    6,
                    "0x"
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: tokenHolderZerion,
                    })
                );
        });

        var data = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [["3"], [accounts[2]], true]
        );

        tx = await gods.methods
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

        await wrapperResource.checkBalance(
            tx,
            accounts[2],
            wrapper.options.address,
            "3",
            adidas,
            [adidasTokenId[0]]
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

        await adidas.methods
            .setApprovalForAll(wrapper.options.address, accounts[2])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        var createItem = await wrapperResource.generateCreateItem(
            [adidasTokenId[0]],
            [accounts[3]],
            [parallelTokenAddresss],
            ["3"]
        );

        var lock = [true];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[3] })
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
            ""
        );

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [eliteAddresss, eliteTokenId[0], accounts[2], eliteKey, "0x"]
        );

        var amountToUnwrap = "1000000000000000000";

        await wrapper.methods
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
            amountToUnwrap,
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

        wrapper.methods
            .safeTransferFrom(
                accounts[1],
                accounts[2],
                eliteItemIds[0],
                "2000000000000000000",
                "0x"
            )
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [eliteAddresss, eliteTokenId[0], accounts[2], eliteKey, "0x"]
        );

        var amountToUnwrap = "2000000000000000000";

        await wrapper.methods
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
            amountToUnwrap,
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

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [adidasTokenAddresss, adidasTokenId[0], accounts[3], adidas, "0x"]
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
            ""
        );

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [eliteAddresss, eliteTokenId[0], accounts[1], elite, "0x"]
        );

        await catchCall(
            wrapper.methods
                .burn(accounts[1], eliteItemIds[0], "3000000000000000000", data)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            ""
        );

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
            ""
        );

        await blockchainConnection.fastForward(blockToSkip);

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
            amount,
            os,
            osTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
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

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [eliteAddresss, eliteTokenId[0], accounts[3], eliteKey, "0x"]
        );

        var amountToUnwrap = "4000000000000000000";

        await wrapper.methods
            .burn(accounts[1], eliteItemIds[0], amountToUnwrap, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[3],
            amountToUnwrap,
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
    });
});
