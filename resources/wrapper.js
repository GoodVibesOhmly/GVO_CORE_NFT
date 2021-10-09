async function mintErc20Wrapper(wrapper, token, tokenAmount, receiver, fromAccount, ethAmount = 0){
    var tx = await wrapper.methods
      .mint(
        token,
        tokenAmount,
        receiver
      )
      .send(
        blockchainConnection.getSendingOptions({
          from: fromAccount,
          value: ethAmount,
        })
      );
      var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash)).logs;

      var itemIds = logs
        .filter(
          (it) => it.topics[0] === web3.utils.sha3("Token(address,uint256)")
        )
        .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[2]));
    return {itemIds, tx};
}

async function revertMintErc20Wrapper(wrapper, token, tokenAmount, receiver, fromAccount, ethAmount = 0){
    await catchCall(wrapper.methods
      .mint(
        token,
        tokenAmount,
        receiver
      )
      .send(
        blockchainConnection.getSendingOptions({
          from: fromAccount,
          value: ethAmount,
        })
      ), "Only single transfers allowed for this token");
}

async function assertDecimals(wrapper, itemIds){
    await Promise.all(itemIds.map(async(item, index) => {
        assert.equal(await wrapper.methods.decimals(item).call(), "18");
    }))
}

async function assertCheckErc20ItemBalance(wrapper, receivers, itemIds, totalAmounts){
  if (!Array.isArray(itemIds)) {
    itemIds = [itemIds];
  }
    await Promise.all(receivers.map(async(rec, ind) => {
        await Promise.all(rec.map(async(r, i) => {
            assert.equal(await wrapper.methods.balanceOf(r == utilities.voidEthereumAddress ? accounts[1] : r, itemIds[ind]).call(), totalAmounts[ind][i]);
        }))
    }));
}

module.exports = {
    mintErc20Wrapper,
    assertDecimals,
    assertCheckErc20ItemBalance,
    revertMintErc20Wrapper,
  };