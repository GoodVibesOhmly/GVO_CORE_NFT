//SPDX-License-Identifier: MIT

pragma solidity >=0.7.0;
pragma abicoder v2;

import "@ethereansos/swissknife/contracts/factory/impl/Factory.sol";

contract ItemProjectionFactory is Factory {
    using ReflectionUtilities for address;

    address public mainInterface;

    constructor(bytes memory lazyInitData) Factory(lazyInitData) {
    }

    function _factoryLazyInit(bytes memory lazyInitData) internal override returns(bytes memory) {
        mainInterface = abi.decode(lazyInitData, (address));
        return "";
    }

    function deploy(bytes calldata deployData) external payable override virtual returns(address deployedAddress, bytes memory deployedLazyInitResponse) {
        deployer[deployedAddress = modelAddress.clone()] = msg.sender;
        emit Deployed(modelAddress, deployedAddress, msg.sender, deployedLazyInitResponse = ILazyInitCapableElement(deployedAddress).lazyInit(abi.encode(mainInterface, deployData)));
        require(ILazyInitCapableElement(deployedAddress).initializer() == address(this));
    }

    function _subjectIsAuthorizedFor(address, address, bytes4 selector, bytes calldata, uint256) internal override pure returns (bool, bool) {
        if(selector == this.setModelAddress.selector || selector == this.setDynamicUriResolver.selector) {
            return (true, false);
        }
        return (false, false);
    }
}