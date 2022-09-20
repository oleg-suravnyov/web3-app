// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "../abstract/_ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract ERC721Minter is _ERC721 {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;

    constructor() _ERC721("ERC721 Minter", "ERC721", address(1)) {}

    function safeMint(address to) public {
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(to, tokenId);
    }

    function ownerForAll(address owner, uint256[] calldata tokenId)
        external
        view
        returns (bool)
    {
        for (uint256 i = 0; i < tokenId.length; i++) {
            if (owner != ownerOf(tokenId[i])) {
                return false;
            }
        }
        return true;
    }
}
