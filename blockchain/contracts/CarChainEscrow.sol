// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./VehicleRegistry.sol";

/**
 * @title CarChainEscrow
 * @dev Secure peer-to-peer escrow contract for vehicle purchases on CarChain.
 * Holds funds securely until vehicle handover is confirmed by the buyer,
 * at which point funds are released to the seller and the NFT passport is transferred to the buyer.
 */
contract CarChainEscrow is Ownable, ReentrancyGuard {
    enum EscrowState {
        Created,
        Funded,
        HandoverConfirmed,
        Completed,
        Refunded
    }

    struct EscrowOrder {
        uint256 orderId;
        uint256 tokenId;
        string vin;
        address payable buyer;
        address payable seller;
        uint256 amount;
        EscrowState state;
        bool buyerConfirmed;
        bool sellerConfirmed;
        uint256 createdAt;
        uint256 completedAt;
    }

    VehicleRegistry public vehicleRegistry;
    uint256 private _orderIdCounter = 1;

    mapping(uint256 => EscrowOrder) public orders;
    mapping(uint256 => uint256) public activeOrderByTokenId;

    event EscrowCreated(
        uint256 indexed orderId,
        uint256 indexed tokenId,
        string vin,
        address indexed buyer,
        address seller,
        uint256 amount
    );
    event EscrowFunded(uint256 indexed orderId, uint256 amount, address indexed buyer);
    event HandoverConfirmed(uint256 indexed orderId, address indexed buyer);
    event FundsReleased(uint256 indexed orderId, address indexed seller, uint256 amount);
    event EscrowRefunded(uint256 indexed orderId, address indexed buyer, uint256 amount);
    event VehicleRegistryUpdated(address indexed newRegistry);

    modifier onlyBuyer(uint256 orderId) {
        require(msg.sender == orders[orderId].buyer, "CarChainEscrow: Caller is not the buyer");
        _;
    }

    modifier onlySeller(uint256 orderId) {
        require(msg.sender == orders[orderId].seller, "CarChainEscrow: Caller is not the seller");
        _;
    }

    modifier onlyPartiesOrOwner(uint256 orderId) {
        require(
            msg.sender == orders[orderId].buyer ||
            msg.sender == orders[orderId].seller ||
            msg.sender == owner(),
            "CarChainEscrow: Unauthorized"
        );
        _;
    }

    constructor(address _vehicleRegistryAddress, address initialOwner) Ownable(initialOwner) {
        if (_vehicleRegistryAddress != address(0)) {
            vehicleRegistry = VehicleRegistry(_vehicleRegistryAddress);
        }
    }

    function setVehicleRegistry(address _vehicleRegistryAddress) external onlyOwner {
        require(_vehicleRegistryAddress != address(0), "CarChainEscrow: Invalid address");
        vehicleRegistry = VehicleRegistry(_vehicleRegistryAddress);
        emit VehicleRegistryUpdated(_vehicleRegistryAddress);
    }

    /**
     * @notice Create and lock funds for vehicle purchase escrow in a single step.
     * @param tokenId VehicleRegistry NFT tokenId (0 if minted off-chain or before minting)
     * @param vin 17-character VIN
     * @param seller Seller recipient address
     */
    function createAndFundEscrow(
        uint256 tokenId,
        string memory vin,
        address payable seller
    ) external payable nonReentrant returns (uint256) {
        require(msg.value > 0, "CarChainEscrow: Escrow deposit amount must be > 0");
        require(seller != address(0), "CarChainEscrow: Invalid seller address");
        require(seller != msg.sender, "CarChainEscrow: Buyer and seller cannot be the same");

        uint256 orderId = _orderIdCounter++;
        orders[orderId] = EscrowOrder({
            orderId: orderId,
            tokenId: tokenId,
            vin: vin,
            buyer: payable(msg.sender),
            seller: seller,
            amount: msg.value,
            state: EscrowState.Funded,
            buyerConfirmed: false,
            sellerConfirmed: false,
            createdAt: block.timestamp,
            completedAt: 0
        });

        if (tokenId > 0) {
            activeOrderByTokenId[tokenId] = orderId;
        }

        emit EscrowCreated(orderId, tokenId, vin, msg.sender, seller, msg.value);
        emit EscrowFunded(orderId, msg.value, msg.sender);

        return orderId;
    }

    /**
     * @notice Buyer confirms physical handover/delivery of the vehicle.
     * @dev Automatically releases escrow funds to seller if both conditions met.
     */
    function confirmHandover(uint256 orderId) external onlyBuyer(orderId) nonReentrant {
        EscrowOrder storage order = orders[orderId];
        require(
            order.state == EscrowState.Funded,
            "CarChainEscrow: Order must be in Funded state to confirm handover"
        );

        order.buyerConfirmed = true;
        order.state = EscrowState.HandoverConfirmed;

        emit HandoverConfirmed(orderId, msg.sender);

        // Immediately finalize release to seller
        _releaseFundsInternal(orderId);
    }

    /**
     * @notice Admin or Buyer manual release trigger after handover confirmed.
     */
    function releaseFunds(uint256 orderId) external nonReentrant {
        EscrowOrder storage order = orders[orderId];
        require(
            order.state == EscrowState.HandoverConfirmed ||
            (msg.sender == owner() && order.state == EscrowState.Funded),
            "CarChainEscrow: Cannot release funds in current state"
        );
        require(
            msg.sender == order.buyer || msg.sender == owner(),
            "CarChainEscrow: Only buyer or admin can release funds"
        );

        _releaseFundsInternal(orderId);
    }

    /**
     * @dev Internal fund release execution and optional NFT transfer.
     */
    function _releaseFundsInternal(uint256 orderId) internal {
        EscrowOrder storage order = orders[orderId];
        require(order.amount > 0, "CarChainEscrow: Zero balance");

        order.state = EscrowState.Completed;
        order.completedAt = block.timestamp;
        uint256 payout = order.amount;
        order.amount = 0;

        // Try to transfer NFT if contract is approved and tokenId > 0
        if (address(vehicleRegistry) != address(0) && order.tokenId > 0) {
            try vehicleRegistry.ownerOf(order.tokenId) returns (address currentOwner) {
                if (currentOwner == order.seller) {
                    // Check if approved
                    if (
                        vehicleRegistry.getApproved(order.tokenId) == address(this) ||
                        vehicleRegistry.isApprovedForAll(order.seller, address(this))
                    ) {
                        vehicleRegistry.safeTransferFrom(order.seller, order.buyer, order.tokenId);
                    }
                }
            } catch {
                // If transfer fails or registry reverts, continue fund release
            }
        }

        // Payout to seller
        (bool success, ) = order.seller.call{value: payout}("");
        require(success, "CarChainEscrow: Seller transfer failed");

        emit FundsReleased(orderId, order.seller, payout);
    }

    /**
     * @notice Refund buyer in case of dispute, vehicle rejection, or seller cancellation.
     */
    function refundBuyer(uint256 orderId) external onlyPartiesOrOwner(orderId) nonReentrant {
        EscrowOrder storage order = orders[orderId];
        require(
            order.state == EscrowState.Funded || order.state == EscrowState.HandoverConfirmed,
            "CarChainEscrow: Cannot refund in current state"
        );

        // Only seller can willingly refund without admin, or admin can intervene
        require(
            msg.sender == order.seller || msg.sender == owner(),
            "CarChainEscrow: Only seller or admin can authorize a refund"
        );

        order.state = EscrowState.Refunded;
        order.completedAt = block.timestamp;
        uint256 refundAmount = order.amount;
        order.amount = 0;

        (bool success, ) = order.buyer.call{value: refundAmount}("");
        require(success, "CarChainEscrow: Buyer refund transfer failed");

        emit EscrowRefunded(orderId, order.buyer, refundAmount);
    }

    // ─── View Functions ────────────────────────────────────────────────────────

    function getOrder(uint256 orderId)
        external
        view
        returns (
            uint256 id,
            uint256 tokenId,
            string memory vin,
            address buyer,
            address seller,
            uint256 amount,
            EscrowState state,
            bool buyerConfirmed,
            uint256 createdAt,
            uint256 completedAt
        )
    {
        EscrowOrder memory o = orders[orderId];
        return (
            o.orderId,
            o.tokenId,
            o.vin,
            o.buyer,
            o.seller,
            o.amount,
            o.state,
            o.buyerConfirmed,
            o.createdAt,
            o.completedAt
        );
    }

    function totalOrders() external view returns (uint256) {
        return _orderIdCounter - 1;
    }
}
