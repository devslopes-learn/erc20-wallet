#!/usr/bin/env node
var colors = require('colors');
const clear = require('clear');
const CFonts = require('cfonts');
const prompt = require('prompt');
const Configstore = require('configstore');
const conf = new Configstore('tokenize');
const keythereum = require('keythereum');
const contract = require('truffle-contract');
const WalletProvider = require('truffle-hdwallet-provider-privkey');
const Web3 = require('web3');

var privateKey;

var w;
var web3;

// Import our contract artifacts and turn them into usable abstractions.
const tutorialtoken_artifacts = require('./smart-token-source/build/contracts/TutorialToken.json')

// MetaCoin is our usable abstraction, which we'll use through the code below.
var TutorialToken = contract(tutorialtoken_artifacts);

var accounts;
var account;

const args = process.argv.slice(2);
const dappName = 'tokenize'

clear();

if (args.length === 0) {
	CFonts.say(dappName, { colors: ['green']});
	console.log(`Usage:
	${dappName} balance
		Gets your current wallet balance and public address

	${dappName} send <amount> <address>
		Sends ${dappName} from your wallet to the specified address

	${dappName} wallet create
		Guides you through creating a new ${dappName} wallet
	`);
	process.exit(1);
}

const createAccount = () => {
	console.log((`\nPlease enter a unique password ${('(8 character minimum)')}.\n This password will be used to encrypt your private key and make working with your wallet easier.\n\n`).yellow);
	console.log((`Store this password somewhere safe. If you lose or forget it you will never be able to transfer funds\n`).red);

	prompt.message = (`${dappName} wallet`).white;
	prompt.start();
	prompt.get({
		properties: {
			password: {
				description: ('Password').white,
				hidden: true
			},
			confirmPass: {
				description: ('Re-enter password').white,
				hidden: true
			}
		}
	}, async (_, result) => {
		try {
			if (result.password !== result.confirmPass) {
				console.log(('\nPasswords do not match.\n\n').magenta);
				createAccount();
			} else {
				var params = { keyBytes: 32, ivBytes: 16 };
				var dk = keythereum.create(params);
				var password = result.password;

				var options = {
					kdf: "pbkdf2",
					cipher: "aes-128-ctr",
					kdfparams: {
						c: 262144,
						dklen: 32,
						prf: "hmac-sha256"
					}
				};

				var tempWeb3 = new Web3();

				var keyObject = keythereum.dump(password, dk.privateKey, dk.salt, dk.iv, options)
				var etherAddress = tempWeb3.utils.toChecksumAddress("0x" + keyObject.address);

				account = etherAddress;

				if(account) {
					conf.set('account-address', account);
					conf.set('password', result.password);
				}

				clear();

				console.log((`${dappName} wallet successfully created.`).green.bold);
				console.log((`You can now start sending and receiving TutorialToken!`).white);
				console.log((`\n${dappName} Public Address:`).white);
				console.log((`${account}`).green);
				console.log((`\n${dappName} Private Key:`).white);
				keythereum.recover(password, keyObject, function (privateKey) {
					conf.set('priv-key', privateKey.toString('hex'));
					console.log(("0x" + `${privateKey.toString('hex')}`).green);
					w = new WalletProvider(privateKey.toString('hex'), "https://ropsten.infura.io/y8JOOg3fY8GjxbQIZd2q");
					web3 = new Web3(w.engine);
					process.exit();
				});
			}
		} catch(err) {
			console.log(err);
		}
	});
};

const printBalance = () => {
	var tutorial;
	var storedAccount = conf.get('account-address');
	TutorialToken.deployed().then(function(instance) {
		tutorial = instance;
		tutorial.balanceOf(storedAccount).then(function(result) {
			return result.valueOf();
		}).then(function(value) {
			console.log(`Balance of Account (${storedAccount}):\n`, value + ' TutorialToken'.green);
			process.exit();
		}).catch(function(e) {
			console.log(e);
		});
	});
};

const main = async () => {
	if(conf.get('priv-key')) {
		w = new WalletProvider(conf.get('priv-key'), "https://ropsten.infura.io/y8JOOg3fY8GjxbQIZd2q");
		web3 = new Web3(w.engine);
		TutorialToken.setProvider(web3.currentProvider);
		if (typeof TutorialToken.currentProvider.sendAsync !== "function") {
			TutorialToken.currentProvider.sendAsync = function() {
				return TutorialToken.currentProvider.send.apply(
					TutorialToken.currentProvider, arguments
				);
			};
		}
	}
	CFonts.say(dappName, { colors: ['green']});

  if (args[0] === 'wallet') {
      if (args[1] === 'create') {
				if(conf.get('account-address')) {
					console.log(`Looks like you already have an account: ${conf.get('account-address')}.`.blue, `\nTry something else.`.green);
					process.exit();
				} else {
					if (conf.get('priv-key')) {
						privateKey = conf.get('priv-key');
					} else {
						createAccount();
					}
				}
      }
  } else {
    if (args[0] === 'balance') {
			if(conf.get('account-address')) {
				await printBalance(_ => {});
			} else {
				console.log("It doesn't look like you have an account yet. \nCreating one now...\n".blue);
				createAccount();
			}
    } else if (args[0] === 'send') {
			prompt.message = (`Unlock ${dappName} wallet. Please enter your password to decrypt your private key.\n`).green;
			prompt.start();
			prompt.get({
				properties: {
					password: {
						description: ('Password').white,
						hidden: true
					}
				}
			}, async (_, result) => {
				if (result.password !== conf.get('password')) {
					console.log(("\nHmm... That doesn't seem to be the right password... Try again.\n\n").magenta);
					process.exit();
				} else {
					var tutorial;
					var sender = conf.get('account-address');
					var receiver = args[2];
					var amount = args[1];

					TutorialToken.deployed().then(function(instance) {
						tutorial = instance;
						tutorial.balanceOf(sender).then(function(result) {
							if (result.valueOf() > 0) {
								return tutorial.sendCoin(receiver, amount, {from: sender.toLowerCase()}).then(function() {
									console.log(`Transfer to Account (${receiver}): Success!\n`, "Amount: ", amount + ' TutorialToken\n'.blue);
									process.exit();
								}).catch(function(err) {
									console.log("SEND ERROR: ", err.message);
									process.exit();
								})
							} else {
								console.log("Looks like you're out of TutorialToken.".red, " Please check your balance.".yellow);
								process.exit();
							}
						})
					}).catch(function(e) {
						console.log("TRANSFER ERROR: ", e);
					});
				}
			});
    };
  };
};

main();
