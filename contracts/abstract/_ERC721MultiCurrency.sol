// SPDX-License-Identifier: MIT

pragma solidity ^0.8.16;

import "./_ERC721.sol";
import "./_ERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract _ERC721MultiCurrency is _ERC721 {
    uint256 public constant DEFAULT_CURRENCY = 0;
    Currency[] private _currencies;
    address private _feeAccount;

    constructor(
        string memory name,
        string memory symbol,
        address feeAccount
    ) _ERC721(name, symbol, feeAccount) {
        _feeAccount = feeAccount;
    }

    function getCurrency(uint256 id)
        public
        view
        returns (
            string memory,
            uint256,
            address,
            bool
        )
    {
        Currency memory currency = _currencies[id];
        return (currency.name, currency.price, currency.erc20, currency.burn);
    }

    function addCurrency(
        string memory name,
        uint256 price,
        address erc20,
        bool burn
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _currencies.push(Currency(name, price, erc20, burn));
    }

    function withdraw() external onlyRole(DEFAULT_ADMIN_ROLE) {
        Address.sendValue(payable(_feeAccount), address(this).balance);
    }

    function setFeeAccount(address feeAccount)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _feeAccount = feeAccount;
    }

    function getFeeAccount() external view returns (address) {
        return _feeAccount;
    }

    function setCurrency(
        uint256 id,
        string calldata name,
        uint256 price,
        address erc20,
        bool burn
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _currencies[id] = Currency(name, price, erc20, burn);
    }

    function deleteCurrency(uint256 id) external onlyRole(DEFAULT_ADMIN_ROLE) {
        delete _currencies[id];
    }

    function _buy(uint256 currencyId, uint256 price) internal {
        if (currencyId == DEFAULT_CURRENCY) {
            require(msg.value == price, "Incorrect value sent.");
        } else {
            Currency memory c = _currencies[currencyId];
            require(c.erc20 != address(0), "Incorrect currency address");
            _ERC20 erc20 = _ERC20(c.erc20);
            require(erc20.balanceOf(msg.sender) >= price, "Not enough value");
            if (c.burn) {
                erc20.transferFrom(msg.sender, address(this), price);
                erc20.burn(price);
            } else {
                erc20.transferFrom(msg.sender, _feeAccount, price);
            }
        }
    }

    struct Currency {
        string name;
        uint256 price;
        address erc20;
        bool burn;
    }
}
