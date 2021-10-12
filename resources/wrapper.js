const blockchainConnection = require("../util/blockchainConnection");
const utilities = require("../util/utilities");

async function mintErc20Wrapper(
  wrapper,
  token,
  tokenAmount,
  receiver,
  fromAccount,
  ethAmount = 0
) {
  var tx = await wrapper.methods.mint(token, tokenAmount, receiver).send(
    blockchainConnection.getSendingOptions({
      from: fromAccount,
      value: ethAmount,
    })
  );
  var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash)).logs;

  var itemIds = logs
    .filter((it) => it.topics[0] === web3.utils.sha3("Token(address,uint256)"))
    .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[2]));
  return { itemIds, tx };
}

async function mintErc20(
  wrapper,
  tokenAddress,
  tokenAmount,
  receiver,
  fromAccount,
  ethAmount = 0
) {
  var itemList = [];
  var tx;
  await Promise.all(
    tokenAddress.map(async (address, index) =>
      itemList.push({
        header: {
          host: utilities.voidEthereumAddress,
          name: "",
          symbol: "",
          uri: "",
        },
        collectionId: web3.eth.abi.encodeParameter("address", address),
        id: "0",
        accounts: receiver[index].map((address, index) =>
          address == utilities.voidEthereumAddress ? fromAccount : address
        ),
        amounts: tokenAmount[index],
      })
    )
  );

  if (ethAmount == 0) {
    tx = await wrapper.methods
      .mintItems(itemList)
      .send(blockchainConnection.getSendingOptions({ from: fromAccount }));
  } else {
    tx = await wrapper.methods.mintItemsWithPermit(itemList, ["0x"]).send(
      blockchainConnection.getSendingOptions({
        from: fromAccount,
        value: ethAmount,
      })
    );
  }

  var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash)).logs;

  var itemIds = logs
    .filter((it) => it.topics[0] === web3.utils.sha3("Token(address,uint256)"))
    .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[2]));
  return { itemIds, tx };
}

async function revertMintErc20(
  wrapper,
  tokenAddress,
  tokenAmount,
  receiver,
  fromAccount,
  ethAmount = 0
) {
  var itemList = [];
  var tx;
  await Promise.all(
    tokenAddress.map(async (address, index) =>
      itemList.push({
        header: {
          host: utilities.voidEthereumAddress,
          name: "",
          symbol: "",
          uri: "",
        },
        collectionId: web3.eth.abi.encodeParameter("address", address),
        id: "0",
        accounts: receiver[index].map((address, index) =>
          address == utilities.voidEthereumAddress ? fromAccount : address
        ),
        amounts: tokenAmount[index],
      })
    )
  );

  if (ethAmount != 0) {
    await catchCall(
      wrapper.methods
        .mintItems(itemList)
        .send(blockchainConnection.getSendingOptions({ from: fromAccount })),
      "ETH"
    );
  }
}

async function revertMintErc20Wrapper(
  wrapper,
  tokenAddress,
  tokenAmount,
  receiver,
  fromAccount,
  ethAmount = 0
) {
  var itemList = [];
  var tx;
  await Promise.all(
    tokenAddress.map(async (address, index) =>
      itemList.push({
        header: {
          host: utilities.voidEthereumAddress,
          name: "",
          symbol: "",
          uri: "",
        },
        collectionId: web3.eth.abi.encodeParameter("address", address),
        id: "0",
        accounts: receiver[index].map((address, index) =>
          address == utilities.voidEthereumAddress ? fromAccount : address
        ),
        amounts: tokenAmount[index],
      })
    )
  );

  if (ethAmount != 0) {
    await catchCall(
      wrapper.methods
        .mintItems(itemList)
        .send(blockchainConnection.getSendingOptions({ from: fromAccount })),
      "Only single transfers allowed for this token"
    );
  }
}

async function assertDecimals(wrapper, itemIds) {
  await Promise.all(
    itemIds.map(async (item, index) => {
      assert.equal(await wrapper.methods.decimals(item).call(), "18");
    })
  );
}

async function assertCheckErc20ItemBalance(
  wrapper,
  receivers,
  itemIds,
  totalAmounts
) {
  if (!Array.isArray(itemIds)) {
    itemIds = [itemIds];
  }
  await Promise.all(
    receivers.map(async (rec, ind) => {
      await Promise.all(
        rec.map(async (r, i) => {
          assert.equal(
            await wrapper.methods
              .balanceOf(
                r == utilities.voidEthereumAddress ? accounts[1] : r,
                itemIds[ind]
              )
              .call(),
            totalAmounts[ind][i]
          );
        })
      );
    })
  );
}

async function mintItems721(
  tokenList,
  receivers,
  from,
  wrapper,
  nftTokenAddress,
  amount = "1000000000000000000"
) {
  var itemList = [];

  await Promise.all(
    receivers.map(async (address, index) =>
      itemList.push({
        header: {
          host: utilities.voidEthereumAddress,
          name: "",
          symbol: "",
          uri: "",
        },
        collectionId: web3.eth.abi.encodeParameter("address", nftTokenAddress),
        id: tokenList[index],
        accounts: [address == utilities.voidEthereumAddress ? from : address],
        amounts: [amount],
      })
    )
  );

  var tx = await wrapper.methods
    .mintItems(itemList)
    .send(blockchainConnection.getSendingOptions({ from: from }));

  return tx;
}

async function mintItems1155(
  tokenInstance,
  from,
  to,
  id,
  amount,
  data,
  event = true
) {
  var tx = await tokenInstance.methods
    .safeTransferFrom(from, to, id, amount, data)
    .send(blockchainConnection.getSendingOptions({ from: from }));
  if (event == true) {
    var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash)).logs;
    var tokenId = web3.eth.abi.decodeParameter(
      "uint256",
      logs.filter(
        (it) =>
          it.topics[0] === web3.utils.sha3("Token(address,uint256,uint256)")
      )[0].topics[3]
    );
    return tokenId;
  }
}

module.exports = {
  mintErc20Wrapper,
  assertDecimals,
  assertCheckErc20ItemBalance,
  revertMintErc20Wrapper,
  mintItems721,
  mintErc20,
  revertMintErc20,
  mintItems1155,
};
