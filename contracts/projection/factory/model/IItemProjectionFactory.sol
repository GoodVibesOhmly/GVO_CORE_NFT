//SPDX-License-Identifier: MIT

pragma solidity >=0.7.0;
pragma abicoder v2;

import "@ethereansos/swissknife/contracts/factory/impl/Factory.sol";

interface IItemProjectionFactory is IFactory {

    function mainInterface() external view returns(address);
}