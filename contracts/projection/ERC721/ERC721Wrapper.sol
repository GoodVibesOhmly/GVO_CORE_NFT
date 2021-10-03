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

    mapping(bytes32 => uint256) private _itemIdOf;

    constructor(bytes memory lazyInitData) ItemProjection(lazyInitData) {
    }

    function itemIdOf(address tokenAddress, uint256 tokenId) override public view returns(uint256) {
        return _itemIdOf[_toItemKey(tokenAddress, tokenId)];
    }

    function mintItems(CreateItem[] calldata) virtual override(Item, ItemProjection) external returns(uint256[] memory) {
        revert("You need to send ERC721 token or call proper mint function");
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
        uint256 createdItemId = IItemMainInterface(mainInterface).mintItems(_buildCreateItems(msg.sender, tokenId, itemReceiver, itemId))[0];
        if(itemId == 0) {
            emit Token(msg.sender, tokenId, _itemIdOf[_toItemKey(msg.sender, tokenId)] = createdItemId);
        }
        return this.onERC721Received.selector;
    }

    function mint(address[] calldata tokenAddresses, uint256[] calldata tokenIds, address[] calldata receivers) override external returns(uint256[] memory itemIds) {
        address defaultReceiver = msg.sender;
        if(receivers.length == 1) {
            defaultReceiver = receivers[0];
        }
        defaultReceiver = defaultReceiver != address(0) ? defaultReceiver : msg.sender;
        itemIds = new uint256[](tokenIds.length);
        for(uint256  i = 0 ; i < itemIds.length; i++) {
            IERC721(tokenAddresses[i]).transferFrom(msg.sender, address(this), tokenIds[i]);
            address itemReceiver = receivers.length <= 1 ? defaultReceiver : receivers[i];
            itemIds[i] = itemIdOf(tokenAddresses[i], tokenIds[i]);
            uint256 createdItemId = IItemMainInterface(mainInterface).mintItems(_buildCreateItems(tokenAddresses[i], tokenIds[i], itemReceiver != address(0) ? itemReceiver : defaultReceiver, itemIds[i]))[0];
            if(itemIds[i] == 0) {
                emit Token(tokenAddresses[i], tokenIds[i], itemIds[i] = _itemIdOf[_toItemKey(tokenAddresses[i], tokenIds[i])] = createdItemId);
            }
        }
    }

    function burn(address account, uint256 itemId, uint256 amount, bytes memory data) override(Item, ItemProjection) public {
        IItemMainInterface(mainInterface).mintTransferOrBurn(false, abi.encode(msg.sender, account, address(0), itemId, toInteroperableInterfaceAmount(amount, itemId, account)));
        emit TransferSingle(msg.sender, account, address(0), itemId, amount);
        _unwrap(account, itemId, data);
    }

    function burnBatch(address account, uint256[] calldata itemIds, uint256[] calldata amounts, bytes memory data) override(Item, ItemProjection) public {
        uint256[] memory interoperableInterfaceAmounts = new uint256[](amounts.length);
        for(uint256 i = 0 ; i < interoperableInterfaceAmounts.length; i++) {
            interoperableInterfaceAmounts[i] = toInteroperableInterfaceAmount(amounts[i], itemIds[i], account);
        }
        IItemMainInterface(mainInterface).mintTransferOrBurn(true, abi.encode(true, abi.encode(msg.sender, account, address(0), itemIds, interoperableInterfaceAmounts)));
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

    function _buildCreateItems(address tokenAddress, uint256 tokenId, address receiver, uint256 itemId) private view returns(CreateItem[] memory createItems) {
        (string memory name, string memory symbol, string memory uri) = itemId != 0 ? ("", "", "") : _tryRecoveryMetadata(tokenAddress, tokenId);
        createItems = new CreateItem[](1);
        createItems[0] = CreateItem(Header(address(0), name, symbol, uri), collectionId, itemId, receiver.asSingletonArray(), (1e18 - (itemId == 0 ? 0 : IItemMainInterface(mainInterface).totalSupply(itemId))).asSingletonArray());
    }

    function _tryRecoveryMetadata(address source, uint256 tokenId) private view returns(string memory name, string memory symbol, string memory uri) {
        IERC721Metadata nft = IERC721Metadata(source);
        try nft.name() returns(string memory n) {
            name = n;
        } catch {
        }
        try nft.symbol() returns(string memory s) {
            symbol = s;
        } catch {
        }
        try nft.tokenURI(tokenId) returns(string memory s) {
            uri = s;
        } catch {
            uri = super.uri();
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