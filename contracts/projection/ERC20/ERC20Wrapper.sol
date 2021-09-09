//SPDX-License-Identifier: MIT

pragma solidity >=0.7.0;
pragma abicoder v2;

import "./IERC20Wrapper.sol";
import "../ItemProjection.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { Uint256Utilities, TransferUtilities } from "@ethereansos/swissknife/contracts/lib/GeneralUtilities.sol";

contract ERC20Wrapper is IERC20Wrapper, ItemProjection {
    using AddressUtilities for address;
    using Uint256Utilities for uint256;
    using TransferUtilities for address;

    mapping(address => uint256) public override itemIdOf;
    mapping(address => uint256) private _tokenDecimals;

    constructor(bytes memory lazyInitData) ItemProjection(lazyInitData) {
    }

    function _projectionLazyInit(bytes memory collateralInitData) internal override returns (bytes memory) {
    }

    function mintItems(CreateItem[] calldata) virtual override(Item, ItemProjection) external returns(uint256[] memory) {
        revert("You need to call proper mint function");
    }

    function mint(address[] calldata tokenAddresses, uint256[] calldata amounts, address[] calldata receivers) override payable external returns(uint256[] memory itemIds) {
        address defaultReceiver = msg.sender;
        if(receivers.length == 1) {
            defaultReceiver = receivers[0];
        }
        defaultReceiver = defaultReceiver != address(0) ? defaultReceiver : msg.sender;
        itemIds = new uint256[](amounts.length);
        uint256[] memory realAmounts = new uint256[](amounts.length);
        uint256 ethAmount = 0;
        string memory uri = plainUri();
        for(uint256  i = 0 ; i < itemIds.length; i++) {
            if(tokenAddresses[i] == address(0)) {
                ethAmount += realAmounts[i] = amounts[i];
            } else {
                uint256 previousBalance = IERC20(tokenAddresses[i]).balanceOf(address(this));
                tokenAddresses[i].safeTransferFrom(msg.sender, address(this), amounts[i]);
                realAmounts[i] = IERC20(tokenAddresses[i]).balanceOf(address(this)) - previousBalance;
            }
            address itemReceiver = receivers.length <= 1 ? defaultReceiver : receivers[i];
            itemIds[i] = itemIdOf[tokenAddresses[i]];
            uint256 createdItemId = IItemMainInterface(mainInterface).mintItems(_buildCreateItems(tokenAddresses[i], realAmounts[i], itemReceiver != address(0) ? itemReceiver : defaultReceiver, itemIds[i], uri))[0];
            if(itemIds[i] == 0) {
                emit Token(tokenAddresses[i], itemIds[i] = itemIdOf[tokenAddresses[i]] = createdItemId);
            }
        }
        require(msg.value >= ethAmount, "Invalid ETH Value");
        if(msg.value > ethAmount) {
            address(0).safeTransfer(msg.sender, msg.value - ethAmount);
        }
    }

    function burn(address account, uint256 itemId, uint256 amount, bytes memory data) override(Item, ItemProjection) public {
        IItemMainInterface(mainInterface).mintTransferOrBurn(false, abi.encode(msg.sender, account, address(0), itemId, toInteroperableInterfaceAmount(amount, itemId, account)));
        emit TransferSingle(msg.sender, account, address(0), itemId, amount);
        _unwrap(account, itemId, amount, data);
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
            _unwrap(account, itemIds[i], amounts[i], datas[i]);
        }
    }

    function _unwrap(address from, uint256 itemId, uint256 amount, bytes memory data) private {
        (address tokenAddress, address receiver) = abi.decode(data, (address, address));
        receiver = receiver != address(0) ? receiver : from;
        require(itemIdOf[tokenAddress] == itemId, "Wrong ERC20");
        uint256 converter = 10**(18 - _tokenDecimals[tokenAddress]);
        uint256 tokenAmount = amount / converter;
        uint256 rebuiltAmount = tokenAmount * converter;
        require(amount == rebuiltAmount, "Insufficient amount");
        tokenAddress.safeTransfer(receiver, tokenAmount);
    }

    function _buildCreateItems(address tokenAddress, uint256 amount, address receiver, uint256 itemId, string memory uri) private returns(CreateItem[] memory createItems) {
        string memory name = itemId != 0 ? "" : string(abi.encodePacked(_stringValue(tokenAddress, "name()", "NAME()"), " item"));
        string memory symbol = itemId != 0 ? "" : string(abi.encodePacked("i", _stringValue(tokenAddress, "symbol()", "SYMBOL()")));
        createItems = new CreateItem[](1);
        createItems[0] = CreateItem(Header(address(0), name, symbol, uri), collectionId, itemId, receiver.asSingletonArray(), (amount * (10**(18 - (_tokenDecimals[tokenAddress] = itemId != 0 ? _tokenDecimals[tokenAddress] : tokenAddress == address(0) ? 18 : IERC20Metadata(tokenAddress).decimals())))).asSingletonArray());
    }

    function _stringValue(address erc20TokenAddress, string memory firstTry, string memory secondTry) private view returns(string memory) {
        (bool success, bytes memory data) = erc20TokenAddress.staticcall{ gas: 20000 }(abi.encodeWithSignature(firstTry));
        if (!success) {
            (success, data) = erc20TokenAddress.staticcall{ gas: 20000 }(abi.encodeWithSignature(secondTry));
        }

        if (success && data.length >= 96) {
            (uint256 offset, uint256 len) = abi.decode(data, (uint256, uint256));
            if (offset == 0x20 && len > 0 && len <= 256) {
                return string(abi.decode(data, (bytes)));
            }
        }

        if (success && data.length == 32) {
            uint len = 0;
            while (len < data.length && data[len] >= 0x20 && data[len] <= 0x7E) {
                len++;
            }

            if (len > 0) {
                bytes memory result = new bytes(len);
                for (uint i = 0; i < len; i++) {
                    result[i] = data[i];
                }
                return string(result);
            }
        }

        return erc20TokenAddress.toString();
    }
}