//SPDX-License-Identifier: MIT

pragma solidity >=0.7.0;
pragma abicoder v2;

import "./IERC721Wrapper.sol";
import "../ItemProjection.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import { Uint256Utilities } from "@ethereansos/swissknife/contracts/lib/GeneralUtilities.sol";

contract ERC721Wrapper is IERC721Wrapper, ItemProjection, IERC721Receiver {
    using AddressUtilities for address;
    using Uint256Utilities for uint256;
    using BytesUtilities for bytes;

    mapping(bytes32 => uint256) private _itemIdOf;

    constructor(bytes memory lazyInitData) ItemProjection(lazyInitData) {
    }

    function itemIdOf(address tokenAddress, uint256 tokenId) override public view returns(uint256) {
        return _itemIdOf[_toItemKey(tokenAddress, tokenId)];
    }

    function mintItems(CreateItem[] calldata createItemsInput) virtual override(Item, ItemProjection) external returns(uint256[] memory itemIds) {
        CreateItem[] memory createItems = new CreateItem[](createItemsInput.length);
        uint256[] memory preloadedTokenIds = new uint256[](createItemsInput.length);
        string memory uri = plainUri();
        for(uint256  i = 0; i < createItemsInput.length; i++) {
            address tokenAddress = address(uint160(uint256(createItemsInput[i].collectionId)));
            uint256 tokenId = createItemsInput[i].id;
            IERC721(tokenAddress).transferFrom(msg.sender, address(this), tokenId);
            createItems[i] = _buildCreateItem(tokenAddress, createItemsInput[i].accounts, createItemsInput[i].amounts, preloadedTokenIds[i] = itemIdOf(tokenAddress, tokenId), uri);
        }
        itemIds = IItemMainInterface(mainInterface).mintItems(createItems);
        for(uint256 i = 0; i < createItemsInput.length; i++) {
            if(preloadedTokenIds[i] == 0) {
                address tokenAddress = address(uint160(uint256(createItemsInput[i].collectionId)));
                uint256 tokenId = createItemsInput[i].id;
                emit Token(tokenAddress, tokenId, _itemIdOf[_toItemKey(tokenAddress, tokenId)] = itemIds[i]);
            }
        }
    }

    function onERC721Received(
        address,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) override external returns (bytes4) {
        address itemReceiver = from;
        if(data.length > 0) {
            itemReceiver = abi.decode(data, (address));
        }
        itemReceiver = itemReceiver != address(0) ? itemReceiver : from;
        uint256 itemId = itemIdOf(msg.sender, tokenId);
        CreateItem[] memory createItems = new CreateItem[](1);
        createItems[0] = _buildCreateItem(msg.sender, itemReceiver.asSingletonArray(), new uint256[](0), itemId, plainUri());
        uint256 createdItemId = IItemMainInterface(mainInterface).mintItems(createItems)[0];
        if(itemId == 0) {
            emit Token(msg.sender, tokenId, _itemIdOf[_toItemKey(msg.sender, tokenId)] = createdItemId);
        }
        return this.onERC721Received.selector;
    }

    function burn(address account, uint256 itemId, uint256 amount, bytes memory data) override(Item, ItemProjection) public {
        uint256 amountToBurn = toInteroperableInterfaceAmount(amount, itemId, account);
        require(amountToBurn >= (51*1e16), "Insufficient balance");
        IItemMainInterface(mainInterface).mintTransferOrBurn(false, abi.encode(msg.sender, account, address(0), itemId, amountToBurn));
        emit TransferSingle(msg.sender, account, address(0), itemId, amount);
        _unwrap(account, itemId, data);
    }

    function burnBatch(address account, uint256[] calldata itemIds, uint256[] calldata amounts, bytes memory data) override(Item, ItemProjection) public {
        uint256[] memory interoperableInterfaceAmounts = new uint256[](amounts.length);
        for(uint256 i = 0 ; i < interoperableInterfaceAmounts.length; i++) {
            interoperableInterfaceAmounts[i] = toInteroperableInterfaceAmount(amounts[i], itemIds[i], account);
            require(interoperableInterfaceAmounts[i] >= (51*1e16), "Insufficient balance");
        }
        IItemMainInterface(mainInterface).mintTransferOrBurn(true, abi.encode(true, abi.encode(abi.encode(msg.sender, account, address(0), itemIds, interoperableInterfaceAmounts).asSingletonArray())));
        emit TransferBatch(msg.sender, account, address(0), itemIds, amounts);
        bytes[] memory datas = abi.decode(data, (bytes[]));
        for(uint256 i = 0; i < itemIds.length; i++) {
            _unwrap(account, itemIds[i], datas[i]);
        }
    }

    function _unwrap(address from, uint256 itemId, bytes memory data) private {
        (address tokenAddress, uint256 tokenId, address receiver, bytes memory payload, bool safe, bool withData) = abi.decode(data, (address, uint256, address, bytes, bool, bool));
        receiver = receiver != address(0) ? receiver : from;
        require(itemIdOf(tokenAddress, tokenId) == itemId, "Wrong ERC721");
        IERC721 token = IERC721(tokenAddress);
        if(!safe) {
            token.transferFrom(address(this), receiver, tokenId);
            return;
        }
        if(withData) {
            token.safeTransferFrom(address(this), receiver, tokenId, payload);
            return;
        }
        token.safeTransferFrom(address(this), receiver, tokenId);
    }

    function _buildCreateItem(address tokenAddress, address[] memory receivers, uint256[] memory values, uint256 itemId, string memory uri) private view returns(CreateItem memory) {
        (string memory name, string memory symbol) = itemId != 0 ? ("", "") : _tryRecoveryMetadata(tokenAddress);
        uint256 supplyToMint = (1e18 - (itemId == 0 ? 0 : IItemMainInterface(mainInterface).totalSupply(itemId)));
        address[] memory accounts = receivers.length == 0 ? msg.sender.asSingletonArray() : receivers;
        uint256[] memory amounts = values.length == 0 ? supplyToMint.asSingletonArray() : values;
        require(accounts.length == amounts.length, "length");
        for(uint256 i = 0; i < amounts.length; i++) {
            require(accounts[i] != address(0), "zero address");
            supplyToMint -= amounts[i];
        }
        require(supplyToMint == 0, "amount");
        return CreateItem(Header(address(0), name, symbol, itemId != 0 ? "" : uri), collectionId, itemId, accounts, amounts);
    }

    function _tryRecoveryMetadata(address source) private view returns(string memory name, string memory symbol) {
        IERC721Metadata nft = IERC721Metadata(source);
        try nft.name() returns(string memory n) {
            name = n;
        } catch {
        }
        try nft.symbol() returns(string memory s) {
            symbol = s;
        } catch {
        }
        if(keccak256(bytes(name)) == keccak256("")) {
            name = source.toString();
        }
        if(keccak256(bytes(symbol)) == keccak256("")) {
            symbol = source.toString();
        }
    }

    function _toItemKey(address tokenAddress, uint256 tokenId) private pure returns(bytes32) {
        return keccak256(abi.encodePacked(tokenAddress, tokenId));
    }
}