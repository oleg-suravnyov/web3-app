#!/bin/bash
truffle-flattener contracts/utils/Stakes.sol > ./verifications/contracts/Stakes.sol
truffle-flattener contracts/Staker.sol > ./verifications/contracts/Staker.sol
truffle-flattener contracts/Web3AppERC20.sol > ./verifications/contracts/Web3AppERC20.sol
truffle-flattener contracts/Web3AppERC721.sol > ./verifications/contracts/Web3AppERC721.sol
