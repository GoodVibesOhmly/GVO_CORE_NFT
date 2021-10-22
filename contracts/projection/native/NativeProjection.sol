//SPDX-License-Identifier: MIT

pragma solidity >=0.7.0;
pragma abicoder v2;

import "../ItemProjection.sol";

contract NativeProjection is ItemProjection {

    mapping(uint256 => bool) public isFinalized;

    constructor(bytes memory lazyInitData) ItemProjection(lazyInitData) {
    }

    function _lazyInit(bytes memory lazyInitParams) override virtual internal returns(bytes memory lazyInitResponse) {
        (mainInterface, lazyInitResponse) = abi.decode(lazyInitParams, (address, bytes));
        Header memory header;
        CreateItem[] memory items;
        (collectionId, header, items, lazyInitResponse) = abi.decode(lazyInitResponse, (bytes32, Header, CreateItem[], bytes));
        uint256[] memory itemIds;
        if(collectionId == bytes32(0)) {
            header.host = address(this);
            (collectionId, itemIds) = IItemMainInterface(mainInterface).createCollection(header, items);
        } else if(items.length > 0) {
            itemIds = IItemMainInterface(mainInterface).mintItems(items);
        }
        if(lazyInitResponse.length > 0) {
            bool[] memory finalized = abi.decode(lazyInitResponse, (bool[]));
            for(uint256 i = 0; i < itemIds.length; i++) {
                if(i < finalized.length && finalized[i]) {
                    isFinalized[itemIds[i]] = finalized[i];
                }
            }
        }
        lazyInitResponse = _projectionLazyInit(lazyInitResponse);
    }

    function mintItems(CreateItem[] calldata items, bool[] memory finalized) authorizedOnly public returns(uint256[] memory itemIds) {
        itemIds = IItemMainInterface(mainInterface).mintItems(items);
        for(uint256 i = 0; i < items.length; i++) {
            uint256 itemId = items[i].id;
            require(itemId == 0 || !isFinalized[itemId], "Finalized");
            if(itemId == 0) {
                isFinalized[itemIds[i]] = finalized[i];
            }
        }
        for(uint256 i = 0; i < items.length; i++) {
            uint256 itemId = items[i].id;
            if(itemId != 0 && finalized[i]) {
                isFinalized[itemId] = finalized[i];
            }
        }
    }

    function mintItems(CreateItem[] calldata items) authorizedOnly virtual override external returns(uint256[] memory itemIds) {
        return mintItems(items, new bool[](items.length));
    }

    function finalize(uint256[] calldata itemIds) external authorizedOnly {
        for(uint256 i = 0; i < itemIds.length; i++) {
            uint256 itemId = itemIds[i];
            (bytes32 itemCollectionId,,,) = IItemMainInterface(mainInterface).item(itemId);
            require(itemCollectionId == collectionId, 'Unauthorized');
            require(!isFinalized[itemId], "Already Finalized");
            isFinalized[itemId] = true;
        }
    }
}