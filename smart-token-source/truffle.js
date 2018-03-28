const HDWalletProvider = require("truffle-hdwallet-provider-privkey");

const privKey = "8958c01540bf070730b3eca154a80df825dad1da886617872d1a6ca93735e434"; // raw private key

module.exports = {
  networks: {
    ropsten: {
      provider: () => {
        return new HDWalletProvider(privKey, "https://ropsten.infura.io/y8JOOg3fY8GjxbQIZd2q");
      },
      gas: 4612302,
      network_id: 3
    }
  }
};
