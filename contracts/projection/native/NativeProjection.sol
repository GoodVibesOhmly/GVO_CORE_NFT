//SPDX-License-Identifier: MIT

pragma solidity >=0.7.0;
pragma abicoder v2;

import "../ItemProjection.sol";

contract NativeProjection is ItemProjection {

    mapping(uint256 => bool) public isFinalized;

    constructor(bytes memory lazyInitData) ItemProjection(lazyInitData) {
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
    }

    function mintItems(CreateItem[] calldata items) authorizedOnly virtual override external returns(uint256[] memory itemIds) {
        return mintItems(items, new bool[](items.length));
    }
}