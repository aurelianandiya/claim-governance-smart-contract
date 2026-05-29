// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract EvidenceBasedClaimGovernance {

    /* ================= ENUM ================= */
    enum ClaimStatus { None, Registered, UnderReview, Active, Expired, Suspended, Withdrawn }

    /* ================= STRUCT ================= */
    struct Evidence {
        string evidenceId;
        uint64 expiryDate;
        bytes32 hash;
    }

    struct Claim {
        string claimId;
        string productId;
        string claimType;
        address issuer;
        ClaimStatus status;
        uint64 createdAt;
        Evidence evidence;
        bool exists;
    }

    struct Verification {
        address verifier;
        bool approved;
        uint64 time;
    }

    /* ================= STORAGE ================= */
    address public admin;

    mapping(address => bool) public isIssuer;
    mapping(address => bool) public isVerifier;
    mapping(address => bool) public isOversight;

    mapping(bytes32 => Claim) public claims;
    mapping(bytes32 => Verification[]) public verifications;

    /* ================= EVENTS ================= */
    event ClaimRegistered(string claimId);
    event ClaimVerified(string claimId, bool approved);
    event StatusChanged(string claimId, ClaimStatus status);
    event VerifierAdded(address indexed verifier);
    event IssuerAdded(address indexed issuer);

    /* ================= MODIFIER ================= */
    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    modifier onlyIssuer() {
        require(isIssuer[msg.sender], "Not issuer");
        _;
    }

    modifier onlyVerifier() {
        require(isVerifier[msg.sender], "Not verifier");
        _;
    }

    /* ================= CONSTRUCTOR ================= */
    constructor() {
        admin = msg.sender;
        isIssuer[msg.sender] = true;
        isVerifier[msg.sender] = true;
        isOversight[msg.sender] = true;
    }

    /* ================= ROLE ================= */
    function addIssuer(address a) external onlyAdmin {
        require(!isIssuer[a], "Already issuer");
        isIssuer[a] = true;
        emit IssuerAdded(a);
    }

    function addVerifier(address a) external onlyAdmin {
        require(!isVerifier[a], "Already verifier");
        isVerifier[a] = true;
        emit VerifierAdded(a);
    }

    /* ================= CORE ================= */

    // ALGORITHM 1
    function registerClaim(
        string calldata claimId,
        string calldata productId,
        string calldata claimType,
        string calldata evidenceId,
        uint64 expiryDate,
        bytes32 hash
    ) external onlyIssuer {

        bytes32 key = keccak256(bytes(claimId));
        require(!claims[key].exists, "Exists");

        claims[key] = Claim({
            claimId: claimId,
            productId: productId,
            claimType: claimType,
            issuer: msg.sender,
            status: ClaimStatus.Registered,
            createdAt: uint64(block.timestamp),
            evidence: Evidence(evidenceId, expiryDate, hash),
            exists: true
        });

        emit ClaimRegistered(claimId);
    }

    // ALGORITHM 2
    function verifyClaim(
        string calldata claimId,
        bool approved
    ) external onlyVerifier {

        bytes32 key = keccak256(bytes(claimId));
        Claim storage c = claims[key];
        require(c.exists, "Not found");

        if (c.status == ClaimStatus.Registered) {
            c.status = ClaimStatus.UnderReview;
        }

        if (approved && block.timestamp <= c.evidence.expiryDate) {
            c.status = ClaimStatus.Active;
        }

        verifications[key].push(
            Verification(msg.sender, approved, uint64(block.timestamp))
        );

        emit ClaimVerified(claimId, approved);
    }

    // ALGORITHM 3
    function checkExpiry(string calldata claimId) external {
        bytes32 key = keccak256(bytes(claimId));
        Claim storage c = claims[key];

        require(c.status == ClaimStatus.Active, "Not active");

        if (block.timestamp > c.evidence.expiryDate) {
            c.status = ClaimStatus.Expired;
            emit StatusChanged(claimId, ClaimStatus.Expired);
        }
    }

    function renewClaim(
        string calldata claimId,
        string calldata newEvidenceId,
        uint64 newExpiry,
        bytes32 newHash
    ) external {

        bytes32 key = keccak256(bytes(claimId));
        Claim storage c = claims[key];

        require(
            c.status == ClaimStatus.Expired ||
            c.status == ClaimStatus.Suspended,
            "Cannot renew"
        );

        c.evidence = Evidence(newEvidenceId, newExpiry, newHash);
        c.status = ClaimStatus.UnderReview;

        emit StatusChanged(claimId, ClaimStatus.UnderReview);
    }

    function suspendClaim(string calldata claimId) external {
        bytes32 key = keccak256(bytes(claimId));
        Claim storage c = claims[key];

        require(c.status == ClaimStatus.Active, "Not active");

        c.status = ClaimStatus.Suspended;
        emit StatusChanged(claimId, ClaimStatus.Suspended);
    }

    function withdrawClaim(string calldata claimId) external {
        bytes32 key = keccak256(bytes(claimId));
        Claim storage c = claims[key];

        require(
            msg.sender == c.issuer || isOversight[msg.sender],
            "Not allowed"
        );

        c.status = ClaimStatus.Withdrawn;
        emit StatusChanged(claimId, ClaimStatus.Withdrawn);
    }

    /* ================= QUERY ================= */

    function getClaimStatus(string calldata claimId)
        external view returns (ClaimStatus)
    {
        return claims[keccak256(bytes(claimId))].status;
    }

    function getVerificationCount(string calldata claimId)
        external view returns (uint)
    {
        return verifications[keccak256(bytes(claimId))].length;
    }

    function getVerificationByIndex(string calldata claimId, uint i)
        external view returns (address, bool, uint64)
    {
        Verification storage v = verifications[keccak256(bytes(claimId))][i];
        return (v.verifier, v.approved, v.time);
    }
}
