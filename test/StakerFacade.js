const Staker = artifacts.require("Staker");
const Web3AppERC721 = artifacts.require("Web3AppERC721");
const Web3AppERC20 = artifacts.require("Web3AppERC20");
const StakerFacade = artifacts.require("StakerFacade");
const Stakes = artifacts.require("Stakes");
const { assert } = require("chai");
const truffleAssert = require("truffle-assertions");

contract("StakerFacade", (accounts) => {
  let facade;
  let erc721;
  let erc20;
  let staker;
  let player;
  let admin;
  let feeAccount;
  let price;
  let yieldBase;
  let fee;
  const erc721Of = { player: [0, 1] };

  beforeEach(async () => {
    admin = accounts[0];
    player = accounts[1];
    feeAccount = accounts[2];
    price = 1000000000000;
    yieldBase = 1000000000000;
    fee = 500;

    const stakes = await Stakes.new();
    Staker.link("Stakes", stakes.address);

    erc721 = await Web3AppERC721.new(feeAccount, price, ["ipfs.cid"]);
    erc20 = await Web3AppERC20.new(feeAccount);
    staker = await Staker.new(erc721.address, erc20.address, yieldBase, fee);

    await erc721.mint(0, { from: player, value: price });
    await erc721.mint(0, { from: player, value: price });

    const playerBalance = await erc721.balanceOf(player);
    assert(playerBalance == 2);

    await erc721.setApprovalForAll(staker.address, true, { from: player });

    const minterRole = await erc20.MINTER_ROLE();
    await erc20.grantRole(minterRole, staker.address);

    const gas = await StakerFacade.new.estimateGas(
      staker.address,
      erc721.address
    );
    console.log("[StakerFacade.constructor]", "Gas", gas);

    facade = await StakerFacade.new(staker.address, erc721.address);

    await staker.addDelegate(
      facade.address,
      "getStakesDelegate(address)",
      web3.eth.abi.encodeParameter("address", player)
    );
  });

  it("As a system I want to get accumulated stakes info", async () => {
    await staker.stake(erc721Of.player, {
      from: player,
    });

    const stake = await staker.getStake(player, 0);
    assert(stake[1].length == erc721Of.player.length);

    const stakes = await facade.getStakes.call(player);
    console.log(stakes);
    assert(
      stakes[0].length == 1 &&
        stakes[1][0].length == erc721Of.player.length &&
        stakes[2][0].length == erc721Of.player.length
    );
  });
});
