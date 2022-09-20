// SPDX-License-Identifier: MIT

pragma solidity ^0.8.16;

import "./abstract/_ERC721MultiCurrency.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract Web3AppERC721 is _ERC721MultiCurrency {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;
    string[] private _images;

    constructor(
        address feeAccount,
        uint256 price,
        string[] memory images
    ) _ERC721MultiCurrency("Web3 App NFT", "W3N", feeAccount) {
        _images = images;
        addCurrency("ETH", price, address(0), false);
    }

    function setImages(string[] memory images, bool rewrite)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (rewrite) {
            _images = images;
        } else {
            for (uint256 i = 0; i < images.length; i++) {
                _images[i] = images[i];
            }
        }
    }

    function getImages() external view returns (string[] memory) {
        return _images;
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        require(_exists(tokenId), "Non-existent token");
        return
            string(
                abi.encodePacked(
                    "data:application/json;base64,",
                    Base64.encode(
                        abi.encodePacked(
                            "{",
                            '"name" : "Web3 App Token ',
                            " #",
                            Strings.toString(tokenId),
                            '",',
                            '"image" : "',
                            tokenId >= _images.length
                                ? _images[0]
                                : _images[tokenId],
                            '"',
                            "}"
                        )
                    )
                )
            );
    }

    function mint(uint256 currencyId) external payable whenNotPaused {
        _buy(currencyId, _calculatePrice(currencyId));
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(msg.sender, tokenId);
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

    function _calculatePrice(uint256 currencyId)
        private
        view
        returns (uint256 price)
    {
        (, price, , ) = _ERC721MultiCurrency.getCurrency(currencyId);
    }
}
