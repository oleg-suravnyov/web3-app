// SPDX-License-Identifier: MIT

pragma solidity ^0.8.16;

import "./storage/_StakerStorage.sol";
import "./Web3AppERC721.sol";
import "./abstract/_Delegator.sol";
import "./utils/Stakes.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract Staker is
    IERC721Receiver,
    AccessControl,
    Pausable,
    _Delegator,
    _StakerStorage
{
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    uint256 public constant DENOMINATOR = 10000;

    constructor(
        address erc721,
        address erc20,
        uint256 yieldBase,
        uint256 fee
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);

        StakerStorage storage _storage = stakerStorage();
        _storage.erc721 = erc721;
        _storage.erc20 = erc20;
        _storage.yieldBase = yieldBase;
        _storage.fee = fee;
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes memory
    ) public virtual override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function stake(uint256[] calldata stakables) external whenNotPaused {
        StakerStorage storage _storage = stakerStorage();

        bool ownerForAll = Web3AppERC721(_storage.erc721).ownerForAll(
            msg.sender,
            stakables
        );
        require(ownerForAll == true, "Incorrect owner.");

        IERC721 stakable = IERC721(_storage.erc721);
        bool allApproved = stakable.isApprovedForAll(msg.sender, address(this));
        for (uint256 i = 0; i < stakables.length; i++) {
            if (!allApproved) {
                address approved = stakable.getApproved(stakables[i]);
                require(approved == address(this), "Stakable is not approved.");
            }
            stakable.safeTransferFrom(msg.sender, address(this), stakables[i]);
        }

        _storage.stakes[msg.sender].push(Stake(block.timestamp, stakables));
    }

    function getStake(address owner, uint256 stakeId)
        external
        view
        returns (uint256, uint256[] memory)
    {
        StakerStorage storage _storage = stakerStorage();
        Stake memory _stake = _storage.stakes[owner][stakeId];
        return (_stake.start, _stake.stakables);
    }

    function getStakesSize(address owner) external view returns (uint256) {
        StakerStorage storage _storage = stakerStorage();
        return _storage.stakes[owner].length;
    }

    function estimate(address owner, uint256 stakeId)
        external
        view
        returns (uint256)
    {
        return Stakes.estimate(owner, stakeId);
    }

    function yieldAll() external {
        StakerStorage storage _storage = stakerStorage();
        Stake[] memory stakes = _storage.stakes[msg.sender];
        for (uint256 _stake = 0; _stake < stakes.length; _stake++) {
            if (stakes[_stake].stakables.length > 0) {
                _yield(_stake);
            }
        }
    }

    function yield(uint256 stakeId) external {
        StakerStorage storage _storage = stakerStorage();
        Stake storage _stake = _storage.stakes[msg.sender][stakeId];
        require(block.timestamp > _stake.start, "Nothing to yield.");
        _yield(stakeId);
    }

    function withdraw(
        uint256 stakeId,
        uint256[] calldata stakableIndex,
        bool andYield
    ) external {
        StakerStorage storage _storage = stakerStorage();
        Stake storage _stake = _storage.stakes[msg.sender][stakeId];
        if (andYield && block.timestamp > _stake.start) {
            _yield(stakeId);
        }
        _withdraw(stakeId, stakableIndex);
    }

    function withdrawAll(bool andYield) external {
        StakerStorage storage _storage = stakerStorage();
        Stake[] memory stakes = _storage.stakes[msg.sender];
        for (uint256 _stake = 0; _stake < stakes.length; _stake++) {
            if (stakes[_stake].stakables.length > 0) {
                if (andYield) {
                    _yield(0);
                }
                _withdraw(0, stakes[_stake].stakables);
            }
        }
    }

    function setYieldBase(uint256 yieldBase)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        StakerStorage storage _storage = stakerStorage();
        _storage.yieldBase = yieldBase;
    }

    function getYieldBase() external view returns (uint256) {
        StakerStorage storage _storage = stakerStorage();
        return _storage.yieldBase;
    }

    function setErc721(address erc721) external onlyRole(DEFAULT_ADMIN_ROLE) {
        StakerStorage storage _storage = stakerStorage();
        _storage.erc721 = erc721;
    }

    function getErc721() external view returns (address) {
        StakerStorage storage _storage = stakerStorage();
        return _storage.erc721;
    }

    function setErc20(address erc20) external onlyRole(DEFAULT_ADMIN_ROLE) {
        StakerStorage storage _storage = stakerStorage();
        _storage.erc20 = erc20;
    }

    function getErc20() external view returns (address) {
        StakerStorage storage _storage = stakerStorage();
        return _storage.erc20;
    }

    function setFee(uint256 fee) external onlyRole(DEFAULT_ADMIN_ROLE) {
        StakerStorage storage _storage = stakerStorage();
        _storage.fee = fee;
    }

    function getFee() external view returns (uint256) {
        StakerStorage storage _storage = stakerStorage();
        return _storage.fee;
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function addDelegate(
        address delegate,
        string calldata method,
        bytes memory args
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _addDelegate(delegate, method, args);
    }

    function setDelegate(
        address delegate,
        uint256 methodId,
        string calldata method,
        bytes memory args
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setDelegate(delegate, methodId, method, args);
    }

    function deleteDelegate(address delegate)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _deleteDelegate(delegate);
    }

    function _yield(uint256 stakeId) private whenNotPaused {
        Stakes.yield(msg.sender, stakeId);
    }

    function _withdraw(uint256 stakeId, uint256[] memory stakableIndex)
        private
    {
        Stakes.withdraw(msg.sender, stakeId, stakableIndex);
    }
}
