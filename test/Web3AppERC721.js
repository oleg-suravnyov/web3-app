const Web3AppERC721 = artifacts.require("Web3AppERC721");
const ERC20Minter = artifacts.require("ERC20Minter");
const chai = require("chai");
const assert = require("chai").assert;
const truffleAssert = require("truffle-assertions");
const chaiJsonSchema = require("chai-json-schema");
chai.use(chaiJsonSchema);

contract("Web3AppERC721", (accounts) => {
  let erc721;
  let erc20;
  let admin;
  let player;
  let feeAccount;
  let price;
  const images = ["ipfs.cid"];
  const currencyId = 0;

  beforeEach(async () => {
    admin = accounts[0];
    player = accounts[1];
    feeAccount = accounts[2];
    price = 1000000000000;

    gas = await Web3AppERC721.new.estimateGas(feeAccount, price, images);
    console.log("[Web3AppERC721.constructor]", "Gas", gas);

    erc721 = await Web3AppERC721.new(feeAccount, price, images);

    erc20 = await ERC20Minter.new();
  });

  it("As a player I want to mint a nft", async () => {
    await truffleAssert.reverts(
      erc721.mint(currencyId, {
        from: player,
        value: 0,
      }),
      "Incorrect value sent."
    );
    const result = await erc721.mint(currencyId, {
      from: player,
      value: price,
    });
    console.log("[Web3AppERC721.mint]", "Gas", result.receipt.gasUsed);

    const balance = await erc721.balanceOf(player);
    assert(balance == 1);
  });

  context("Player has a nft", async () => {
    const playerNft = 0;

    beforeEach(async () => {
      await erc721.mint(currencyId, { from: player, value: price });

      const balance = await erc721.balanceOf(player);
      assert(balance == 1);
    });

    it("As a system I want to get a nft URI Json in compliance with ERC721 standard", async () => {
      const jsonSchema = {
        title: "ERC721 opensea schema",
        type: "object",
        required: ["name", "image"],
        properties: {
          name: {
            type: "string",
          },
          image: {
            type: "string",
          },
        },
      };

      const raw = await erc721.tokenURI(playerNft);
      assert(raw.includes("data:application/json;base64,"));

      const base64 = raw.substr(
        raw.lastIndexOf("data:application/json;base64,") +
          "data:application/json;base64,".length
      );
      const json = Buffer.from(base64, "base64").toString();
      const obj = JSON.parse(json);
      assert.isObject(obj, "Token JSON is " + JSON.stringify(json));
      assert.jsonSchema(obj, jsonSchema);
    });

    it("As a system I want to get an error while retreiving URI for non-existing nft", async () => {
      await erc721.burn(playerNft, { from: player });
      await truffleAssert.reverts(erc721.tokenURI(playerNft));
    });

    it("being in admin role I want to be the only allowed to change financial parameters", async () => {
      await truffleAssert.reverts(
        erc721.addCurrency("0", 0, player, false, {
          from: player,
        })
      );
      await truffleAssert.reverts(
        erc721.setCurrency(0, "0", 0, player, false, {
          from: player,
        })
      );
      await truffleAssert.reverts(
        erc721.deleteCurrency(0, {
          from: player,
        })
      );
      await truffleAssert.reverts(
        erc721.setFeeAccount(player, {
          from: player,
        })
      );
      await truffleAssert.reverts(
        erc721.setRoyaltyReceiver(player, {
          from: player,
        })
      );

      await erc721.setFeeAccount(player);
      updated = await erc721.getFeeAccount();
      assert(
        updated == player,
        "[Expected] fee account is " +
          player +
          " [Actual] fee account is " +
          updated
      );

      // Royalty
      const salePrice = 1000000000000000000n;
      const expectedRoylty = (salePrice * 5n) / 100n;
      const royaltyInfo = await erc721.royaltyInfo(playerNft, salePrice, {
        from: player,
      });
      assert(
        royaltyInfo[0] == feeAccount,
        "[Expected] royalty account is " +
          feeAccount +
          " [Actual] royalty account is " +
          royaltyInfo[0]
      );
      assert(
        royaltyInfo[1] == expectedRoylty,
        "[Exptected] roylty fee is " +
          expectedRoylty +
          " [Actual] royalty fee is " +
          royaltyInfo[1]
      );
    });
  });

  it("As an admin I want to burn currency from the contract", async () => {
    await erc721.addCurrency("ERC20", price, erc20.address, true);

    const before = [0n, 0n];
    before[0] = await erc20.balanceOf(player);
    before[1] = await erc20.balanceOf(feeAccount);

    await erc20.mint(player, price);
    await erc20.approve(erc721.address, price, {
      from: player,
    });

    const result = await erc721.mint(1, {
      from: player,
    });
    console.log(
      "[Web3AppERC721.mintWithCurrency]",
      "Gas",
      result.receipt.gasUsed
    );

    const after = [0n, 0n];
    after[0] = await erc20.balanceOf(player);
    after[1] = await erc20.balanceOf(feeAccount);

    assert(
      BigInt(after[0]) == BigInt(before[0]),
      "[Expected] " +
        " player balance is 0 [Actual]" +
        " player balance is " +
        after[0]
    );
    assert(
      BigInt(before[1]) == BigInt(after[1]),
      "[Expected] " +
        " fee balance is 0 [Actual]" +
        " fee balance is " +
        after[1]
    );
  });

  it("As an admin I want to withdraw value from the contract", async () => {
    await truffleAssert.reverts(
      erc721.withdraw({
        from: player,
      })
    );

    await erc721.addCurrency("ERC20", price, erc20.address, false);

    const before = [0n, 0n];
    before[0] = await web3.eth.getBalance(feeAccount);
    before[1] = await erc20.balanceOf(feeAccount);

    await erc721.mint(0, {
      from: player,
      value: price,
    });

    await erc20.mint(player, price);
    await erc20.approve(erc721.address, price, {
      from: player,
    });
    await erc721.mint(1, {
      from: player,
    });

    await erc721.withdraw();
    const after = [0n, 0n];
    after[0] = await web3.eth.getBalance(feeAccount);
    after[1] = await erc20.balanceOf(feeAccount);
    assert(
      BigInt(after[0]) - BigInt(before[0]) == BigInt(price),
      "[Expected] ETH balance is " +
        (before[0] + BigInt(price)) +
        " [Actual] ETH balance is " +
        after[0]
    );
    assert(
      BigInt(after[1]) - BigInt(before[1]) == BigInt(price),
      "[Expected] " +
        " erc20 balance is " +
        (before[1] + BigInt(price)) +
        " [Actual]" +
        " erc20 balance is " +
        after[1]
    );
  });

  it("Being in admin role I want to be the only allowed to pause or un-pause the contract", async () => {
    const admin = player;
    const adminRole = await erc721.DEFAULT_ADMIN_ROLE();
    await erc721.grantRole(adminRole, admin);
    const pauserRole = await erc721.PAUSER_ROLE();
    await erc721.grantRole(pauserRole, admin, {
      from: admin,
    });

    await erc721.pause({ from: admin });

    await truffleAssert.reverts(
      erc721.mint(currencyId, {
        from: player,
        value: price,
      })
    );

    await erc721.unpause({ from: admin });
    await erc721.mint(currencyId, {
      from: player,
      value: price,
    });
  });
});
