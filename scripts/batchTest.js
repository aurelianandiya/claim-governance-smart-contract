require("dotenv").config({ quiet: true });

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

/* =========================================================
   CONFIGURATION
========================================================= */

const RPC_URL = process.env.RPC_URL;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

const NUMBER_OF_CLAIMS = 100;
const WARMUP_CLAIMS = 3;

const ABI_FILE = path.join(
  __dirname,
  "EvidenceBasedClaimGovernance.abi.json"
);

if (!RPC_URL) {
  throw new Error("RPC_URL is missing from .env");
}

if (!CONTRACT_ADDRESS || !ethers.isAddress(CONTRACT_ADDRESS)) {
  throw new Error("A valid CONTRACT_ADDRESS is required in .env");
}

for (const variableName of [
  "DEPLOYER_PRIVATE_KEY",
  "ISSUER_PRIVATE_KEY",
  "VERIFIER_PRIVATE_KEY"
]) {
  if (!process.env[variableName]) {
    throw new Error(`${variableName} is missing from .env`);
  }
}

if (!fs.existsSync(ABI_FILE)) {
  throw new Error(
    "EvidenceBasedClaimGovernance.abi.json was not found " +
    "in the same folder as batchTest.js"
  );
}

const abiFile = JSON.parse(
  fs.readFileSync(ABI_FILE, "utf8")
);

const contractABI = Array.isArray(abiFile)
  ? abiFile
  : abiFile.abi;

if (!Array.isArray(contractABI)) {
  throw new Error(
    "The ABI file does not contain a valid ABI array"
  );
}

/* =========================================================
   PROVIDER, WALLETS, AND SIGNERS
========================================================= */

const provider = new ethers.JsonRpcProvider(RPC_URL);

const deployerWallet = new ethers.Wallet(
  process.env.DEPLOYER_PRIVATE_KEY,
  provider
);

const issuerWallet = new ethers.Wallet(
  process.env.ISSUER_PRIVATE_KEY,
  provider
);

const verifierWallet = new ethers.Wallet(
  process.env.VERIFIER_PRIVATE_KEY,
  provider
);

/*
 * NonceManager helps keep sequential Ganache transactions
 * synchronized. Addresses must still be read from the raw
 * Wallet objects.
 */
const deployerSigner =
  new ethers.NonceManager(deployerWallet);

const issuerSigner =
  new ethers.NonceManager(issuerWallet);

const verifierSigner =
  new ethers.NonceManager(verifierWallet);

const contract = new ethers.Contract(
  CONTRACT_ADDRESS,
  contractABI,
  provider
);

const deployerContract =
  contract.connect(deployerSigner);

const issuerContract =
  contract.connect(issuerSigner);

const verifierContract =
  contract.connect(verifierSigner);

/* =========================================================
   HELPERS
========================================================= */

function getErrorMessage(error) {
  return (
    error?.info?.error?.message ||
    error?.error?.message ||
    error?.shortMessage ||
    error?.reason ||
    error?.message ||
    String(error)
  );
}

function elapsedMilliseconds(startTime) {
  return Number(
    process.hrtime.bigint() - startTime
  ) / 1e6;
}

async function executeMeasuredTransaction(
  transactionFactory
) {
  const startTime = process.hrtime.bigint();

  const tx = await transactionFactory();
  const receipt = await tx.wait();

  const elapsedMs =
    elapsedMilliseconds(startTime);

  if (!receipt || receipt.status !== 1) {
    throw new Error(
      `Transaction failed or returned an invalid receipt: ${tx.hash}`
    );
  }

  return {
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString(),
    elapsedMs
  };
}

function writeResults(outputFiles, payload) {
  const json = JSON.stringify(
    payload,
    null,
    2
  );

  for (const outputFile of outputFiles) {
    fs.writeFileSync(
      outputFile,
      json
    );
  }
}

function assertDistinctAccounts() {
  const addresses = {
    deployer:
      deployerWallet.address.toLowerCase(),
    issuer:
      issuerWallet.address.toLowerCase(),
    verifier:
      verifierWallet.address.toLowerCase()
  };

  if (addresses.deployer === addresses.issuer) {
    throw new Error(
      "Deployer and issuer must use distinct accounts"
    );
  }

  if (addresses.deployer === addresses.verifier) {
    throw new Error(
      "Deployer and verifier must use distinct accounts"
    );
  }

  if (addresses.issuer === addresses.verifier) {
    throw new Error(
      "Issuer and verifier must use distinct accounts"
    );
  }
}

function validateRequiredAbiFunctions() {
  const requiredFunctions = [
    "admin",
    "isIssuer",
    "isVerifier",
    "addIssuer",
    "addVerifier",
    "registerClaim",
    "submitForReview",
    "verifyClaim",
    "getClaimStatus",
    "getVerificationCount",
    "getVerificationByIndex"
  ];

  for (const functionName of requiredFunctions) {
    try {
      contract.interface.getFunction(
        functionName
      );
    } catch {
      throw new Error(
        `The loaded ABI does not contain the required function: ${functionName}`
      );
    }
  }
}

/* =========================================================
   ENVIRONMENT AND ROLE VALIDATION
========================================================= */

async function validateEnvironment() {
  assertDistinctAccounts();
  validateRequiredAbiFunctions();

  const network =
    await provider.getNetwork();

  const bytecode =
    await provider.getCode(
      CONTRACT_ADDRESS
    );

  if (bytecode === "0x") {
    throw new Error(
      `No contract bytecode exists at ${CONTRACT_ADDRESS}. ` +
      "Redeploy the final contract to the active Ganache workspace " +
      "and update CONTRACT_ADDRESS."
    );
  }

  const storedAdmin =
    await contract.admin();

  if (
    storedAdmin.toLowerCase() !==
    deployerWallet.address.toLowerCase()
  ) {
    throw new Error(
      `Configured deployer is not the contract admin. ` +
      `Contract admin: ${storedAdmin}; ` +
      `configured deployer: ${deployerWallet.address}`
    );
  }

  const balances = {
    deployer:
      await provider.getBalance(
        deployerWallet.address
      ),
    issuer:
      await provider.getBalance(
        issuerWallet.address
      ),
    verifier:
      await provider.getBalance(
        verifierWallet.address
      )
  };

  for (
    const [role, balance]
    of Object.entries(balances)
  ) {
    if (balance === 0n) {
      throw new Error(
        `${role} account has zero Ganache ETH and cannot pay gas`
      );
    }
  }

  console.log(
    "Environment validated"
  );

  console.log(
    "Chain ID:",
    network.chainId.toString()
  );

  console.log(
    "Contract:",
    CONTRACT_ADDRESS
  );

  console.log(
    "Admin:",
    storedAdmin
  );

  console.log(
    "Deployer balance:",
    ethers.formatEther(
      balances.deployer
    ),
    "ETH"
  );

  console.log(
    "Issuer balance:",
    ethers.formatEther(
      balances.issuer
    ),
    "ETH"
  );

  console.log(
    "Verifier balance:",
    ethers.formatEther(
      balances.verifier
    ),
    "ETH"
  );

  return {
    chainId:
      network.chainId.toString(),
    rpcUrl:
      RPC_URL,
    contractAddress:
      CONTRACT_ADDRESS,
    contractBytecodeHash:
      ethers.keccak256(bytecode),
    admin:
      storedAdmin,
    deployer:
      deployerWallet.address,
    issuer:
      issuerWallet.address,
    verifier:
      verifierWallet.address
  };
}

async function setupRoles() {
  const issuerAuthorised =
    await contract.isIssuer(
      issuerWallet.address
    );

  if (!issuerAuthorised) {
    try {
      const tx =
        await deployerContract.addIssuer(
          issuerWallet.address
        );

      await tx.wait();

      console.log(
        "Issuer granted:",
        issuerWallet.address
      );
    } catch (error) {
      throw new Error(
        `addIssuer failed: ${getErrorMessage(error)}`
      );
    }
  } else {
    console.log(
      "Issuer already authorised:",
      issuerWallet.address
    );
  }

  const verifierAuthorised =
    await contract.isVerifier(
      verifierWallet.address
    );

  if (!verifierAuthorised) {
    try {
      const tx =
        await deployerContract.addVerifier(
          verifierWallet.address
        );

      await tx.wait();

      console.log(
        "Verifier granted:",
        verifierWallet.address
      );
    } catch (error) {
      throw new Error(
        `addVerifier failed: ${getErrorMessage(error)}`
      );
    }
  } else {
    console.log(
      "Verifier already authorised:",
      verifierWallet.address
    );
  }

  const issuerConfirmed =
    await contract.isIssuer(
      issuerWallet.address
    );

  const verifierConfirmed =
    await contract.isVerifier(
      verifierWallet.address
    );

  if (
    !issuerConfirmed ||
    !verifierConfirmed
  ) {
    throw new Error(
      "Role setup did not persist correctly on-chain"
    );
  }
}

/* =========================================================
   CLAIM EXECUTION
========================================================= */

async function executeClaim(
  index,
  prefix,
  measured,
  evidenceValidUntil
) {
  const paddedIndex =
    String(index).padStart(
      3,
      "0"
    );

  const claimId =
    `${prefix}_CLAIM_${paddedIndex}`;

  const productId =
    `${prefix}_PRODUCT_${paddedIndex}`;

  const claimType =
    "Cruelty-Free";

  const claimDescription =
    "Product-level cruelty-free claim supported by linked evidence.";

  const evidenceId =
    `${prefix}_EVID_${paddedIndex}`;

  const evidenceHash =
    ethers.keccak256(
      ethers.toUtf8Bytes(
        `${prefix}_EVIDENCE_CONTENT_${paddedIndex}`
      )
    );

  const registrationInput = {
    claimId,
    productId,
    claimType,
    claimDescription,
    evidenceId,
    evidenceValidUntil,
    evidenceHash
  };

  const registration =
    await executeMeasuredTransaction(
      () =>
        issuerContract.registerClaim(
          registrationInput
        )
    );

  const submission =
    await executeMeasuredTransaction(
      () =>
        issuerContract.submitForReview(
          claimId
        )
    );

  const verification =
    await executeMeasuredTransaction(
      () =>
        verifierContract.verifyClaim(
          claimId,
          true
        )
    );

  const finalStatus =
    await contract.getClaimStatus(
      claimId
    );

  const verificationCount =
    await contract.getVerificationCount(
      claimId
    );

  if (Number(finalStatus) !== 3) {
    throw new Error(
      `${claimId}: expected Active status (3), ` +
      `received ${finalStatus.toString()}`
    );
  }

  if (verificationCount !== 1n) {
    throw new Error(
      `${claimId}: expected one verification, ` +
      `received ${verificationCount.toString()}`
    );
  }

  const storedVerification =
    await contract.getVerificationByIndex(
      claimId,
      0
    );

  const storedApproved =
    storedVerification.approved ??
    storedVerification[1];

  const storedEvidenceHash =
    storedVerification.evidenceHash ??
    storedVerification[3];

  if (!storedApproved) {
    throw new Error(
      `${claimId}: stored verification is not approved`
    );
  }

  if (
    String(
      storedEvidenceHash
    ).toLowerCase() !==
    evidenceHash.toLowerCase()
  ) {
    throw new Error(
      `${claimId}: verification is linked to an ` +
      "unexpected evidence hash"
    );
  }

  if (!measured) {
    return null;
  }

  const regGas =
    BigInt(
      registration.gasUsed
    );

  const submitGas =
    BigInt(
      submission.gasUsed
    );

  const verifyGas =
    BigInt(
      verification.gasUsed
    );

  return {
    index,
    claimId,
    status:
      "success",
    finalStatus:
      "Active",
    verificationCount:
      verificationCount.toString(),

    regTimeMs:
      registration.elapsedMs,
    submitTimeMs:
      submission.elapsedMs,
    verifyTimeMs:
      verification.elapsedMs,
    totalTimeMs:
      registration.elapsedMs +
      submission.elapsedMs +
      verification.elapsedMs,

    regGas:
      registration.gasUsed,
    submitGas:
      submission.gasUsed,
    verifyGas:
      verification.gasUsed,
    totalGas:
      (
        regGas +
        submitGas +
        verifyGas
      ).toString(),

    regTxHash:
      registration.txHash,
    submitTxHash:
      submission.txHash,
    verifyTxHash:
      verification.txHash,

    regBlock:
      registration.blockNumber,
    submitBlock:
      submission.blockNumber,
    verifyBlock:
      verification.blockNumber,

    evidenceHash
  };
}

/* =========================================================
   MAIN
========================================================= */

async function main() {
  const environment =
    await validateEnvironment();

  await setupRoles();

  /*
   * Unique fixed-length run ID prevents claim-ID collisions
   * when the script is executed more than once on the same
   * Ganache deployment.
   */
  const runId =
    String(
      Date.now()
    ).slice(-10);

  const prefix =
    `R${runId}`;

  /*
   * One validity timestamp is used for the entire run so the
   * batch inputs remain consistent.
   */
  const evidenceValidUntil =
    Math.floor(
      Date.now() / 1000
    ) +
    365 * 24 * 60 * 60;

  const dataDirectory = path.join(__dirname, "..", "data");
fs.mkdirSync(dataDirectory, { recursive: true });

   const latestResultsFile = path.join(
   dataDirectory,
   "batchResults.json"
   );

   const archivalResultsFile = path.join(
   dataDirectory,
   `batchResults_${runId}.json`
   );


  const outputFiles = [
    latestResultsFile,
    archivalResultsFile
  ];

  console.log(
    `Run ID: ${runId}`
  );

  console.log(
    `Running ${WARMUP_CLAIMS} warm-up claims...`
  );

  for (
    let i = 1;
    i <= WARMUP_CLAIMS;
    i++
  ) {
    await executeClaim(
      i,
      `${prefix}_W`,
      false,
      evidenceValidUntil
    );
  }

  console.log(
    `Starting measured batch of ${NUMBER_OF_CLAIMS} claims...`
  );

  const results = [];

  for (
    let i = 1;
    i <= NUMBER_OF_CLAIMS;
    i++
  ) {
    try {
      const result =
        await executeClaim(
          i,
          `${prefix}_M`,
          true,
          evidenceValidUntil
        );

      results.push(
        result
      );

      const payload = {
        metadata: {
          generatedAt:
            new Date().toISOString(),
          runId,
          numberOfClaims:
            NUMBER_OF_CLAIMS,
          warmupClaims:
            WARMUP_CLAIMS,
          evidenceValidUntil,
          ...environment
        },
        results
      };

      writeResults(
        outputFiles,
        payload
      );

      console.log(
        `${result.claimId}: ` +
        `register=${result.regTimeMs.toFixed(3)} ms, ` +
        `submit=${result.submitTimeMs.toFixed(3)} ms, ` +
        `verify=${result.verifyTimeMs.toFixed(3)} ms`
      );
    } catch (error) {
      const message =
        getErrorMessage(error);

      console.error(
        `Claim ${i} failed: ${message}`
      );

      results.push({
        index:
          i,
        claimId:
          `${prefix}_M_CLAIM_${String(i).padStart(3, "0")}`,
        status:
          "failed",
        error:
          message
      });

      const payload = {
        metadata: {
          generatedAt:
            new Date().toISOString(),
          runId,
          numberOfClaims:
            NUMBER_OF_CLAIMS,
          warmupClaims:
            WARMUP_CLAIMS,
          evidenceValidUntil,
          ...environment
        },
        results
      };

      writeResults(
        outputFiles,
        payload
      );

      throw error;
    }
  }

  console.log(
    "Batch completed successfully."
  );

  console.log(
    "Latest results:",
    latestResultsFile
  );

  console.log(
    "Archived results:",
    archivalResultsFile
  );
}

main().catch((error) => {
  console.error(
    "Batch test failed:"
  );

  console.error(
    getErrorMessage(error)
  );

  /*
   * Preserve nested Ganache/Ethers details when a generic
   * message such as "could not coalesce error" is returned.
   */
  console.dir(
    error,
    {
      depth: 5
    }
  );

  process.exitCode = 1;
});
