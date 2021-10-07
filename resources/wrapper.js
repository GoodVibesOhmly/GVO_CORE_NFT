async function mintErc20Wrapper(wrapper, token, tokenAmount, receiver, fromAccount, ethAmount){
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
    return itemIds;
}

module.exports = {
    mintErc20Wrapper,
  };