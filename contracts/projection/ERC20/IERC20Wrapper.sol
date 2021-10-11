//SPDX-License-Identifier: MIT

pragma solidity >=0.7.0;
pragma abicoder v2;

import "../IItemProjection.sol";

interface IERC20Wrapper is IItemProjection {

    event Token(address indexed tokenAddress, uint256 indexed itemId);

    function itemIdOf(address tokenAddress) external view returns(uint256);

    function mintItemsWithPermit(CreateItem[] calldata, bytes[] memory permitData) external payable returns(uint256[] memory);
}