var compile = require("../util/compile");
var blockchainConnection = require("../util/blockchainConnection");
var mainInterfaceAddress = "0x915A22A152654714FcecA3f4704fCf6bd314624c";
var dynamicUriResolverAddress;
var ItemProjectionFactoryContract;
var NativeProjection;

async function deploy(host, plainUri) {
  
    await blockchainConnection.init;

    NativeProjection = await compile(
      "projection/native/NativeProjection"
    );
    var nativeProjectionContract = await new web3.eth.Contract(
      NativeProjection.abi
    )
      .deploy({ data: NativeProjection.bin, arguments: ["0x"] })
      .send(blockchainConnection.getSendingOptions());

    var MainInterface = await compile('model/IItemMainInterface');
    var mainInterface = new web3.eth.Contract(MainInterface.abi, mainInterfaceAddress);

    dynamicUriResolverAddress = await mainInterface.methods.dynamicUriResolver().call();

    var model = nativeProjectionContract.options.address;

    var ItemProjectionFactory = await compile(
      "projection/factory/impl/ItemProjectionFactory"
    );

    var dataParam = web3.eth.abi.encodeParameters(
      ["address"],
      [mainInterfaceAddress]
    );

    dataParam = web3.eth.abi.encodeParameters(
      ["address", "bytes"],
      [model, dataParam]
    );

    dataParam = web3.eth.abi.encodeParameters(
      ["string", "address", "bytes"],
      [plainUri, dynamicUriResolverAddress, dataParam]
    );

    dataParam = web3.eth.abi.encodeParameters(
      ["address", "bytes"],
      [host, dataParam]
    );

    ItemProjectionFactoryContract = await new web3.eth.Contract(
      ItemProjectionFactory.abi
    )
      .deploy({ data: ItemProjectionFactory.bin, arguments: [dataParam] })
      .send(blockchainConnection.getSendingOptions());
  }

module.exports = {

    async initialization(zeroDecimals, collectionId, header, item, host, plainUri){

        await deploy(host, plainUri);

        var isDecimals = zeroDecimals;

        var deployParam = abi.encode(["bool"], [isDecimals]);

        deployParam = abi.encode(
          [
            "bytes32",
            "tuple(address,string,string,string)",
            "tuple(tuple(address,string,string,string),bytes32,uint256,address[],uint256[])[]",
            "bytes"
          ],
          [
            collectionId,
            header,
            item,
            deployParam
          ]
        );

        deployParam = abi.encode(
          ["address", "bytes"],
          [host, deployParam]
        );

      var transaction = await ItemProjectionFactoryContract.methods
        .deploy(deployParam)
        .send(blockchainConnection.getSendingOptions());

      return new web3.eth.Contract(NativeProjection.abi, transaction.events.Deployed.returnValues.deployedAddress);
    }
};
