//SPDX-License-Identifier: MIT

pragma solidity >=0.7.0;
pragma abicoder v2;

import "./IERC1155DeckWrapper.sol";
import "../ItemProjection.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import { Uint256Utilities, StringUtilities } from "@ethereansos/swissknife/contracts/lib/GeneralUtilities.sol";

contract ERC1155DeckWrapper is IERC1155DeckWrapper, ItemProjection, IERC1155Receiver {
    using AddressUtilities for address;
    using Uint256Utilities for uint256;
    using Uint256Utilities for uint256[];
    using BytesUtilities for bytes;
    using StringUtilities for string;

    mapping(bytes32 => uint256) private _itemIdOf;
    mapping(uint256 => uint256) private _tokenDecimals;

    mapping(uint256 => address) private _sourceTokenAddress;
    mapping(uint256 => bytes32) private _sourceTokenKey;

    uint256[] private _tokenIds;
    mapping(uint256 => bool) private _reserve;
    mapping(uint256 => uint256) private _originalAmount;
    mapping(uint256 => address[]) private _accounts;
    mapping(uint256 => uint256[]) private _originalAmounts;

    uint256 public override reserveTimeInBlocks;

    struct ReserveData {
        address unwrapper;
        uint256 timeout;
    }

    mapping(bytes32 => ReserveData) private _reserveData;

    constructor(bytes memory lazyInitData) ItemProjection(lazyInitData) {
    }

    function _projectionLazyInit(bytes memory collateralInitData) internal override returns (bytes memory) {
        reserveTimeInBlocks = abi.decode(collateralInitData, (uint256));
        return "";
    }

    function reserveData(address tokenAddress, uint256 tokenId) external override view returns(address unwrapper, uint256 timeout) {
        ReserveData memory data = _reserveData[_toReserveDataKey(tokenAddress, tokenId)];
        unwrapper = data.unwrapper;
        timeout = data.timeout;
    }

    function itemIdOf(address tokenAddress, uint256 tokenId) override public view returns(uint256) {
        return _itemIdOf[_toItemKey(tokenAddress, tokenId)];
    }

    function source(uint256 itemId) external override view returns(address tokenAddress, bytes32 tokenKey) {
        return (_sourceTokenAddress[itemId], _sourceTokenKey[itemId]);
    }

    function mintItems(CreateItem[] calldata createItemsInput) virtual override(Item, ItemProjection) public returns(uint256[] memory itemIds) {
        return mintItems(createItemsInput, new bool[](0));
    }

    function mintItems(CreateItem[] calldata createItemsInput, bool[] memory reserveArray) override public returns(uint256[] memory itemIds) {
        require(createItemsInput.length > 0 && (reserveArray.length == 0 || createItemsInput.length == reserveArray.length), "input");
        CreateItem[] memory createItems = new CreateItem[](createItemsInput.length);
        uint256[] memory loadedItemIds = new uint256[](createItemsInput.length);
        string memory uri = plainUri();
        for(uint256  i = 0; i < createItemsInput.length; i++) {
            address tokenAddress = address(uint160(uint256(createItemsInput[i].collectionId)));
            uint256 tokenId = createItemsInput[i].id;
            uint256 value = createItemsInput[i].amounts.sum();
            bytes memory encodedData = abi.encode(createItemsInput[i].accounts, createItemsInput[i].amounts, i < reserveArray.length && reserveArray[i]);
            bool reserve;
            (createItems[i],, reserve) = _buildCreateItem(msg.sender, tokenAddress, tokenId, value, encodedData, loadedItemIds[i] = itemIdOf(tokenAddress, tokenId), uri);
            IERC1155(tokenAddress).safeTransferFrom(msg.sender, address(this), tokenId, value, "");
            if(reserve) {
                _reserveData[_toReserveDataKey(tokenAddress, tokenId)] = ReserveData(msg.sender, block.number + reserveTimeInBlocks);
            }
        }
        itemIds = IItemMainInterface(mainInterface).mintItems(createItems);
        for(uint256 i = 0; i < createItemsInput.length; i++) {
            address tokenAddress = address(uint160(uint256(createItemsInput[i].collectionId)));
            uint256 tokenId = createItemsInput[i].id;
            if(loadedItemIds[i] == 0) {
                bytes32 itemKey = _toItemKey(tokenAddress, tokenId);
                _itemIdOf[itemKey] = itemIds[i];
                _sourceTokenAddress[itemIds[i]] = tokenAddress;
                _sourceTokenKey[itemIds[i]] = itemKey;
                loadedItemIds[i] = itemIds[i];
            }
            emit Token(tokenAddress, tokenId, loadedItemIds[i]);
        }
    }

    function setHeader(Header calldata value) authorizedOnly override(IItemProjection, ItemProjection) external virtual returns(Header memory oldValue) {
        Header[] memory values = new Header[](1);
        values[0] = value;
        values[0].host = address(this);
        bytes32[] memory collectionIds = new bytes32[](1);
        collectionIds[0] = collectionId;
        return IItemMainInterface(mainInterface).setCollectionsMetadata(collectionIds, values)[0];
    }

    function setItemsCollection(uint256[] calldata, bytes32[] calldata) authorizedOnly virtual override(Item, ItemProjection) external returns(bytes32[] memory) {
        revert("Impossibru!");
    }

    function onERC1155Received(
        address operator,
        address from,
        uint256 tokenId,
        uint256 amount,
        bytes calldata data
    ) override external returns (bytes4) {
        if(operator == address(this)) {
            return this.onERC1155Received.selector;
        }
        uint256 itemId = itemIdOf(msg.sender, tokenId);
        (CreateItem memory createItem, uint256 tokenDecimals, bool reserve) = _buildCreateItem(from, msg.sender, tokenId, amount, data, itemId, plainUri());
        _trySaveCreatedItemAndEmitTokenEvent(itemId, 0, tokenId, createItem, tokenDecimals);
        if(reserve) {
            _reserveData[_toReserveDataKey(msg.sender, tokenId)] = ReserveData(from, block.number + reserveTimeInBlocks);
        }
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address operator,
        address from,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts,
        bytes memory data
    ) override external returns (bytes4) {
        if(operator == address(this)) {
            return this.onERC1155BatchReceived.selector;
        }
        bytes[] memory dataArray = abi.decode(data, (bytes[]));
        for(uint256 i = 0 ; i < tokenIds.length; i++) {
            _prepareTempVars(from, tokenIds[i], amounts[i], dataArray[i]);
        }
        (CreateItem[] memory createItems, uint256[] memory loadedItemIds, uint256[] memory tokenDecimals) = _buildCreateItems(from, msg.sender);
        uint256[] memory itemIds = IItemMainInterface(mainInterface).mintItems(createItems);
        for(uint256 i = 0; i < createItems.length; i++) {
            _trySaveCreatedItemAndEmitTokenEvent(loadedItemIds[i], itemIds[i], _tokenIds[i], createItems[i], tokenDecimals[i]);
            delete _tokenIds[i];
        }
        delete _tokenIds;
        return this.onERC1155BatchReceived.selector;
    }

    function _buildCreateItems(address from, address tokenAddress) private returns(CreateItem[] memory createItems, uint256[] memory loadedItemIds, uint256[] memory tokenDecimals) {
        createItems = new CreateItem[](_tokenIds.length);
        loadedItemIds = new uint256[](_tokenIds.length);
        tokenDecimals = new uint256[](_tokenIds.length);
        string memory uri = plainUri();
        for(uint256 i = 0; i < _tokenIds.length; i++) {
            uint256 tokenId = _tokenIds[i];
            bool reserve;
            (createItems[i], tokenDecimals[i], reserve) = _buildCreateItem(from, tokenAddress, tokenId, _originalAmount[tokenId], abi.encode(_originalAmounts[tokenId], _accounts[tokenId], _reserve[tokenId]), loadedItemIds[i] = itemIdOf(msg.sender, tokenId), uri);
            if(reserve) {
                _reserveData[_toReserveDataKey(tokenAddress, tokenId)] = ReserveData(from, block.number + reserveTimeInBlocks);
            }
            delete _originalAmount[tokenId];
            delete _accounts[tokenId];
            delete _originalAmounts[tokenId];
            delete _reserve[tokenId];
        }
    }

    function _trySaveCreatedItemAndEmitTokenEvent(uint256 itemId, uint256 createdItemId, uint256 tokenId, CreateItem memory createItem, uint256 tokenDecimals) internal {
        if(createdItemId == 0) {
            CreateItem[] memory createItems = new CreateItem[](1);
            createItems[0] = createItem;
            createdItemId = IItemMainInterface(mainInterface).mintItems(createItems)[0];
        }
        if(itemId == 0) {
            bytes32 itemKey = _toItemKey(msg.sender, tokenId);
            _itemIdOf[itemKey] = createdItemId;
            _tokenDecimals[createdItemId] = tokenDecimals;
            _sourceTokenAddress[createdItemId] = msg.sender;
            _sourceTokenKey[createdItemId] = itemKey;
            itemId = createdItemId;
        }

        emit Token(msg.sender, tokenId, itemId);
    }

    function burn(address account, uint256 itemId, uint256 amount, bytes memory data) override(Item, ItemProjection) public {
        require(account != address(0), "required account");
        IItemMainInterface(mainInterface).mintTransferOrBurn(false, abi.encode(msg.sender, account, address(0), itemId, _unwrap(account, itemId, amount, data)));
        emit TransferSingle(msg.sender, account, address(0), itemId, amount);
    }

    function burnBatch(address account, uint256[] calldata itemIds, uint256[] calldata amounts, bytes memory data) override(Item, ItemProjection) public {
        require(account != address(0), "required account");
        uint256[] memory interoperableInterfaceAmounts = new uint256[](amounts.length);
        bytes[] memory datas = abi.decode(data, (bytes[]));
        for(uint256 i = 0; i < itemIds.length; i++) {
            interoperableInterfaceAmounts[i] = _unwrap(account, itemIds[i], amounts[i], datas[i]);
            IItemMainInterface(mainInterface).mintTransferOrBurn(false, abi.encode(msg.sender, account, address(0), itemIds[i], interoperableInterfaceAmounts[i]));
        }
        emit TransferBatch(msg.sender, account, address(0), itemIds, interoperableInterfaceAmounts);
    }

    function _prepareTempVars(address from, uint256 tokenId, uint256 amount, bytes memory data) private {
        (uint256[] memory amounts, address[] memory receivers, bool reserve) = abi.decode(data, (uint256[], address[], bool));
        uint256 originalAmount = 0;
        address[] memory accounts = receivers.length == 0 ? from.asSingletonArray() : receivers;
        require(accounts.length == amounts.length, "length");
        if(reserve) {
            _reserve[tokenId] = reserve;
        }
        for(uint256 z = 0; z < amounts.length; z++) {
            require(amounts[z] > 0, "zero amount");
            require(accounts[z] != address(0), "zero address");
            _originalAmounts[tokenId].push(amounts[z]);
            _accounts[tokenId].push(accounts[z]);
            originalAmount += amounts[z];
        }
        require(originalAmount == amount, "Not corresponding");
        if((_originalAmount[tokenId] += originalAmount) == originalAmount) {
            _tokenIds.push(tokenId);
        }
    }

    function _buildCreateItem(address from, address tokenAddress, uint256 tokenId, uint256 amount, bytes memory data, uint256 itemId, string memory uri) private view returns(CreateItem memory createItem, uint256 tokenDecimals, bool reserve) {
        uint256[] memory values;
        address[] memory receivers;
        (values, receivers, reserve) = abi.decode(data, (uint256[], address[], bool));
        uint256 totalAmount = 0;
        tokenDecimals = itemId != 0 ? _tokenDecimals[itemId] : _safeDecimals(tokenAddress, tokenId);
        require(tokenDecimals == 0 || tokenAddress == mainInterface, "unsupported");
        if(reserve) {
            require(tokenDecimals == 0 && (itemId == 0 || IItemMainInterface(mainInterface).totalSupply(itemId) < 1e18), "cannot reserve");
        }
        address[] memory realReceivers = new address[](values.length);
        for(uint256 i = 0; i < values.length; i++) {
            totalAmount += values[i];
            values[i] = _convertAmount(i, tokenDecimals, values[i], itemId);
            realReceivers[i] = (realReceivers[i] = i < receivers.length ? receivers[i] : from) != address(0) ? realReceivers[i] : from;
        }
        require(totalAmount == amount, "amount");
        (string memory name, string memory symbol) = itemId != 0 ? ("", "") : _tryRecoveryMetadata(tokenAddress, tokenId);
        name = itemId != 0 ? "" : string(abi.encodePacked(name, " item"));
        symbol = itemId != 0 ? "" : string(abi.encodePacked("i", symbol));
        createItem = CreateItem(Header(address(0), name, symbol, uri), collectionId, itemId, realReceivers, values);
    }

    function _convertAmount(uint256 i, uint256 tokenDecimals, uint256 plainValue, uint256 itemId) private view returns(uint256) {
        uint256 totalSupply = itemId == 0 ? 0 : Item(mainInterface).totalSupply(itemId);
        if(i > 0 || tokenDecimals != 0 || itemId == 0 || (itemId != 0 && (totalSupply >= 1e18))) {
            return plainValue * (10**(18 - tokenDecimals));
        }
        return (1e18 - totalSupply) + ((plainValue - 1) * (10**(18 - tokenDecimals)));
    }

    function _tryRecoveryMetadata(address source, uint256 tokenId) private view returns(string memory name, string memory symbol) {
        ItemProjection nft = ItemProjection(source);
        try nft.name(tokenId) returns(string memory n) {
            name = n;
        } catch {
        }
        try nft.symbol(tokenId) returns(string memory s) {
            symbol = s;
        } catch {
        }
        if(name.isEmpty()) {
            try nft.name() returns(string memory n) {
                name = n;
            } catch {
            }
        }
        if(symbol.isEmpty()) {
            try nft.symbol() returns(string memory s) {
                symbol = s;
            } catch {
            }
        }
        if(name.isEmpty()) {
            name = source.toString();
        }
        if(symbol.isEmpty()) {
            symbol = source.toString();
        }
    }

    function _safeDecimals(address tokenAddress, uint256 tokenId) private view returns(uint256 dec) {
        (bool result, bytes memory response) = tokenAddress.staticcall(abi.encodeWithSelector(0x3f47e662, tokenId));//decimals(uint256)
        if(!result) {
            (result, response) = tokenAddress.staticcall(abi.encodeWithSelector(0x313ce567));//decimals()
        }
        if(result) {
            dec = abi.decode(response, (uint256));
        } else {
            (result, response) = tokenAddress.staticcall(abi.encodeWithSelector(IERC20Metadata(tokenAddress).decimals.selector));
            if(result) {
                dec = abi.decode(response, (uint256));
            }
        }
        require(dec == 0 || dec == 18, "dec");
    }

    function _toItemKey(address tokenAddress, uint256 tokenId) private view returns(bytes32 key) {
        if(tokenAddress == mainInterface) {
            (key,,,) = IItemMainInterface(mainInterface).item(tokenId);
        } else {
            key = keccak256(abi.encodePacked(tokenAddress));
        }
    }

    function _unwrap(address from, uint256 itemId, uint256 amount, bytes memory data) private returns (uint256 interoperableAmount) {
        require(amount > 0, "zero");
        (address tokenAddress, uint256 tokenId, address receiver, bytes memory payload) = abi.decode(data, (address, uint256, address, bytes));
        receiver = receiver != address(0) ? receiver : from;
        require(itemIdOf(tokenAddress, tokenId) == itemId, "token");
        _verifyReserve(tokenAddress, tokenId, from);
        uint256 converter = 10**(18 - _tokenDecimals[itemId]);
        uint256 tokenAmount = amount / converter;
        interoperableAmount = amount;
        require(interoperableAmount > 0);
        uint256 balanceOf = IItemMainInterface(mainInterface).balanceOf(from, itemId);
        require(balanceOf > 0 && balanceOf >= interoperableAmount, "insuff");
        uint256 totalSupply = IItemMainInterface(mainInterface).totalSupply(itemId);
        bool isUnity = interoperableAmount >= (51*1e16);
        if(totalSupply <= 1e18 && isUnity) {
            tokenAmount = 1;
        } else {
            require(amount == tokenAmount * converter, "amount");
        }
        require(_tokenDecimals[itemId] == 18 || totalSupply > 1e18 || isUnity, "balance");
        IERC1155(tokenAddress).safeTransferFrom(address(this), receiver, tokenId, tokenAmount, payload);
    }

    function _verifyReserve(address tokenAddress, uint256 tokenId, address from) private {
        bytes32 reserveDataKey = _toReserveDataKey(tokenAddress, tokenId);
        ReserveData memory reserveDataElement = _reserveData[reserveDataKey];
        if(reserveDataElement.unwrapper != address(0)) {
            require(reserveDataElement.unwrapper == from || block.number >= reserveDataElement.timeout, "Cannot unlock");
            delete _reserveData[reserveDataKey];
        }
    }

    function _toReserveDataKey(address tokenAddress, uint256 tokenId) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(tokenAddress, tokenId));
    }
}