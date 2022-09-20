const StakerFacade = artifacts.require("StakerFacade");
const Staker = artifacts.require("Staker");

module.exports = async function (deployer, network, accounts) {
  if (network == "test") {
    const erc721 = "0x415e8BF86aB4884D4fcC6670959643621C475a30";
    const staker = await Staker.at(
      "0x9E82dB2F9F03639b1cd377cFa61abB6cF39067C2"
    );

    const facade = await deployer.deploy(StakerFacade, staker.address, erc721);

    await staker.addDelegate(
      facade.address,
      "getStakesDelegate(address)",
      web3.eth.abi.encodeParameter("address", accounts[0])
    );
  }
};
