var compile = require("../util/compile");
var blockchainConnection = require("../util/blockchainConnection");
var mainInterfaceAddress = "0x915A22A152654714FcecA3f4704fCf6bd314624c";
var dynamicUriResolverAddress;
var ItemProjectionFactoryContract;

async function deploy(host, plainUri) {
    var nativeProjection = await compile(
      "../contracts/projection/native/NativeProjection.sol"
    );
    var nativeProjectionContract = await new web3.eth.Contract(
      nativeProjection.abi
    )
      .deploy({ data: nativeProjection.bin, arguments: ["0x"] })
      .send(blockchainConnection.getSendingOptions());

    var DynamicUriResolver = await compile(
      "../node_modules/@ethereansos/swissknife/contracts/dynamicMetadata/impl/DynamicUriResolver"
    );
    dynamicUriResolver = await new web3.eth.Contract(DynamicUriResolver.abi)
      .deploy({ data: DynamicUriResolver.bin })
      .send(blockchainConnection.getSendingOptions());
    dynamicUriResolverAddress = dynamicUriResolver.options.address;

    var model = nativeProjectionContract.options.address;

    var ItemProjectionFactory = await compile(
      "../contracts/projection/factory/impl/ItemProjectionFactory.sol"
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
          [mainInterfaceAddress, deployParam]
        );

        deployParam = abi.encode(
          ["address", "bytes"],
          [host, deployParam]
        );

      await ItemProjectionFactoryContract.methods
        .deploy(deployParam)
        .send(blockchainConnection.getSendingOptions());
    }
};
