// SPDX-License-Identifier: MIT

pragma solidity ^0.8.16;

import "../storage/_StakerStorage.sol";
import "../abstract/_ERC721.sol";
import "../Web3AppERC20.sol";

library Stakes {
    bytes32 private constant STAKER_STORAGE_POSITION =
        keccak256("contracts.stakerstorage");
    uint256 public constant DENOMINATOR = 10000;

    function estimate(address owner, uint256 stakeId)
        external
        view
        returns (uint256)
    {
        _StakerStorage.StakerStorage storage _storage = _stakerStorage();
        _StakerStorage.Stake storage _stake = _storage.stakes[owner][stakeId];
        if (block.timestamp <= _stake.start) {
            return 0;
        }
        uint256 duration = (block.timestamp - _stake.start);
        uint256 amount = (duration *
            _stake.stakables.length *
            _storage.yieldBase) / DENOMINATOR;
        uint256 fee = 0;
        if (_storage.fee > 0) {
            fee = (amount * _storage.fee) / DENOMINATOR;
        }
        return amount - fee;
    }

    function yield(address owner, uint256 stakeId) external {
        _StakerStorage.StakerStorage storage _storage = _stakerStorage();
        _StakerStorage.Stake storage _stake = _storage.stakes[owner][stakeId];
        uint256 size = _stake.stakables.length;
        if (block.timestamp > _stake.start && size > 0) {
            uint256 duration = (block.timestamp - _stake.start);
            _stake.start = block.timestamp;
            Web3AppERC20(_storage.erc20).mint(
                owner,
                (duration * size * _storage.yieldBase) / DENOMINATOR,
                _storage.fee
            );
        }
    }

    function withdraw(
        address owner,
        uint256 stakeId,
        uint256[] memory stakableIndex
    ) external {
        _StakerStorage.StakerStorage storage _storage = _stakerStorage();
        _StakerStorage.Stake[] storage _stakes = _storage.stakes[owner];

        require(stakeId < _stakes.length && stakeId >= 0, "Incorrect stakeId.");

        uint256[] memory stakables = _stakes[stakeId].stakables;
        uint256[] storage _stakables = _stakes[stakeId].stakables;

        require(
            stakableIndex.length <= stakables.length &&
                stakableIndex.length > 0,
            "Incorrect stakableIndex length."
        );

        _ERC721 stakable = _ERC721(_storage.erc721);
        if (stakableIndex.length == stakables.length) {
            _stakes[stakeId] = _stakes[_stakes.length - 1];
            _stakes.pop();
            for (uint256 i = 0; i < stakables.length; i++) {
                if (address(0) == owner) {
                    stakable.burn(stakables[i]);
                } else {
                    stakable.transferFrom(address(this), owner, stakables[i]);
                }
            }
        } else {
            uint256[] memory shift = new uint256[](stakables.length);
            for (uint256 i = 0; i < stakableIndex.length; i++) {
                uint256 replace = stakableIndex[i];
                if (stakableIndex[i] > _stakables.length - 1) {
                    replace = shift[stakableIndex[i]];
                }
                shift[_stakables.length - 1] = replace;
                _stakables[replace] = _stakables[_stakables.length - 1];
                _stakables.pop();

                uint256 id = stakables[stakableIndex[i]];
                if (address(0) == owner) {
                    stakable.burn(id);
                } else {
                    stakable.transferFrom(address(this), owner, id);
                }
            }
        }
    }

    function _stakerStorage()
        private
        pure
        returns (_StakerStorage.StakerStorage storage _storage)
    {
        bytes32 position = STAKER_STORAGE_POSITION;
        assembly {
            _storage.slot := position
        }
    }
}
