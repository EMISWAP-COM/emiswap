const HDWalletProvider = require('@truffle/hdwallet-provider');
var fs = require('fs');

require('dotenv').config()

module.exports = {
    networks: { // use with node 12 -> nvm use 12 && ganache-cli
        mainnet: {
            networkCheckTimeout: 300000,
            provider: () => new HDWalletProvider(process.env.PRIVATE_KEY_MAINNET, process.env.PROVIDER_MAINNET),
            network_id: 1,       // id
            gas: 8500000,        // Ropsten has a lower block limit than mainnet
            gasPrice: 1500000000,
            confirmations: 2,    // # of confs to wait between deployments. (default: 0)
            timeoutBlocks: 200,  // # of blocks before a deployment times out  (minimum/default: 50)
            skipDryRun: true     // Skip dry run before migrations? (default: false for public nets )
        },
        ropsten: {
            provider: () => new HDWalletProvider(process.env.PRIVATE_KEY_ROPSTEN, process.env.PROVIDER_ROPSTEN),
            network_id: 3,       // Ropsten's id
            gas: 5000000,        // Ropsten has a lower block limit than mainnet
            //gasPrice: 5000000,
            confirmations: 2,    // # of confs to wait between deployments. (default: 0)
            timeoutBlocks: 200,  // # of blocks before a deployment times out  (minimum/default: 50)
            skipDryRun: true     // Skip dry run before migrations? (default: false for public nets )
        },
        kovan: {
            networkCheckTimeout: 300000,
            provider: () => new HDWalletProvider(process.env.PRIVATE_KEY_KOVAN, process.env.PROVIDER_KOVAN),
            network_id: 42,       // id
            gas: 5500000,        // Ropsten has a lower block limit than mainnet
            gasPrice: 1500000000,
            confirmations: 2,    // # of confs to wait between deployments. (default: 0)
            timeoutBlocks: 200,  // # of blocks before a deployment times out  (minimum/default: 50)
            skipDryRun: true     // Skip dry run before migrations? (default: false for public nets )
        },
        rinkeby: {
            networkCheckTimeout: 100000,
            provider: () => new HDWalletProvider(process.env.PRIVATE_KEY_RINKEBY, process.env.PROVIDER_RINKEBY),
            network_id: 4,       // id
            gas: 5500000,        // Ropsten has a lower block limit than mainnet
            gasPrice: 2000000000,
            confirmations: 2,    // # of confs to wait between deployments. (default: 0)
            timeoutBlocks: 200,  // # of blocks before a deployment times out  (minimum/default: 50)
            skipDryRun: true     // Skip dry run before migrations? (default: false for public nets )
        },
        local: {
            host: '127.0.0.1',
            port: 8545,
            gasLimit: 12000000,
            network_id: '*',
        },
        soliditycoverage: {
            host: '127.0.0.1',
            port: 8555,
            gasLimit: 12000000,
            network_id: '*',
        },
        test: {
            networkCheckTimeout: 100000,
            provider() {
                // eslint-disable-next-line global-require
                const { provider } = require('@openzeppelin/test-environment');
                return provider;
            },
            skipDryRun: true,
            network_id: '*',
        }, 
    },
    compilers: {
        solc: {
            version: '0.6.12',
            settings: {
                optimizer: {
                    enabled: true,
                    runs: 200,
                }
            }
        },
    },
    plugins: ["solidity-coverage"],
    mocha: { // https://github.com/cgewecke/eth-gas-reporter
        timeout: 100000,
        reporter: '',
        reporterOptions : {
            currency: 'USD',
            gasPrice: 10,
            onlyCalledMethods: true,
            showTimeSpent: true,
            excludeContracts: ['Migrations', 'mocks'],
            url: 'http://localhost:8545'
        }
    }
};
