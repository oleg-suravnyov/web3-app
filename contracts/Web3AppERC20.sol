// SPDX-License-Identifier: MIT

pragma solidity ^0.8.16;

import "./abstract/_ERC20.sol";

contract Web3AppERC20 is _ERC20 {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint256 public constant DENOMINATOR = 10000;
    address private _feeReceiver;

    constructor(address feeReceiver) _ERC20("Web3 App Token", "W3T") {
        _feeReceiver = feeReceiver;
    }

    function mint(
        address to,
        uint256 amount,
        uint256 fee
    ) external onlyRole(MINTER_ROLE) {
        uint256 _fee = 0;
        if (fee > 0) {
            _fee = (amount * fee) / DENOMINATOR;
            _mint(_feeReceiver, _fee);
        }
        _mint(to, amount - _fee);
    }

    function setFeeReceiver(address feeReceiver)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _feeReceiver = feeReceiver;
    }

    function getFeeReceiver() external view returns (address) {
        return _feeReceiver;
    }
}
