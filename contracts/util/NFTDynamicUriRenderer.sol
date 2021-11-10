//SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import "../model/IItemMainInterface.sol";
import "../projection/ERC1155/IERC1155Wrapper.sol";
import "@ethereansos/swissknife/contracts/dynamicMetadata/model/IDynamicUriRenderer.sol";

contract NFTDynamicUriRenderer is IDynamicUriRenderer {

    function render(address subject, string calldata, bytes calldata inputData, address, bytes calldata) external override view returns (string memory) {
        (bytes32 collectionId, uint256 itemId) = abi.decode(inputData, (bytes32, uint256));
        (address host,,,) = IItemMainInterface(subject).collection(collectionId);
        IERC1155Wrapper wrapper = IERC1155Wrapper(host);
        (address tokenAddress, uint256 tokenId) = wrapper.source(itemId);
        return Item(tokenAddress).uri(tokenId);
    }
}