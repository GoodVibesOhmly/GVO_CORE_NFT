//SPDX-License-Identifier: MIT

pragma solidity >=0.7.0;
pragma abicoder v2;

import "./IERC1155Wrapper.sol";
import "../ItemProjection.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

contract ERC1155Wrapper is IERC1155Wrapper, ItemProjection, IERC1155Receiver {

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
        revert("You need to call proper mint function");
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
        address receiver = from;
        if(data.length > 0) {
            receiver = abi.decode(data, (address));
        }
        receiver = receiver != address(0) ? receiver : from;
        uint256 itemId = itemIdOf(msg.sender, tokenId);
        (CreateItem[] memory createItems, uint256 tokenDecimals) = _buildCreateItems(msg.sender, tokenId, amount, receiver, itemId);
        _onERC1155Support(createItems, itemId, tokenId, tokenDecimals);
        
        return this.onERC1155Received.selector;
    }

    function _onERC1155Support(CreateItem[] memory createItems, uint256 itemId, uint256 tokenId, uint256 tokenDecimals) internal{
        uint256 createdItemId = IItemMainInterface(mainInterface).mintItems(createItems)[0];
        if(itemId == 0) {
            _tokenDecimals[itemId = _itemIdOf[_toItemKey(msg.sender, tokenId)] = createdItemId] = tokenDecimals;
            emit Token(msg.sender, tokenId, itemId);
        }
    }

    function onERC1155BatchReceived(
        address,
        address from,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts,
        bytes calldata data
    ) override external returns (bytes4) {
        address defaultReceiver = from;
        address[] memory receivers = data.length > 0 ? abi.decode(data, (address[])) : new address[](0);
        if(receivers.length == 1) {
            defaultReceiver = receivers[0];
        }
        for(uint256  i = 0 ; i < tokenIds.length; i++) {
            uint256 itemId = itemIdOf(msg.sender, tokenIds[i]);
            (CreateItem[] memory createItems, uint256 tokenDecimals) = _buildCreateItems(msg.sender, tokenIds[i], amounts[i], receivers.length <= 1 ? defaultReceiver : receivers[i], itemId);
            uint256 createdItemId = IItemMainInterface(mainInterface).mintItems(createItems)[0];
            _onERC1155BatchSupport(itemId, tokenIds, createdItemId, tokenDecimals, i);
        }
        defaultReceiver = defaultReceiver != address(0) ? defaultReceiver : msg.sender;
        return this.onERC1155BatchReceived.selector;
    }

    function _onERC1155BatchSupport(uint256 itemId, uint256[] calldata tokenIds, uint256 createdItemId, uint256 tokenDecimals, uint256 index) internal{
        if(itemId == 0) {
            _tokenDecimals[itemId = _itemIdOf[_toItemKey(msg.sender, tokenIds[index])] = createdItemId] = tokenDecimals;
            emit Token(msg.sender, tokenIds[index], itemId);
        }
    }

    function burn(address account, uint256 itemId, uint256 amount, bytes memory data) override(Item, ItemProjection) public {
        IItemMainInterface(mainInterface).mintTransferOrBurn(false, abi.encode(msg.sender, account, address(0), itemId, toInteroperableInterfaceAmount(amount, itemId, account)));
        emit TransferSingle(msg.sender, account, address(0), itemId, amount);
        _burn(account, itemId, amount, data);
    }

    function burnBatch(address account, uint256[] calldata itemIds, uint256[] calldata amounts, bytes memory data) override(Item, ItemProjection) public {
        uint256[] memory interoperableInterfaceAmounts = new uint256[](amounts.length);
        for(uint256 i = 0 ; i < interoperableInterfaceAmounts.length; i++) {
            interoperableInterfaceAmounts[i] = toInteroperableInterfaceAmount(amounts[i], itemIds[i], account);
        }
        IItemMainInterface(mainInterface).mintTransferOrBurn(true, abi.encode(msg.sender, account, address(0), itemIds, interoperableInterfaceAmounts));
        emit TransferBatch(msg.sender, account, address(0), itemIds, amounts);
        bytes[] memory datas = abi.decode(data, (bytes[]));
        for(uint256 i = 0; i < itemIds.length; i++) {
            _burn(account, itemIds[i], amounts[i], datas[i]);
        }
    }

    function _burn(address from, uint256 itemId, uint256 amount, bytes memory data) private {
        (address tokenAddress, uint256 tokenId, address receiver, bytes memory payload) = abi.decode(data, (address, uint256, address, bytes));
        receiver = receiver != address(0) ? receiver : from;
        require(itemIdOf(tokenAddress, tokenId) == itemId, "Wrong ERC20");
        uint256 converter = 10**(18 - _tokenDecimals[itemId]);
        uint256 tokenAmount = amount / converter;
        uint256 rebuiltAmount = tokenAmount * converter;
        require(amount == rebuiltAmount, "Insufficient amount");
        IERC1155(tokenAddress).safeTransferFrom(msg.sender, receiver, tokenId, tokenAmount, payload);
    }

    function _buildCreateItems(address tokenAddress, uint256 tokenId, uint256 amount, address from, uint256 itemId) private view returns(CreateItem[] memory createItems, uint256 tokenDecimals) {
        (string memory name, string memory symbol, string memory uri) = itemId != 0 ? ("", "", "") : _tryRecoveryMetadata(tokenAddress, tokenId);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount * (10**(18 - (tokenDecimals = _safeDecimals(tokenAddress, tokenId))));
        address[] memory accounts = new address[](1);
        accounts[0] = from;
        createItems = new CreateItem[](1);
        createItems[0] = CreateItem(Header(address(0), name, symbol, uri), collectionId, itemId, accounts, amounts);
    }

    function _tryRecoveryMetadata(address source, uint256 tokenId) private view returns(string memory name, string memory symbol, string memory uri) {
        Item nft = Item(source);
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
            try nft.uri(tokenId) returns(string memory s) {
                uri = s;
            } catch {
            }
        }
        if(keccak256(bytes(name)) == keccak256("")) {
            name = _toString(source);
        }
        if(keccak256(bytes(symbol)) == keccak256("")) {
            symbol = _toString(source);
        }
    }

    function _toString(address addr) private pure returns(string memory) {
        bytes memory data = abi.encodePacked(addr);
        bytes memory alphabet = "0123456789ABCDEF";

        bytes memory str = new bytes(2 + data.length * 2);
        str[0] = "0";
        str[1] = "x";
        for (uint i = 0; i < data.length; i++) {
            str[2+i*2] = alphabet[uint(uint8(data[i] >> 4))];
            str[3+i*2] = alphabet[uint(uint8(data[i] & 0x0f))];
        }
        return string(str);
    }

    function _safeDecimals(address tokenAddress, uint256 tokenId) private view returns(uint256) {
        try Item(tokenAddress).decimals(tokenId) returns(uint256 dec) {
            return dec;
        } catch {}
        return 0;
    }

    function _toItemKey(address tokenAddress, uint256 tokenId) private pure returns(bytes32) {
        return keccak256(abi.encodePacked(tokenAddress, tokenId));
    }
}