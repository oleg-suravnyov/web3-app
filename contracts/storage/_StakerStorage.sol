// SPDX-License-Identifier: MIT

pragma solidity ^0.8.16;

contract _StakerStorage {
    bytes32 internal constant STAKER_STORAGE_POSITION =
        keccak256("contracts.stakerstorage");

    struct StakerStorage {
        mapping(address => Stake[]) stakes;
        uint256 yieldBase;
        uint256 fee;
        address erc721;
        address erc20;
    }

    struct Stake {
        uint256 start;
        uint256[] stakables;
    }

    function stakerStorage()
        internal
        pure
        returns (StakerStorage storage _storage)
    {
        bytes32 position = STAKER_STORAGE_POSITION;
        assembly {
            _storage.slot := position
        }
    }
}
