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
        string memory etherscanTokenURL = _getEtherscanTokenURL(address(token));
        return string(abi.encodePacked(
            'data:application/json;base64,',
            Base64.encode(
                abi.encodePacked(
                    '{"name":"',
                    wrapper.name(itemId),
                    '","symbol":"',
                    wrapper.symbol(itemId),
                    '","decimals":',
                    wrapper.decimals(itemId),
                    ',"external_url":"',
                    etherscanTokenURL,
                    '","description":"',
                    _getDescription(token, etherscanTokenURL),
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
            chainId,
            'etherscan.io/token/',
            tokenAddress.toString()
        ));
    }

    function _getDescription(IERC20Metadata token, string memory etherscanTokenURL) private view returns (string memory) {
        uint256 tokenDecimals = token.decimals();
        return string(abi.encodePacked(
            'This Item wraps the original ERC20 Token ',
            token.name(),
            ' (',
            token.symbol(),
            '), having decimals ',
            tokenDecimals.toString(),
            '.\n\n',
            'For more info, visit ',
            etherscanTokenURL,
            '.'
        ));
    }

    function _getTrustWalletImage(address tokenAddress) private pure returns (string memory) {
        return string(abi.encodePacked(
            'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/',
            tokenAddress.toString(),
            '/logo.png'
        ));
    }
}