// SPDX-License-Identifier: MIT

pragma solidity ^0.8.16;

import "../Staker.sol";
import "../Web3AppERC721.sol";

contract StakerFacade is _StakerStorage {
    Staker private _staker;
    Web3AppERC721 private _erc721;


    constructor(address staker, address erc721) {
        _staker = Staker(staker);
        _erc721 = Web3AppERC721(erc721);
    }

    function getStakesDelegate(address owner)
        external
        view
        returns (uint256[] memory start, uint256[][] memory stakables)
    {
        StakerStorage storage _storage = stakerStorage();
        Stake[] memory stakes = _storage.stakes[owner];

        start = new uint256[](stakes.length);
        stakables = new uint[][](stakes.length);

        for (uint256 stake = 0; stake < stakes.length; stake++) {
            start[stake] = stakes[stake].start;
            stakables[stake] = stakes[stake].stakables;
        }
    }

    function getStakes(address owner)
        external
        returns (uint256[] memory start, uint256[][] memory stakables, string[][] memory uri)
    {
        (start, stakables) = 
            abi.decode(
                _staker.delegateCall(
                    address(this),
                    0,
                    abi.encode(owner)
                ),
                (uint256[], uint256[][])
            );

        uri = new string[][](stakables.length);
        for (uint256 stake = 0; stake < stakables.length; stake++) {
            uri[stake] = new string[](stakables[stake].length);
            for (uint256 stakable = 0; stakable < stakables[stake].length; stakable++) {
                uri[stake][stakable] = _erc721.tokenURI(stakables[stake][stakable]);
            }
        }

    }
}
