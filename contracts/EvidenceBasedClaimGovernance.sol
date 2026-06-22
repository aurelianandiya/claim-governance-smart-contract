// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Evidence-Based Claim Governance
/// @notice Proof-of-concept governance record layer for cosmetic sustainability claims.
/// @dev Substantive evidence remains off-chain. The contract stores claim metadata,
///      the current evidence reference, role-authorised verification records, and
///      current claim status. Evidence-linkage and status histories are reconstructed
///      from emitted events.
contract EvidenceBasedClaimGovernance {

    /* ================= ENUM ================= */
    enum ClaimStatus {
        None,
        Registered,
        UnderReview,
        Active,
        Expired,
        Suspended,
        Withdrawn
    }

    /* ================= STRUCTS ================= */
    struct Evidence {
        string evidenceId;
        uint64 validUntil;
        bytes32 evidenceHash;
    }

    struct Claim {
        string claimId;
        string productId;
        string claimType;
        string claimDescription;
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
        bytes32 evidenceHash;
    }

    struct ClaimRegistrationInput {
        string claimId;
        string productId;
        string claimType;
        string claimDescription;
        string evidenceId;
        uint64 evidenceValidUntil;
        bytes32 evidenceHash;
    }

    /* ================= STORAGE ================= */
    address public admin;

    mapping(address => bool) public isIssuer;
    mapping(address => bool) public isVerifier;
    mapping(address => bool) public isOversight;

    mapping(bytes32 => Claim) private _claims;
    mapping(bytes32 => Verification[]) private _verifications;

    /* ================= EVENTS ================= */
    event ClaimRegistered(
        bytes32 indexed claimKey,
        address indexed issuer,
        uint64 time
    );

    event EvidenceLinked(
        bytes32 indexed claimKey,
        string evidenceId,
        uint64 validUntil,
        bytes32 evidenceHash,
        address indexed actor,
        uint64 time
    );

    event ClaimVerified(
        bytes32 indexed claimKey,
        bool approved,
        bytes32 evidenceHash,
        address indexed verifier,
        uint64 time
    );

    event StatusChanged(
        bytes32 indexed claimKey,
        ClaimStatus status,
        address indexed actor,
        uint64 time
    );

    event IssuerAdded(address indexed issuer);
    event VerifierAdded(address indexed verifier);
    event OversightAdded(address indexed oversight);
    event RoleRevoked(address indexed account, string role);

    /* ================= MODIFIERS ================= */
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

    modifier onlyOversight() {
        require(isOversight[msg.sender], "Not oversight");
        _;
    }

    /* ================= CONSTRUCTOR ================= */
    /// @dev The deployer receives bootstrap roles. Functional validation should
    ///      assign issuer and verifier roles to distinct test accounts.
    constructor() {
        admin = msg.sender;
        isIssuer[msg.sender] = true;
        isVerifier[msg.sender] = true;
        isOversight[msg.sender] = true;

        emit IssuerAdded(msg.sender);
        emit VerifierAdded(msg.sender);
        emit OversightAdded(msg.sender);
    }

    /* ================= ROLE MANAGEMENT ================= */
    function addIssuer(address account) external onlyAdmin {
        require(account != address(0), "Zero address");
        require(!isIssuer[account], "Already issuer");
        isIssuer[account] = true;
        emit IssuerAdded(account);
    }

    function addVerifier(address account) external onlyAdmin {
        require(account != address(0), "Zero address");
        require(!isVerifier[account], "Already verifier");
        isVerifier[account] = true;
        emit VerifierAdded(account);
    }

    function addOversight(address account) external onlyAdmin {
        require(account != address(0), "Zero address");
        require(!isOversight[account], "Already oversight");
        isOversight[account] = true;
        emit OversightAdded(account);
    }

    function revokeIssuer(address account) external onlyAdmin {
        require(isIssuer[account], "Not issuer");
        isIssuer[account] = false;
        emit RoleRevoked(account, "issuer");
    }

    function revokeVerifier(address account) external onlyAdmin {
        require(isVerifier[account], "Not verifier");
        isVerifier[account] = false;
        emit RoleRevoked(account, "verifier");
    }

    function revokeOversight(address account) external onlyAdmin {
        require(isOversight[account], "Not oversight");
        isOversight[account] = false;
        emit RoleRevoked(account, "oversight");
    }

    /* ================= ALGORITHM S1 ================= */
    /// @notice Registers a claim specification and binds its initial evidence reference.
    function registerClaim(ClaimRegistrationInput calldata input)
        external
        onlyIssuer
    {
        require(bytes(input.claimId).length != 0, "Empty claim ID");
        require(bytes(input.productId).length != 0, "Empty product ID");
        require(bytes(input.claimType).length != 0, "Empty claim type");
        require(
            bytes(input.claimDescription).length != 0,
            "Empty claim description"
        );
        _validateEvidence(
            input.evidenceId,
            input.evidenceValidUntil,
            input.evidenceHash
        );

        bytes32 key = _claimKey(input.claimId);
        require(!_claims[key].exists, "Exists");

        Claim storage claim = _claims[key];
        uint64 time = uint64(block.timestamp);

        claim.claimId = input.claimId;
        claim.productId = input.productId;
        claim.claimType = input.claimType;
        claim.claimDescription = input.claimDescription;
        claim.issuer = msg.sender;
        claim.status = ClaimStatus.Registered;
        claim.createdAt = time;
        claim.evidence = Evidence({
            evidenceId: input.evidenceId,
            validUntil: input.evidenceValidUntil,
            evidenceHash: input.evidenceHash
        });
        claim.exists = true;

        _emitRegistrationEvents(key, claim, msg.sender, time);
    }

    /* ================= ALGORITHM S3: REVIEW SUBMISSION ================= */
    /// @notice Submits a registered claim for authorised review.
    function submitForReview(string calldata claimId) external onlyIssuer {
        bytes32 key = _claimKey(claimId);
        Claim storage claim = _claims[key];

        require(claim.exists, "Not found");
        require(msg.sender == claim.issuer, "Only claim issuer");
        require(claim.status == ClaimStatus.Registered, "Not registered");
        require(block.timestamp <= claim.evidence.validUntil, "Evidence expired");

        claim.status = ClaimStatus.UnderReview;
        emit StatusChanged(
            key,
            ClaimStatus.UnderReview,
            msg.sender,
            uint64(block.timestamp)
        );
    }

    /* ================= ALGORITHM S2 ================= */
    /// @notice Records an authorised verification decision for a claim under review.
    /// @dev Rejection leaves the claim UnderReview so that evidence can be revised
    ///      and resubmitted. Expired evidence must first be recorded through checkExpiry.
    function verifyClaim(
        string calldata claimId,
        bool approved
    ) external onlyVerifier {
        bytes32 key = _claimKey(claimId);
        Claim storage claim = _claims[key];

        require(claim.exists, "Not found");
        require(msg.sender != claim.issuer, "Issuer cannot self-verify");
        require(claim.status == ClaimStatus.UnderReview, "Not under review");
        require(block.timestamp <= claim.evidence.validUntil, "Evidence expired");

        uint64 time = uint64(block.timestamp);
        bytes32 reviewedEvidenceHash = claim.evidence.evidenceHash;

        _verifications[key].push(
            Verification({
                verifier: msg.sender,
                approved: approved,
                time: time,
                evidenceHash: reviewedEvidenceHash
            })
        );

        emit ClaimVerified(
            key,
            approved,
            reviewedEvidenceHash,
            msg.sender,
            time
        );

        if (approved) {
            claim.status = ClaimStatus.Active;
            emit StatusChanged(
                key,
                ClaimStatus.Active,
                msg.sender,
                time
            );
        }
    }

    /* ================= ALGORITHM S3: STATUS CONTROL ================= */
    /// @notice Records evidence expiry for a claim that has not been withdrawn or suspended.
    /// @dev Expiry is transaction-triggered; it is not automatic with the passage of time.
    function checkExpiry(string calldata claimId) external {
        bytes32 key = _claimKey(claimId);
        Claim storage claim = _claims[key];

        require(claim.exists, "Not found");
        require(
            claim.status == ClaimStatus.Registered ||
                claim.status == ClaimStatus.UnderReview ||
                claim.status == ClaimStatus.Active,
            "Not expiry-eligible"
        );
        require(block.timestamp > claim.evidence.validUntil, "Evidence still valid");

        claim.status = ClaimStatus.Expired;
        emit StatusChanged(
            key,
            ClaimStatus.Expired,
            msg.sender,
            uint64(block.timestamp)
        );
    }

    /// @notice Replaces the current evidence for renewal or resubmission.
    /// @dev Prior evidence remains reconstructable from earlier EvidenceLinked logs.
    function renewClaim(
        string calldata claimId,
        string calldata newEvidenceId,
        uint64 newEvidenceValidUntil,
        bytes32 newEvidenceHash
    ) external onlyIssuer {
        bytes32 key = _claimKey(claimId);
        Claim storage claim = _claims[key];

        require(claim.exists, "Not found");
        require(msg.sender == claim.issuer, "Only claim issuer");
        require(
            claim.status == ClaimStatus.Expired ||
                claim.status == ClaimStatus.Suspended ||
                claim.status == ClaimStatus.UnderReview,
            "Cannot renew or resubmit"
        );
        _validateEvidence(
            newEvidenceId,
            newEvidenceValidUntil,
            newEvidenceHash
        );

        ClaimStatus previousStatus = claim.status;
        uint64 time = uint64(block.timestamp);

        claim.evidence = Evidence({
            evidenceId: newEvidenceId,
            validUntil: newEvidenceValidUntil,
            evidenceHash: newEvidenceHash
        });

        emit EvidenceLinked(
            key,
            newEvidenceId,
            newEvidenceValidUntil,
            newEvidenceHash,
            msg.sender,
            time
        );

        if (previousStatus != ClaimStatus.UnderReview) {
            claim.status = ClaimStatus.UnderReview;
            emit StatusChanged(
                key,
                ClaimStatus.UnderReview,
                msg.sender,
                time
            );
        }
    }

    function suspendClaim(string calldata claimId) external onlyOversight {
        bytes32 key = _claimKey(claimId);
        Claim storage claim = _claims[key];

        require(claim.exists, "Not found");
        require(claim.status == ClaimStatus.Active, "Not active");

        claim.status = ClaimStatus.Suspended;
        emit StatusChanged(
            key,
            ClaimStatus.Suspended,
            msg.sender,
            uint64(block.timestamp)
        );
    }

    function withdrawClaim(string calldata claimId) external {
        bytes32 key = _claimKey(claimId);
        Claim storage claim = _claims[key];

        require(claim.exists, "Not found");
        require(claim.status != ClaimStatus.Withdrawn, "Already withdrawn");

        bool authorisedIssuer =
            msg.sender == claim.issuer && isIssuer[msg.sender];
        require(
            authorisedIssuer || isOversight[msg.sender],
            "Not allowed"
        );

        claim.status = ClaimStatus.Withdrawn;
        emit StatusChanged(
            key,
            ClaimStatus.Withdrawn,
            msg.sender,
            uint64(block.timestamp)
        );
    }

    /* ================= ALGORITHM S4: QUERY ================= */
    function getClaim(string calldata claimId)
        external
        view
        returns (
            string memory storedClaimId,
            string memory productId,
            string memory claimType,
            string memory claimDescription,
            address issuer,
            ClaimStatus status,
            uint64 createdAt
        )
    {
        Claim storage claim = _claims[_claimKey(claimId)];
        require(claim.exists, "Not found");
        return (
            claim.claimId,
            claim.productId,
            claim.claimType,
            claim.claimDescription,
            claim.issuer,
            claim.status,
            claim.createdAt
        );
    }

    function getEvidence(string calldata claimId)
        external
        view
        returns (
            string memory evidenceId,
            uint64 evidenceValidUntil,
            bytes32 evidenceHash
        )
    {
        Claim storage claim = _claims[_claimKey(claimId)];
        require(claim.exists, "Not found");
        return (
            claim.evidence.evidenceId,
            claim.evidence.validUntil,
            claim.evidence.evidenceHash
        );
    }

    function getClaimStatus(string calldata claimId)
        external
        view
        returns (ClaimStatus)
    {
        Claim storage claim = _claims[_claimKey(claimId)];
        require(claim.exists, "Not found");
        return claim.status;
    }

    function getVerificationCount(string calldata claimId)
        external
        view
        returns (uint256)
    {
        bytes32 key = _claimKey(claimId);
        require(_claims[key].exists, "Not found");
        return _verifications[key].length;
    }

    function getVerificationByIndex(
        string calldata claimId,
        uint256 index
    ) external view returns (Verification memory) {
        bytes32 key = _claimKey(claimId);
        require(_claims[key].exists, "Not found");
        require(index < _verifications[key].length, "Index out of bounds");
        return _verifications[key][index];
    }

    /* ================= INTERNAL HELPERS ================= */
    function _emitRegistrationEvents(
        bytes32 key,
        Claim storage claim,
        address actor,
        uint64 time
    ) private {
        emit ClaimRegistered(key, actor, time);
        emit EvidenceLinked(
            key,
            claim.evidence.evidenceId,
            claim.evidence.validUntil,
            claim.evidence.evidenceHash,
            actor,
            time
        );
        emit StatusChanged(
            key,
            ClaimStatus.Registered,
            actor,
            time
        );
    }

    function _claimKey(string calldata claimId)
        private
        pure
        returns (bytes32)
    {
        return keccak256(bytes(claimId));
    }

    function _validateEvidence(
        string calldata evidenceId,
        uint64 evidenceValidUntil,
        bytes32 evidenceHash
    ) private view {
        require(bytes(evidenceId).length != 0, "Empty evidence ID");
        require(evidenceHash != bytes32(0), "Empty evidence hash");
        require(
            evidenceValidUntil > block.timestamp,
            "Evidence validity must be future"
        );
    }
}
