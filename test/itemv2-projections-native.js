var itemsv2 = require('../resources/itemsv2');

describe("Item V2 Projections - Native", () => {
  it("#0", async () => {
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;

    var collectionHeader = [accounts[1], 'Item1', 'I1', 'uriItem1'];

    var items = [
      [[utilities.voidEthereumAddress, '', '', ''], collectionId, 0, [accounts[1]], [10000]]
    ];
    try {
      var native = await itemsv2.initialization(zeroDecimals, collectionId, collectionHeader, items, accounts[1], "URI");
      console.log("Native", native.options.address);
    } catch(e) {
      console.error(e);
    }
  });
});
