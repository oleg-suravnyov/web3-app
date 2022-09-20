// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../abstract/_ERC20.sol";

contract ERC20Minter is _ERC20 {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor() _ERC20("ERC20 Minter", "ERC20") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
