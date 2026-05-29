# Claim Governance Smart Contract

This repository contains the EVM-compatible smart contract and batch testing artefacts for an evidence-based claim governance proof-of-concept for cosmetic sustainability claims.

The artefacts support claim registration, evidence binding, authorized verification, lifecycle status control, and audit-oriented retrieval. The repository is provided for research review and reproducibility of the proof-of-concept blockchain testing component.

## Repository contents

```text
claim-governance-smart-contract/
├── contracts/
│   └── EvidenceBasedClaimGovernance.sol
├── scripts/
│   └── batchTest.js
├── data/
│   └── batchResults.json
├── figures/
│   └── confirmation_time_histogram_panel.png
├── package.json
├── package-lock.json
├── .gitignore
└── README.md
```

## Smart contract

The smart contract file is located at:

```text
contracts/EvidenceBasedClaimGovernance.sol
```

It implements the core claim-governance logic, including:

* role-based access for issuer, verifier, and oversight actors;
* claim registration with evidence metadata, validity period, and hash reference;
* authorized claim verification;
* lifecycle status control, including registered, under review, active, expired, suspended, and withdrawn states;
* query functions for claim status and verification records.

## Batch testing

The batch testing script is located at:

```text
scripts/batchTest.js
```

The script executes repeated claim registration and verification transactions using `ethers.js`. It records execution time and gas use for each claim registration and verification action.

The resulting output is stored in:

```text
data/batchResults.json
```

The uploaded batch output reports repeated successful executions for claim registration and verification under the proof-of-concept testing setup.

## Dependencies

The testing script uses:

* `ethers`
* `dotenv`

Install dependencies with:

```bash
npm install
```

## Environment variables

The testing script requires the following environment variables:

```text
RPC_URL=
DEPLOYER_PRIVATE_KEY=
ISSUER_PRIVATE_KEY=
VERIFIER_PRIVATE_KEY=
```

Private keys and `.env` files are intentionally excluded from this repository.

## Running the batch test

After setting the required environment variables, run:

```bash
node scripts/batchTest.js
```

The script writes the test output to:

```text
data/batchResults.json
```

## Prototype interface

A hosted proof-of-concept interface is available at:

```text
https://vericlaim-demo.vercel.app/
```

The hosted interface is provided to demonstrate the claim-governance workflow and role-based access logic. This repository focuses on the smart contract and batch testing artefacts.

## Security note

This repository does not include private keys, `.env` files, production credentials, or sensitive operational data. Demo credentials, where provided, are intended only for review and illustration.

## Status

Research proof-of-concept for functional validation and review.
