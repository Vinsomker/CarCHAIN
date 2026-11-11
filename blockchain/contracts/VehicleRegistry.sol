// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title VehicleRegistry
 * @dev CarChain ERC721 Digital Vehicle Passport Registry.
 * Each minted NFT represents an immutable digital twin of a vehicle identified by its unique VIN.
 * Includes tamper-evident anti-rollback odometer tracking, certified maintenance records, and inspection logs.
 */
contract VehicleRegistry is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId = 1;

    struct ServiceRecord {
        string serviceType;
        uint256 mileage;
        string recordHash;
        uint256 timestamp;
        address recordedBy;
    }

    struct InspectionRecord {
        string result; // "passed", "failed", "conditional"
        uint256 mileage;
        string certHash;
        uint256 timestamp;
        address inspector;
    }

    struct VehicleData {
        string vin;
        uint256 currentMileage;
        uint256 mintedAt;
        bool exists;
    }

    // Mapping tokenId => VehicleData
    mapping(uint256 => VehicleData) public vehicles;

    // Mapping VIN hash (keccak256) => tokenId
    mapping(bytes32 => uint256) public vinToTokenId;

    // Maintenance & inspection history
    mapping(uint256 => ServiceRecord[]) private _serviceHistory;
    mapping(uint256 => InspectionRecord[]) private _inspectionHistory;

    // Certified roles authorized to record entries
    mapping(address => bool) public authorizedGarages;
    mapping(address => bool) public authorizedInspectors;

    // Events
    event PassportMinted(
        uint256 indexed tokenId,
        address indexed owner,
        string vin,
        uint256 initialMileage,
        string tokenURI
    );
    event MileageUpdated(
        uint256 indexed tokenId,
        uint256 previousMileage,
        uint256 newMileage,
        address indexed updatedBy
    );
    event ServiceRecorded(
        uint256 indexed tokenId,
        string serviceType,
        uint256 mileage,
        string recordHash,
        address indexed garage
    );
    event InspectionRecorded(
        uint256 indexed tokenId,
        string result,
        uint256 mileage,
        string certHash,
        address indexed inspector
    );
    event GarageAuthorizationChanged(address indexed garage, bool authorized);
    event InspectorAuthorizationChanged(address indexed inspector, bool authorized);

    modifier onlyAuthorizedGarage() {
        require(
            authorizedGarages[msg.sender] || msg.sender == owner(),
            "VehicleRegistry: Caller is not an authorized garage"
        );
        _;
    }

    modifier onlyAuthorizedInspector() {
        require(
            authorizedInspectors[msg.sender] || msg.sender == owner(),
            "VehicleRegistry: Caller is not an authorized inspector"
        );
        _;
    }

    modifier vehicleExists(uint256 tokenId) {
        require(vehicles[tokenId].exists, "VehicleRegistry: Vehicle does not exist");
        _;
    }

    constructor(address initialOwner) ERC721("CarChain Digital Passport", "CCDP") Ownable(initialOwner) {}

    // ─── Admin Role Management ──────────────────────────────────────────────────

    function setGarageAuthorization(address garage, bool authorized) external onlyOwner {
        require(garage != address(0), "VehicleRegistry: Invalid address");
        authorizedGarages[garage] = authorized;
        emit GarageAuthorizationChanged(garage, authorized);
    }

    function setInspectorAuthorization(address inspector, bool authorized) external onlyOwner {
        require(inspector != address(0), "VehicleRegistry: Invalid address");
        authorizedInspectors[inspector] = authorized;
        emit InspectorAuthorizationChanged(inspector, authorized);
    }

    // ─── Passport Minting ───────────────────────────────────────────────────────

    /**
     * @notice Mint a new Digital Vehicle Passport NFT.
     * @param to Owner address to receive the NFT passport
     * @param vin Unique 17-character Vehicle Identification Number
     * @param tokenURI Decentralized metadata URI (e.g. IPFS / HTTPS JSON)
     * @param initialMileage Starting mileage of the vehicle
     */
    function mintPassport(
        address to,
        string memory vin,
        string memory tokenURI,
        uint256 initialMileage
    ) external returns (uint256) {
        bytes32 vinHash = keccak256(abi.encodePacked(vin));
        require(vinToTokenId[vinHash] == 0, "VehicleRegistry: VIN already minted");
        require(bytes(vin).length == 17, "VehicleRegistry: VIN must be 17 characters");
        require(to != address(0), "VehicleRegistry: Invalid recipient address");

        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);

        vehicles[tokenId] = VehicleData({
            vin: vin,
            currentMileage: initialMileage,
            mintedAt: block.timestamp,
            exists: true
        });

        vinToTokenId[vinHash] = tokenId;

        emit PassportMinted(tokenId, to, vin, initialMileage, tokenURI);
        return tokenId;
    }

    // ─── Tamper-evident Mileage & Record Updates ───────────────────────────────

    /**
     * @notice Update vehicle mileage with strict anti-rollback validation.
     * @dev Mileage can never decrease.
     */
    function updateMileage(uint256 tokenId, uint256 newMileage)
        public
        vehicleExists(tokenId)
    {
        // Allow vehicle owner, approved garage, inspector, or contract owner
        require(
            _isAuthorized(ownerOf(tokenId), msg.sender, tokenId) ||
            authorizedGarages[msg.sender] ||
            authorizedInspectors[msg.sender] ||
            msg.sender == owner(),
            "VehicleRegistry: Not authorized to update mileage"
        );

        uint256 current = vehicles[tokenId].currentMileage;
        require(
            newMileage >= current,
            "VehicleRegistry: Anti-rollback violation: New mileage cannot be lower than current mileage"
        );

        vehicles[tokenId].currentMileage = newMileage;
        emit MileageUpdated(tokenId, current, newMileage, msg.sender);
    }

    /**
     * @notice Record a certified maintenance service on-chain.
     */
    function recordService(
        uint256 tokenId,
        string memory serviceType,
        uint256 mileage,
        string memory recordHash
    ) external onlyAuthorizedGarage vehicleExists(tokenId) {
        // Enforce mileage anti-rollback
        if (mileage > vehicles[tokenId].currentMileage) {
            updateMileage(tokenId, mileage);
        } else {
            require(
                mileage == vehicles[tokenId].currentMileage,
                "VehicleRegistry: Service mileage cannot be less than current odometer reading"
            );
        }

        _serviceHistory[tokenId].push(
            ServiceRecord({
                serviceType: serviceType,
                mileage: mileage,
                recordHash: recordHash,
                timestamp: block.timestamp,
                recordedBy: msg.sender
            })
        );

        emit ServiceRecorded(tokenId, serviceType, mileage, recordHash, msg.sender);
    }

    /**
     * @notice Record a certified vehicle safety inspection on-chain.
     */
    function recordInspection(
        uint256 tokenId,
        string memory result,
        uint256 mileage,
        string memory certHash
    ) external onlyAuthorizedInspector vehicleExists(tokenId) {
        // Enforce mileage anti-rollback
        if (mileage > vehicles[tokenId].currentMileage) {
            updateMileage(tokenId, mileage);
        } else {
            require(
                mileage == vehicles[tokenId].currentMileage,
                "VehicleRegistry: Inspection mileage cannot be less than current odometer reading"
            );
        }

        _inspectionHistory[tokenId].push(
            InspectionRecord({
                result: result,
                mileage: mileage,
                certHash: certHash,
                timestamp: block.timestamp,
                inspector: msg.sender
            })
        );

        emit InspectionRecorded(tokenId, result, mileage, certHash, msg.sender);
    }

    // ─── Query / Read Functions ────────────────────────────────────────────────

    function getVehicle(uint256 tokenId)
        external
        view
        vehicleExists(tokenId)
        returns (
            string memory vin,
            uint256 currentMileage,
            uint256 mintedAt,
            address ownerAddr,
            string memory uri
        )
    {
        VehicleData memory v = vehicles[tokenId];
        return (v.vin, v.currentMileage, v.mintedAt, ownerOf(tokenId), tokenURI(tokenId));
    }

    function getTokenIdByVin(string memory vin) external view returns (uint256) {
        bytes32 vinHash = keccak256(abi.encodePacked(vin));
        uint256 tokenId = vinToTokenId[vinHash];
        require(tokenId != 0, "VehicleRegistry: VIN not found");
        return tokenId;
    }

    function getServiceHistory(uint256 tokenId)
        external
        view
        vehicleExists(tokenId)
        returns (ServiceRecord[] memory)
    {
        return _serviceHistory[tokenId];
    }

    function getInspectionHistory(uint256 tokenId)
        external
        view
        vehicleExists(tokenId)
        returns (InspectionRecord[] memory)
    {
        return _inspectionHistory[tokenId];
    }

    function totalMinted() external view returns (uint256) {
        return _nextTokenId - 1;
    }
}
