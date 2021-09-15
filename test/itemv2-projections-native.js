const { utils } = require("ethers");
var itemsv2 = require('../resources/itemsv2');

describe("Item V2 Projections - Native", () => {
  it("#0", async () => {
    var zeroDecimals = false;
    var collectionId = utilities.voidBytes32;
  
    var header = [accounts[1], 'Item1', 'I1', 'uriItem1'];

    var item = [
      [[accounts[1], 'Item1', 'I1', 'uriItem1'], collectionId, 0, [accounts[1]], [10000]]
    ];
    console.log(await itemsv2.initialization(zeroDecimals, collectionId, header, item, accounts[1], "URI"));
  });
});
