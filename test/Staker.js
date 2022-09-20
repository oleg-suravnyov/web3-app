const Staker = artifacts.require("Staker");
const ERC721Minter = artifacts.require("ERC721Minter");
const Web3AppERC20 = artifacts.require("Web3AppERC20");
const Stakes = artifacts.require("Stakes");
const { assert } = require("chai");
const truffleAssert = require("truffle-assertions");

contract("Staker", (accounts) => {
  let staker;
  let erc20;
  let erc721;
  let gas;
  let player;
  let admin;
  let feeAccount;
  let yieldBase;
  let fee;
  const erc721Of = { admin: [0], player: [1, 2, 3] };

  beforeEach(async () => {
    admin = accounts[0];
    player = accounts[1];
    feeAccount = accounts[2];
    yieldBase = 1000000000000;
    fee = 500;

    const stakes = await Stakes.new();
    Staker.link("Stakes", stakes.address);

    erc721 = await ERC721Minter.new();
    erc20 = await Web3AppERC20.new(feeAccount);

    gas = await Staker.new.estimateGas(
      erc721.address,
      erc20.address,
      yieldBase,
      fee
    );
    console.log("[Staker.constructor]", "Gas", gas);
    staker = await Staker.new(erc721.address, erc20.address, yieldBase, fee);

    await erc721.safeMint(admin);
    await erc721.safeMint(player);
    await erc721.safeMint(player);
    await erc721.safeMint(player);

    const adminBalance = await erc721.balanceOf(admin);
    const playerBalance = await erc721.balanceOf(player);
    assert(adminBalance == 1 && playerBalance == 3);

    await erc721.setApprovalForAll(staker.address, true, { from: player });

    const minterRole = await erc20.MINTER_ROLE();
    await erc20.grantRole(minterRole, staker.address);
  });

  it("As a player I want to stake my ERC721 asset", async () => {
    // 1. Fail to stake with incorrect owner
    await truffleAssert.reverts(staker.stake(erc721Of.admin, { from: player }));

    // 2. Success
    const result = await staker.stake(erc721Of.player, {
      from: player,
    });
    console.log("[Staker.stake]", "Gas", result.receipt.gasUsed);

    const stake = await staker.getStake(player, 0);
    assert(stake[1].length == erc721Of.player.length);
  });

  context("Player has a stake", async () => {
    const stakeId = 0;

    beforeEach(async () => {
      await staker.stake(erc721Of.player, {
        from: player,
      });

      const stakesSize = await staker.getStakesSize(player);
      assert(stakesSize == 1);
    });

    it("As a player I want to yield from my stake", async () => {
      const balance = {
        player: { before: 0, after: 0 },
        fee: { before: 0, after: 0 },
      };
      balance.player.before = await erc20.balanceOf(player);
      balance.fee.before = await erc20.balanceOf(feeAccount);
      assert(balance.player.before == 0 && balance.fee.before == 0);

      const duration = 86400;
      await advanceTime(Number(duration));

      // Making a transaction to commit time step
      await erc721.setApprovalForAll(staker.address, true, { from: player });

      const timestamp = { before: 0, after: 0 };
      let stake = await staker.getStake(player, stakeId);
      timestamp.before = stake[0];

      const estimate = await staker.estimate(player, stakeId);

      result = await staker.yield(stakeId, {
        from: player,
      });
      console.log("[Staker.yield]", "Gas", result.receipt.gasUsed);
      balance.player.after = await erc20.balanceOf(player);
      balance.fee.after = await erc20.balanceOf(feeAccount);

      const expected = { player: 0, fee: 0 };
      const denominator = await staker.DENOMINATOR();

      const total =
        (BigInt(duration) * BigInt(yieldBase) * BigInt(stake[1].length)) /
        BigInt(denominator);

      expected.fee = (total * BigInt(fee)) / BigInt(denominator);
      expected.player = total - expected.fee;

      assert(
        estimate <= total - expected.fee,
        "[Expected] total is " +
          (total - expected.fee) +
          " [Actual] total is " +
          estimate
      );

      assert(
        expected.player >= balance.player.after,
        "[Expected] player balance is " +
          expected.player +
          " [Actual] player balance is " +
          balance.player.after
      );
      assert(
        expected.fee == balance.fee.after,
        "[Expected] fee balance is " +
          expected.fee +
          " [Actual] fee balance is " +
          balance.fee.after
      );

      stake = await staker.getStake(player, stakeId);
      timestamp.after = stake[0];

      assert(timestamp.after - timestamp.before == duration);
    });

    it("As a player I want to withdraw from my stake", async () => {
      const toWithdraw = [0, 2];
      for (const index of toWithdraw) {
        const owner = await erc721.ownerOf(erc721Of.player[index]);
        assert(owner == staker.address);
      }

      result = await staker.withdraw(stakeId, toWithdraw, false, {
        from: player,
      });
      console.log("[Staker.withdraw]", "Gas", result.receipt.gasUsed);

      for (const index of toWithdraw) {
        const owner = await erc721.ownerOf(erc721Of.player[index]);
        assert(
          owner == player,
          "[Expected] owner is " + player + " [Actual] owner is " + owner
        );
      }
    });

    it("As a player I want to yield and withdraw from my stake", async () => {
      const balance = { erc721: {}, erc20: {} };
      balance.erc721.before = await erc721.balanceOf(player);
      balance.erc20.before = await erc20.balanceOf(player);

      const duration = 86400;
      await advanceTime(Number(duration));

      // Making a transaction to commit time step
      await erc721.setApprovalForAll(staker.address, true, { from: player });

      result = await staker.withdraw(stakeId, erc721Of.player, true, {
        from: player,
      });
      console.log("[Staker.yieldAndWithdraw]", "Gas", result.receipt.gasUsed);

      balance.erc721.after = await erc721.balanceOf(player);
      balance.erc20.after = await erc20.balanceOf(player);

      assert(
        balance.erc721.after > balance.erc721.before &&
          balance.erc20.after > balance.erc20.before
      );
    });
  });

  context("Player has stakes", async () => {
    let stakes;

    beforeEach(async () => {
      stakes = [];

      for (let i = 0; i < erc721Of.player.length; i++) {
        await staker.stake([erc721Of.player[i]], {
          from: player,
        });
        stakes.push(i);
      }

      const stakesSize = await staker.getStakesSize(player);
      assert(
        stakesSize == erc721Of.player.length && stakes.length == stakesSize
      );
    });

    it("As a player I want to yield from all my stakes", async () => {
      const balance = {
        player: { before: 0, after: 0 },
        fee: { before: 0, after: 0 },
      };
      balance.player.before = await erc20.balanceOf(player);
      balance.fee.before = await erc20.balanceOf(feeAccount);
      assert(balance.player.before == 0 && balance.fee.before == 0);

      const duration = 86400;
      await advanceTime(Number(duration));

      // Making a transaction to commit time step
      await erc721.setApprovalForAll(staker.address, true, { from: player });

      const timestamp = { before: [], after: [] };
      const estimate = [];
      for (const id of stakes) {
        const stake = await staker.getStake(player, id);
        timestamp.before.push(stake[0]);

        estimate.push(await staker.estimate.call(player, id));
      }

      result = await staker.yieldAll({
        from: player,
      });
      console.log("[Staker.yieldAll]", "Gas", result.receipt.gasUsed);
      balance.player.after = await erc20.balanceOf(player);
      balance.fee.after = await erc20.balanceOf(feeAccount);

      const expected = { player: BigInt(0), fee: BigInt(0) };
      const denominator = await staker.DENOMINATOR();

      for (const stake of stakes) {
        const total =
          (BigInt(duration) * BigInt(yieldBase) * BigInt(1)) /
          BigInt(denominator);

        expected.fee += (total * BigInt(fee)) / BigInt(denominator);
        expected.player += total - expected.fee;

        assert(
          estimate[stake] >= total - expected.fee,
          "[Expected] " +
            stake +
            " total is " +
            (total - expected.fee) +
            " [Actual] " +
            stake +
            " total is " +
            estimate[stake]
        );

        const updated = await staker.getStake(player, stake);
        timestamp.after.push(updated[0]);

        assert(
          timestamp.after[stake] - timestamp.before[stake] >= duration,
          "[Expected] " +
            stake +
            " timestamp is " +
            duration +
            " [Actual] " +
            stake +
            " timestamp is " +
            (timestamp.after[stake] - timestamp.before[stake])
        );
      }

      assert(
        expected.player <= balance.player.after,
        "[Expected] player balance is " +
          expected.player +
          " [Actual] player balance is " +
          balance.player.after
      );
      assert(
        expected.fee <= balance.fee.after,
        "[Expected] fee balance is " +
          expected.fee +
          " [Actual] fee balance is " +
          balance.fee.after
      );
    });

    it("As a player I want to withdraw all my stakes", async () => {
      for (const id of erc721Of.player) {
        const owner = await erc721.ownerOf(id);
        assert(owner == staker.address);
      }

      result = await staker.withdrawAll(false, { from: player });
      console.log("[Staker.withdrawAll]", "Gas", result.receipt.gasUsed);

      for (const id of erc721Of.player) {
        owner = await erc721.ownerOf(id);
        assert(
          owner == player,
          "[Expected] owner is " + player + " [Actual] owner is " + owner
        );
      }
    });

    it("As a player I want to yield and withdraw from all of my stakes", async () => {
      const balance = { erc721: {}, erc20: {} };
      balance.erc721.before = await erc721.balanceOf(player);
      balance.erc20.before = await erc20.balanceOf(player);

      const duration = 86400;
      await advanceTime(Number(duration));

      // Making a transaction to commit time step
      await erc721.setApprovalForAll(staker.address, true, { from: player });

      result = await staker.withdrawAll(true, { from: player });
      console.log(
        "[Staker.yieldAllandWithdrawAll]",
        "Gas",
        result.receipt.gasUsed
      );

      balance.erc721.after = await erc721.balanceOf(player);
      balance.erc20.after = await erc20.balanceOf(player);

      assert(
        balance.erc721.after > balance.erc721.before &&
          balance.erc20.after > balance.erc20.before
      );
    });
  });

  it("Being in admin role I want to be the only allowed to pause or un-pause staking", async () => {
    const admin = player;
    const adminRole = await staker.DEFAULT_ADMIN_ROLE();
    await staker.grantRole(adminRole, admin);
    const pauserRole = await staker.PAUSER_ROLE();
    await staker.grantRole(pauserRole, admin, { from: admin });

    await staker.pause({ from: admin });

    await truffleAssert.reverts(
      staker.stake(erc721Of.player, {
        from: player,
      })
    );

    await staker.unpause({ from: admin });
    await staker.stake(erc721Of.player, {
      from: player,
    });

    await staker.pause({ from: admin });
    await truffleAssert.reverts(
      staker.yield(0, {
        from: player,
      })
    );
    await truffleAssert.reverts(
      staker.yieldAll({
        from: player,
      })
    );
    await staker.withdrawAll(false, {
      from: player,
    });
  });

  it("Being in admin role I want to be the only allowed to change the contract parameters", async () => {
    let expected = "getDelegate(address)";
    await truffleAssert.reverts(
      staker.addDelegate(
        staker.address,
        expected,
        web3.eth.abi.encodeParameter("address", staker.address),
        {
          from: player,
        }
      )
    );
    await staker.addDelegate(
      staker.address,
      expected,
      web3.eth.abi.encodeParameter("address", staker.address)
    );
    let actual = await staker.getDelegate(staker.address);
    assert(
      expected == actual[0],
      "[Expected] delegate is " +
        expected +
        " [Actual] delegate is " +
        actual[0]
    );

    await truffleAssert.reverts(
      staker.setDelegate(
        staker.address,
        0,
        expected,
        web3.eth.abi.encodeParameter("address", staker.address),
        {
          from: player,
        }
      )
    );

    expected = "getStakesSize(address)";
    await staker.setDelegate(
      staker.address,
      0,
      expected,
      web3.eth.abi.encodeParameter("address", staker.address)
    );

    actual = await staker.getDelegate(staker.address);
    assert(
      expected == actual[0],
      "[Expected] delegate is " +
        expected +
        " [Actual] delegate is " +
        actual[0]
    );

    await truffleAssert.reverts(
      staker.deleteDelegate(staker.address, {
        from: player,
      })
    );

    await staker.deleteDelegate(staker.address);
    actual = await staker.getDelegate(staker.address);
    assert(
      actual.length == 0,
      "[Expected] delegate is 0 [Actual] delegate is " + actual.length
    );

    expected = 100;
    await staker.setFee(expected);
    actual = await staker.getFee();
    assert(
      expected == actual,
      "[Expected] fee is " + expected + " [Actual] fee is " + actual
    );
    await truffleAssert.reverts(
      staker.setFee(expected, {
        from: player,
      })
    );

    expected = 100;
    await staker.setYieldBase(expected);
    actual = await staker.getYieldBase();
    assert(
      expected == actual,
      "[Expected] yield base is " +
        expected +
        " [Actual] yield base is " +
        actual
    );
    await truffleAssert.reverts(
      staker.setYieldBase(expected, {
        from: player,
      })
    );

    expected = player;
    await staker.setErc20(expected);
    actual = await staker.getErc20();
    assert(
      expected == actual,
      "[Expected] erc20 is " + expected + " [Actual] erc20 is " + actual
    );
    await truffleAssert.reverts(
      staker.setErc20(expected, {
        from: player,
      })
    );

    expected = player;
    await staker.setErc721(expected);
    actual = await staker.getErc721();
    assert(
      expected == actual,
      "[Expected] erc721 is " + expected + " [Actual] erc721 is " + actual
    );
    await truffleAssert.reverts(
      staker.setErc721(expected, {
        from: player,
      })
    );
  });
});

const advanceTime = (time) => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [time],
        id: new Date().getTime(),
      },
      (err, result) => {
        if (err) {
          return reject(err);
        }
        return resolve(result);
      }
    );
  });
};
