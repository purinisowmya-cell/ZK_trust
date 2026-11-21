// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IssuerRegistry
 * @dev On-chain registry for trusted credential issuers in the ZK-Trust ecosystem.
 * Stores only public issuer metadata and Ed25519 public keys.
 * NEVER stores personal data, witness secrets, or individual credentials.
 * Compatible with EVM testnets (Ethereum Sepolia, Polygon Amoy, Arbitrum Sepolia).
 */
contract IssuerRegistry {
    address public owner;

    struct Issuer {
        string issuerId;       // e.g. "did:zktrust:issuer:mit-edu"
        string name;           // e.g. "MIT Academic Registrar"
        string issuerType;     // "UNIVERSITY", "GOVERNMENT", "KYC_PROVIDER", "HUMAN_ATTESTER"
        string publicKeyPem;   // Ed25519 public key (SPKI PEM format)
        bool isActive;
        uint256 registeredAt;
        uint256 updatedAt;
    }

    // Mapping from issuerId string to Issuer details
    mapping(string => Issuer) private _issuers;
    string[] private _issuerList;

    // Events for transparency and indexers
    event IssuerRegistered(
        string indexed issuerId,
        string name,
        string issuerType,
        string publicKeyPem,
        uint256 timestamp
    );

    event IssuerStatusUpdated(
        string indexed issuerId,
        bool isActive,
        uint256 timestamp
    );

    event IssuerKeyRotated(
        string indexed issuerId,
        string newPublicKeyPem,
        uint256 timestamp
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only registry owner can perform this operation");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Registers or updates a trusted issuer.
     */
    function registerIssuer(
        string calldata issuerId,
        string calldata name,
        string calldata issuerType,
        string calldata publicKeyPem
    ) external onlyOwner {
        require(bytes(issuerId).length > 0, "Issuer ID cannot be empty");
        require(bytes(publicKeyPem).length > 0, "Public key cannot be empty");

        if (_issuers[issuerId].registeredAt == 0) {
            _issuerList.push(issuerId);
            _issuers[issuerId] = Issuer({
                issuerId: issuerId,
                name: name,
                issuerType: issuerType,
                publicKeyPem: publicKeyPem,
                isActive: true,
                registeredAt: block.timestamp,
                updatedAt: block.timestamp
            });
            emit IssuerRegistered(issuerId, name, issuerType, publicKeyPem, block.timestamp);
        } else {
            _issuers[issuerId].name = name;
            _issuers[issuerId].issuerType = issuerType;
            _issuers[issuerId].publicKeyPem = publicKeyPem;
            _issuers[issuerId].isActive = true;
            _issuers[issuerId].updatedAt = block.timestamp;
            emit IssuerKeyRotated(issuerId, publicKeyPem, block.timestamp);
        }
    }

    /**
     * @notice Updates the active status of an issuer (e.g. revokes or reinstates).
     */
    function setIssuerStatus(string calldata issuerId, bool isActive) external onlyOwner {
        require(_issuers[issuerId].registeredAt != 0, "Issuer does not exist");
        _issuers[issuerId].isActive = isActive;
        _issuers[issuerId].updatedAt = block.timestamp;
        emit IssuerStatusUpdated(issuerId, isActive, block.timestamp);
    }

    /**
     * @notice Returns details of a specific issuer.
     */
    function getIssuer(string calldata issuerId) external view returns (
        string memory name,
        string memory issuerType,
        string memory publicKeyPem,
        bool isActive,
        uint256 registeredAt,
        uint256 updatedAt
    ) {
        require(_issuers[issuerId].registeredAt != 0, "Issuer not found");
        Issuer memory i = _issuers[issuerId];
        return (
            i.name,
            i.issuerType,
            i.publicKeyPem,
            i.isActive,
            i.registeredAt,
            i.updatedAt
        );
    }

    /**
     * @notice Verifies if an issuer is registered and currently active.
     */
    function isIssuerActive(string calldata issuerId) external view returns (bool) {
        return _issuers[issuerId].isActive;
    }

    /**
     * @notice Returns the total number of registered issuers.
     */
    function getIssuerCount() external view returns (uint256) {
        return _issuerList.length;
    }

    /**
     * @notice Returns the issuer ID at a specific index.
     */
    function getIssuerIdAt(uint256 index) external view returns (string memory) {
        require(index < _issuerList.length, "Index out of bounds");
        return _issuerList[index];
    }
}
