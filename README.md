# Evidence-Based Claim Governance Smart Contract

This repository contains the EVM-compatible smart contract and batch-testing materials developed for an evidence-based claim-governance proof of concept for cosmetic sustainability claims.

The implementation supports claim registration and evidence binding, submission for authorised review, role-based verification, claim-status control, and audit-oriented retrieval. Substantive evidence documents remain off-chain, while the smart contract stores claim metadata, evidence references and integrity hashes, authorised verification decisions, current claim status, and records required to reconstruct the claim history.

The repository is provided for research review and re-execution of the proof-of-concept blockchain testing component.

## Repository contents

```text
claim-governance-smart-contract/
├── contracts/
│   └── EvidenceBasedClaimGovernance.sol
├── scripts/
│   ├── batchTest.js
│   └── EvidenceBasedClaimGovernance.abi.json
├── data/
│   └── batchResults.json
├── figures/
│   ├── .gitkeep
│   └── confirmation_time_histogram_panel.png
├── package.json
├── package-lock.json
├── .gitignore
└── README.md
```

## Smart contract

The smart contract is located at:

```text
contracts/EvidenceBasedClaimGovernance.sol
```

It implements the core claim-governance logic, including:

* role-based permissions for claim issuers, authorised verifiers, and oversight actors;
* claim registration with a defined claim type and scope;
* linkage to an evidence identifier, validity date, and integrity hash;
* submission for authorised review;
* verification decisions linked to the reviewed evidence;
* status control across Registered, UnderReview, Active, Expired, Suspended, and Withdrawn states;
* evidence renewal or resubmission;
* retrieval of claim, evidence, status, and verification records; and
* emitted events supporting reconstruction of evidence-linkage and claim-status history.

Substantive evidence remains off-chain. The contract operates as a governance-record layer and does not independently establish the truth or quality of the underlying evidence.

## Batch testing

The batch-testing script is located at:

```text
scripts/batchTest.js
```

The contract application binary interface used by the script is located at:

```text
scripts/EvidenceBasedClaimGovernance.abi.json
```

For each claim, the script executes three sequential smart-contract transactions:

1. claim registration and evidence binding;
2. submission for authorised review; and
3. authorised verification.

The script uses three preliminary claims as warm-up observations and excludes them from the measured batch. It then executes 100 measured claims.

For each measured claim, the output includes:

* transaction-confirmation times;
* gas use;
* transaction hashes;
* block numbers;
* final claim status;
* verification-record checks; and
* the evidence hash associated with the verification decision.

The latest output is written to:

```text
data/batchResults.json
```

An archival output identified by the run ID is also written to the `data` directory.

## Dependencies

The batch-testing script uses:

* `ethers`
* `dotenv`

Install the required dependencies with:

```bash
npm install
```

## Environment configuration

The smart contract must first be deployed to an active EVM-compatible local testing environment. The configured contract address must refer to the deployed final version of `EvidenceBasedClaimGovernance.sol`.

Create a local `.env` file containing:

```text
RPC_URL=
CONTRACT_ADDRESS=
DEPLOYER_PRIVATE_KEY=
ISSUER_PRIVATE_KEY=
VERIFIER_PRIVATE_KEY=
```

The accounts must satisfy the following conditions:

* the deployer account is the contract administrator;
* the issuer and verifier use distinct accounts;
* all configured accounts have sufficient test-network funds; and
* `CONTRACT_ADDRESS` contains deployed contract bytecode on the active network.

Private keys, `.env` files, and production credentials are intentionally excluded from this repository.

## Running the batch test

After deploying the contract, configuring the environment variables, and installing the dependencies, run:

```bash
node scripts/batchTest.js
```

Before execution, the script checks:

* the network connection;
* the deployed contract bytecode;
* the contract administrator;
* account separation;
* account balances;
* required smart-contract functions;
* issuer and verifier permissions; and
* availability of the contract ABI.

The script stops and reports an error when the required environment or contract configuration is invalid.

## Execution evidence

The existing output reports repeated execution of the three-step claim-governance sequence in a controlled EVM-compatible proof-of-concept environment.

The accompanying execution figure is located at:

```text
figures/confirmation_time_histogram_panel.png
```

The figure presents the distribution of aggregate confirmation times for claim registration and evidence binding, submission for authorised review, and verification.

## Prototype interface

A hosted proof-of-concept interface is available at:

```text
https://vericlaim-demo.vercel.app/
```

The interface illustrates claim registration, evidence linkage, authorised assessment, current status, and observer-facing claim-history access. It is provided for research review and demonstration and does not contain production data or represent production access controls.

## Scope and limitations

This repository documents a controlled research proof of concept. It does not constitute a production deployment, regulatory system, certification service, or independent guarantee of claim truth.

The credibility of a governed claim continues to depend on the quality of the underlying evidence and the competence, legitimacy, and participation of the authorised institutions involved.

## Security note

This repository does not include:

* private keys;
* `.env` files;
* production credentials;
* commercially sensitive evidence documents; or
* sensitive operational data.

Any demonstration credentials associated with the prototype are intended only for review and illustration.

## Status

Research proof of concept for functional validation, execution testing, and academic review.
