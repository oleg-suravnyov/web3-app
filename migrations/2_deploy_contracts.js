const Web3AppERC20 = artifacts.require("Web3AppERC20");
const Web3AppERC721 = artifacts.require("Web3AppERC721");
const Stakes = artifacts.require("Stakes");
const Staker = artifacts.require("Staker");

module.exports = async function (deployer, network, accounts) {
  if (network == "test") {
    const feeAccount = accounts[0];
    const price = 1000000000000;
    const yieldBase = 1000000000000;
    const fee = 500;

    await deployer.deploy(Stakes);
    const stakes = await Stakes.at(Stakes.address);
    Staker.link("Stakes", stakes.address);

    await deployer.deploy(Web3AppERC721, feeAccount, price, ["ipfs.cid"]);
    erc721 = await Web3AppERC721.at(Web3AppERC721.address);

    await deployer.deploy(Web3AppERC20, feeAccount);
    erc20 = await Web3AppERC20.at(Web3AppERC20.address);

    await deployer.deploy(
      Staker,
      erc721.address,
      erc20.address,
      yieldBase,
      fee
    );
    staker = await Staker.at(Staker.address);

    const minterRole = await erc20.MINTER_ROLE();
    await erc20.grantRole(minterRole, staker.address);
  }
};
