//SPDX-License-Identifier: MIT

pragma solidity >=0.7.0;
pragma abicoder v2;

import "./IERC1155Wrapper.sol";
import "../ItemProjection.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import { Uint256Utilities } from "@ethereansos/swissknife/contracts/lib/GeneralUtilities.sol";

contract ERC1155Wrapper is IERC1155Wrapper, ItemProjection, IERC1155Receiver {
    using AddressUtilities for address;
    using Uint256Utilities for uint256;

    mapping(bytes32 => uint256) private _itemIdOf;
    mapping(uint256 => uint256) private _tokenDecimals;

    constructor(bytes memory lazyInitData) ItemProjection(lazyInitData) {
    }

    function _projectionLazyInit(bytes memory collateralInitData) internal override returns (bytes memory) {
    }

    function itemIdOf(address tokenAddress, uint256 tokenId) override public view returns(uint256) {
        return _itemIdOf[_toItemKey(tokenAddress, tokenId)];
    }

    function mintItems(CreateItem[] calldata) virtual override(Item, ItemProjection) external returns(uint256[] memory) {
        revert("You need to send ERC1155 token(s)");
    }

    function decimals(uint256 tokenId) virtual override(IERC1155Views, ItemProjection) public view returns(uint256) {
        return _tokenDecimals[tokenId];
    }

    function onERC1155Received(
        address,
        address from,
        uint256 tokenId,
        uint256 amount,
        bytes calldata data
    ) override external returns (bytes4) {
        (uint256[] memory values, address[] memory receivers) = abi.decode(data, (uint256[], address[]));
        uint256 itemId = itemIdOf(msg.sender, tokenId);
        (CreateItem[] memory createItems, uint256 tokenDecimals) = _buildCreateItems(from, msg.sender, tokenId, amount, values, receivers, itemId);
        _trySaveCreatedItemAndEmitTokenEvent(itemId, tokenId, createItems, tokenDecimals);
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address from,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts,
        bytes calldata data
    ) override external returns (bytes4) {
        bytes[] memory dataArray = abi.decode(data, (bytes[]));
        for(uint256  i = 0 ; i < tokenIds.length; i++) {
            (uint256[] memory values, address[] memory receivers) = abi.decode(dataArray[i], (uint256[], address[]));
            uint256 itemId = itemIdOf(msg.sender, tokenIds[i]);
            (CreateItem[] memory createItems, uint256 tokenDecimals) = _buildCreateItems(from, msg.sender, tokenIds[i], amounts[i], values, receivers, itemId);
            _trySaveCreatedItemAndEmitTokenEvent(itemId, tokenIds[i], createItems, tokenDecimals);
        }
        return this.onERC1155BatchReceived.selector;
    }

    function _trySaveCreatedItemAndEmitTokenEvent(uint256 itemId, uint256 tokenId, CreateItem[] memory createItems, uint256 tokenDecimals) internal{
        uint256 createdItemId = IItemMainInterface(mainInterface).mintItems(createItems)[0];
        if(itemId != 0) {
            return;
        }
        _tokenDecimals[itemId = _itemIdOf[_toItemKey(msg.sender, tokenId)] = createdItemId] = tokenDecimals;
        emit Token(msg.sender, tokenId, itemId);
    }

    function burn(address account, uint256 itemId, uint256 amount, bytes memory data) override(Item, ItemProjection) public {
        IItemMainInterface(mainInterface).mintTransferOrBurn(false, abi.encode(msg.sender, account, address(0), itemId, toInteroperableInterfaceAmount(amount, itemId, account)));
        emit TransferSingle(msg.sender, account, address(0), itemId, amount);
        _unwrap(account, itemId, amount, data);
    }

    function burnBatch(address account, uint256[] calldata itemIds, uint256[] calldata amounts, bytes memory data) override(Item, ItemProjection) public {
        uint256[] memory interoperableInterfaceAmounts = new uint256[](amounts.length);
        for(uint256 i = 0; i < interoperableInterfaceAmounts.length; i++) {
            interoperableInterfaceAmounts[i] = toInteroperableInterfaceAmount(amounts[i], itemIds[i], account);
        }
        IItemMainInterface(mainInterface).mintTransferOrBurn(true, abi.encode(msg.sender, account, address(0), itemIds, interoperableInterfaceAmounts));
        emit TransferBatch(msg.sender, account, address(0), itemIds, amounts);
        bytes[] memory datas = abi.decode(data, (bytes[]));
        for(uint256 i = 0; i < itemIds.length; i++) {
            _unwrap(account, itemIds[i], amounts[i], datas[i]);
        }
    }

    function _unwrap(address from, uint256 itemId, uint256 amount, bytes memory data) private {
        (address tokenAddress, uint256 tokenId, address receiver, bytes memory payload) = abi.decode(data, (address, uint256, address, bytes));
        receiver = receiver != address(0) ? receiver : from;
        require(itemIdOf(tokenAddress, tokenId) == itemId, "Wrong ERC1155");
        uint256 converter = 10**(18 - _safeDecimals(tokenAddress, tokenId, true));
        uint256 tokenAmount = amount / converter;
        uint256 rebuiltAmount = tokenAmount * converter;
        require(amount == rebuiltAmount, "Insufficient amount");
        IERC1155(tokenAddress).safeTransferFrom(msg.sender, receiver, tokenId, tokenAmount, payload);
    }

    function _buildCreateItems(address from, address tokenAddress, uint256 tokenId, uint256 amount, uint256[] memory values, address[] memory receivers, uint256 itemId) private view returns(CreateItem[] memory createItems, uint256 tokenDecimals) {
        uint256 totalAmount = 0;
        tokenDecimals = _safeDecimals(tokenAddress, tokenId, false);
        address[] memory realReceivers = new address[](values.length);
        for(uint256 i = 0; i < values.length; i++) {
            totalAmount += values[i];
            values[i] = values[i] * (10**(18 - tokenDecimals));
            realReceivers[i] = (realReceivers[i] = i < receivers.length ? receivers[i] : from) != address(0) ? realReceivers[i] : from;
        }
        require(totalAmount == amount, "inconsistent amount");
        (string memory name, string memory symbol, string memory uri) = itemId != 0 ? ("", "", "") : _tryRecoveryMetadata(tokenAddress, tokenId);
        createItems = new CreateItem[](1);
        createItems[0] = CreateItem(Header(address(0), name, symbol, uri), collectionId, itemId, realReceivers, values);
    }

    function _tryRecoveryMetadata(address source, uint256 tokenId) private view returns(string memory name, string memory symbol, string memory uri) {
        ItemProjection nft = ItemProjection(source);
        try nft.name(tokenId) returns(string memory n) {
            name = n;
        } catch {
        }
        try nft.symbol(tokenId) returns(string memory s) {
            symbol = s;
        } catch {
        }
        try nft.uri(tokenId) returns(string memory s) {
            uri = s;
        } catch {
        }
        if(keccak256(bytes(name)) == keccak256("")) {
            try nft.name() returns(string memory n) {
                name = n;
            } catch {
            }
        }
        if(keccak256(bytes(symbol)) == keccak256("")) {
            try nft.symbol() returns(string memory s) {
                symbol = s;
            } catch {
            }
        }
        if(keccak256(bytes(uri)) == keccak256("")) {
            try nft.uri() returns(string memory s) {
                uri = s;
            } catch {
                uri = super.uri();
            }
        }
        if(keccak256(bytes(name)) == keccak256("")) {
            name = source.toString();
        }
        if(keccak256(bytes(symbol)) == keccak256("")) {
            symbol = source.toString();
        }
    }

    function _safeDecimals(address tokenAddress, uint256 tokenId, bool forBurn) private view returns(uint256) {
        try Item(tokenAddress).decimals(tokenId) returns(uint256 dec) {
            return dec;
        } catch {
            return forBurn ? 0 : 18;
        }
    }

    function _toItemKey(address tokenAddress, uint256 tokenId) private pure returns(bytes32) {
        return keccak256(abi.encodePacked(tokenAddress, tokenId));
    }
}