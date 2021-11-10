//SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import "../../model/IItemMainInterface.sol";
import "./IERC20Wrapper.sol";
import "@ethereansos/swissknife/contracts/dynamicMetadata/model/IDynamicUriRenderer.sol";
import { Uint256Utilities, AddressUtilities } from "@ethereansos/swissknife/contracts/lib/GeneralUtilities.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import 'base64-sol/base64.sol';

contract ERC20WrapperUriRenderer is IDynamicUriRenderer {
    using Uint256Utilities for uint256;
    using AddressUtilities for address;

    function render(address subject, string calldata, bytes calldata inputData, address, bytes calldata) external override view returns (string memory) {
        (bytes32 collectionId, uint256 itemId) = abi.decode(inputData, (bytes32, uint256));
        (address host,,,) = IItemMainInterface(subject).collection(collectionId);
        IERC20Wrapper wrapper = IERC20Wrapper(host);
        IERC20Metadata token = IERC20Metadata(wrapper.source(itemId));
        string memory externalURL = address(token) == address(0) ? "https://ethereum.org" : _getEtherscanTokenURL(address(token));
        return string(abi.encodePacked(
            'data:application/json;base64,',
            Base64.encode(
                abi.encodePacked(
                    '{"name":"',
                    wrapper.name(itemId),
                    '","symbol":"',
                    wrapper.symbol(itemId),
                    '","decimals":',
                    wrapper.decimals(itemId).toString(),
                    ',"external_url":"',
                    externalURL,
                    '","description":"',
                    _getDescription(token, externalURL),
                    '","image":"',
                    _getTrustWalletImage(address(token)),
                    '"}'
                )
            )
        ));
    }

    function _getEtherscanTokenURL(address tokenAddress) private view returns (string memory) {
        string memory prefix = "";
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        if(chainId == 3) {
            prefix = "ropsten.";
        }
        if(chainId == 4) {
            prefix = "rinkeby.";
        }
        if(chainId == 5) {
            prefix = "goerli.";
        }
        if(chainId == 42) {
            prefix = "kovan.";
        }
        return string(abi.encodePacked(
            'https://',
            prefix,
            'etherscan.io/token/',
            tokenAddress.toString()
        ));
    }

    function _getDescription(IERC20Metadata token, string memory externalURL) private view returns (string memory) {
        uint256 tokenDecimals = address(token) == address(0) ? 18 : token.decimals();
        return string(abi.encodePacked(
            'This Item wraps the original ERC20 Token ',
            address(token) == address(0) ? "Ethereum" : _stringValue(address(token), "name()", "NAME()"),
            ' (',
            address(token) == address(0) ? "ETH" : _stringValue(address(token), "symbol()", "SYMBOL()"),
            '), having decimals ',
            tokenDecimals.toString(),
            '.\n\n',
            'For more info, visit ',
            externalURL,
            '.'
        ));
    }

    function _getTrustWalletImage(address tokenAddress) private pure returns (string memory) {
        if(tokenAddress == address(0)) {
            return string(
                abi.encodePacked(
                    'data:image/svg+xml;base64,',
                    Base64.encode(
                        bytes(
                            '<svg xmlns="http://www.w3.org/2000/svg" width="2500" height="2500" viewBox="0 0 32 32"><g fill="none" fill-rule="evenodd"><circle cx="16" cy="16" r="16" fill="#627EEA"/><g fill="#FFF" fill-rule="nonzero"><path fill-opacity=".602" d="M16.498 4v8.87l7.497 3.35z"/><path d="M16.498 4L9 16.22l7.498-3.35z"/><path fill-opacity=".602" d="M16.498 21.968v6.027L24 17.616z"/><path d="M16.498 27.995v-6.028L9 17.616z"/><path fill-opacity=".2" d="M16.498 20.573l7.497-4.353-7.497-3.348z"/><path fill-opacity=".602" d="M9 16.22l7.498 4.353v-7.701z"/></g></g></svg>'
                        )
                    )
                )
            );
        }
        return string(abi.encodePacked(
            'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/',
            tokenAddress.toString(),
            '/logo.png'
        ));
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