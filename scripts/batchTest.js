require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");

// ======== Setup provider ========
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

// ======== Setup wallets ========
const deployerWallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
const issuerWallet = new ethers.Wallet(process.env.ISSUER_PRIVATE_KEY, provider);
const verifierWallet = new ethers.Wallet(process.env.VERIFIER_PRIVATE_KEY, provider);

// Bungkus dengan NonceManager agar nonce sinkron
const deployer = new ethers.NonceManager(deployerWallet);
const issuer = new ethers.NonceManager(issuerWallet);
const verifier = new ethers.NonceManager(verifierWallet);

// ======== Contract ABI & Address ========
const contractABI = [
  {
    "inputs": [{ "internalType": "address", "name": "a", "type": "address" }],
    "name": "addIssuer",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "a", "type": "address" }],
    "name": "addVerifier",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "string", "name": "claimId", "type": "string" }],
    "name": "checkExpiry",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [{ "indexed": false, "internalType": "string", "name": "claimId", "type": "string" }],
    "name": "ClaimRegistered",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": false, "internalType": "string", "name": "claimId", "type": "string" },
      { "indexed": false, "internalType": "bool", "name": "approved", "type": "bool" }
    ],
    "name": "ClaimVerified",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [{ "indexed": true, "internalType": "address", "name": "issuer", "type": "address" }],
    "name": "IssuerAdded",
    "type": "event"
  },
  {
    "inputs": [
      { "internalType": "string", "name": "claimId", "type": "string" },
      { "internalType": "string", "name": "productId", "type": "string" },
      { "internalType": "string", "name": "claimType", "type": "string" },
      { "internalType": "string", "name": "evidenceId", "type": "string" },
      { "internalType": "uint64", "name": "expiryDate", "type": "uint64" },
      { "internalType": "bytes32", "name": "hash", "type": "bytes32" }
    ],
    "name": "registerClaim",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "string", "name": "claimId", "type": "string" },
      { "internalType": "string", "name": "newEvidenceId", "type": "string" },
      { "internalType": "uint64", "name": "newExpiry", "type": "uint64" },
      { "internalType": "bytes32", "name": "newHash", "type": "bytes32" }
    ],
    "name": "renewClaim",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": false, "internalType": "string", "name": "claimId", "type": "string" },
      { "indexed": false, "internalType": "uint8", "name": "status", "type": "uint8" }
    ],
    "name": "StatusChanged",
    "type": "event"
  },
  {
    "inputs": [{ "internalType": "string", "name": "claimId", "type": "string" }],
    "name": "suspendClaim",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [{ "indexed": true, "internalType": "address", "name": "verifier", "type": "address" }],
    "name": "VerifierAdded",
    "type": "event"
  },
  {
    "inputs": [
      { "internalType": "string", "name": "claimId", "type": "string" },
      { "internalType": "bool", "name": "approved", "type": "bool" }
    ],
    "name": "verifyClaim",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "string", "name": "claimId", "type": "string" }],
    "name": "withdrawClaim",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

const contractAddress = "0x6Fe1395924BE0346a239CB228965855004B9E2E8";

const contract = new ethers.Contract(contractAddress, contractABI, provider);
const issuerContract = contract.connect(issuer);
const verifierContract = contract.connect(verifier);

async function main() {
  const results = [];

  console.log("Starting batch test...");

  for (let i = 1; i <= 100; i++) {
    try {
      const claimId = `CLAIM_${i}`;
      const productId = `PRODUCT_${i}`;
      const claimType = "cosmetic";
      const evidenceId = `EVID_${i}`;
      const expiryDate = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365;
      const hash = ethers.encodeBytes32String(`hash_${i}`);

      // Register
      let start = Date.now();
      const txReg = await issuerContract.registerClaim(
        claimId,
        productId,
        claimType,
        evidenceId,
        expiryDate,
        hash
      );
      const receiptReg = await txReg.wait();
      let end = Date.now();
      const regTime = (end - start) / 1000;

      // Verify
      start = Date.now();
      const txVer = await verifierContract.verifyClaim(claimId, true);
      const receiptVer = await txVer.wait();
      end = Date.now();
      const verTime = (end - start) / 1000;

      results.push({
        claimId,
        status: "success",
        regTimeSec: regTime,
        verTimeSec: verTime,
        regGas: receiptReg.gasUsed.toString(),
        verGas: receiptVer.gasUsed.toString()
      });

      console.log(`Claim ${i} done: regTime=${regTime}s, verTime=${verTime}s`);
    } catch (err) {
      console.error(`Claim ${i} failed: ${err.shortMessage || err.message}`);

      results.push({
        claimId: `CLAIM_${i}`,
        status: "failed",
        error: err.shortMessage || err.message
      });

      fs.writeFileSync("batchResults.json", JSON.stringify(results, null, 2));
      console.log("Partial results saved to batchResults.json");
      throw err;
    }
  }

  fs.writeFileSync("batchResults.json", JSON.stringify(results, null, 2));
  console.log("Results saved to batchResults.json");
}

main().catch((err) => {
  console.error("Batch test failed:");
  console.error(err);
});
