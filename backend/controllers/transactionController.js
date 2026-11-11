const Transaction = require('../models/Transaction');
const Listing = require('../models/Listing');
const Vehicle = require('../models/Vehicle');
const User = require('../models/User');

/**
 * @desc    Initiate a vehicle purchase (creates escrow order)
 * @route   POST /api/transactions
 * @access  Private (Buyer)
 */
exports.initiatePurchase = async (req, res, next) => {
  try {
    const { listingId, buyerNote, isWeb3, escrowTransactionHash, escrowOrderId } = req.body;

    if (!listingId) {
      return res.status(400).json({ success: false, error: 'Listing ID is required' });
    }

    const listing = await Listing.findById(listingId).populate('vehicle seller');
    if (!listing) {
      return res.status(404).json({ success: false, error: 'Listing not found' });
    }

    if (listing.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: `Listing is not available for purchase (current status: ${listing.status})`,
      });
    }

    // Ensure buyer cannot purchase their own vehicle
    if (listing.seller._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        error: 'You cannot purchase your own vehicle listing',
      });
    }

    const vehicle = await Vehicle.findById(listing.vehicle._id);
    if (!vehicle) {
      return res.status(404).json({ success: false, error: 'Vehicle record not found' });
    }

    // Check if an existing open transaction is already underway for this listing
    const existingTx = await Transaction.findOne({
      listing: listing._id,
      status: { $in: ['initiated', 'escrow_pending', 'funds_locked', 'ownership_transferred'] },
    });

    if (existingTx) {
      return res.status(400).json({
        success: false,
        error: 'A transaction is already in progress for this vehicle',
      });
    }

    // Determine initial status & simulation flag
    const isSimulated = !Boolean(isWeb3 && escrowTransactionHash);
    const initialStatus = 'funds_locked'; // Buyer funds are immediately deposited into escrow (simulated or real on-chain)

    const transaction = new Transaction({
      listing: listing._id,
      vehicle: vehicle._id,
      buyer: req.user._id,
      seller: listing.seller._id,
      amount: listing.price,
      currency: listing.currency || 'USD',
      status: initialStatus,
      isSimulated: isSimulated,
      escrowTransactionHash: escrowTransactionHash || null,
      escrowLockedAt: new Date(),
      buyerNote: buyerNote || '',
      statusHistory: [
        {
          status: 'initiated',
          changedAt: new Date(),
          changedBy: req.user._id,
          note: 'Buyer initiated escrow vehicle purchase',
        },
        {
          status: 'funds_locked',
          changedAt: new Date(),
          changedBy: req.user._id,
          note: isSimulated
            ? 'Purchase funds deposited into secure CarChain Escrow (Simulated)'
            : `Purchase funds locked on-chain in smart contract (Tx: ${escrowTransactionHash})`,
        },
      ],
    });

    await transaction.save();

    // Mark listing as pending_sale
    listing.status = 'pending_sale';
    await listing.save();

    const populatedTx = await Transaction.findById(transaction._id)
      .populate('vehicle')
      .populate('seller', 'firstName lastName email walletAddress phone')
      .populate('buyer', 'firstName lastName email walletAddress phone');

    res.status(201).json({
      success: true,
      message: isSimulated
        ? 'Escrow purchase initiated! Funds are safely held in CarChain Escrow.'
        : 'On-chain escrow purchase confirmed! Funds locked in smart contract.',
      data: populatedTx,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Buyer confirms physical handover of the vehicle
 * @route   POST /api/transactions/:id/confirm-handover
 * @access  Private (Buyer only)
 */
exports.confirmHandover = async (req, res, next) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('vehicle')
      .populate('listing')
      .populate('seller', 'name email');

    if (!transaction) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    if (transaction.buyer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Only the designated buyer can confirm vehicle handover',
      });
    }

    if (transaction.status !== 'funds_locked') {
      return res.status(400).json({
        success: false,
        error: `Cannot confirm handover in current transaction state: ${transaction.status}`,
      });
    }

    const { handoverNotes, releaseTxHash } = req.body;

    // 1. Update vehicle ownership
    const vehicle = await Vehicle.findById(transaction.vehicle._id);
    if (!vehicle) {
      return res.status(404).json({ success: false, error: 'Vehicle not found' });
    }

    const buyerUser = await User.findById(transaction.buyer);
    const sellerUser = await User.findById(transaction.seller);

    // Close seller's ownership history entry
    if (vehicle.ownershipHistory && vehicle.ownershipHistory.length > 0) {
      const lastEntry = vehicle.ownershipHistory[vehicle.ownershipHistory.length - 1];
      if (!lastEntry.transferredAt) {
        lastEntry.transferredAt = new Date();
      }
    }

    // Append buyer's new ownership entry
    const buyerName = (buyerUser.firstName + ' ' + buyerUser.lastName).trim() || buyerUser.name || 'Verified Buyer';
    vehicle.ownershipHistory.push({
      owner: buyerUser._id,
      ownerName: buyerName,
      acquiredAt: new Date(),
      transferMethod: 'purchase',
      transactionHash: releaseTxHash || transaction.escrowTransactionHash || null,
    });

    vehicle.currentOwner = buyerUser._id;
    vehicle.activeListing = null;
    await vehicle.save();

    // 2. Mark listing as sold
    await Listing.findByIdAndUpdate(transaction.listing._id, { status: 'sold' });

    // 3. Update transaction status
    transaction.status = 'ownership_transferred';
    transaction.ownershipTransferredAt = new Date();
    if (releaseTxHash) {
      transaction.releaseTransactionHash = releaseTxHash;
    }

    transaction.statusHistory.push({
      status: 'ownership_transferred',
      changedAt: new Date(),
      changedBy: req.user._id,
      note: handoverNotes || 'Buyer verified vehicle condition and confirmed physical handover',
    });

    await transaction.save();

    res.json({
      success: true,
      message: 'Vehicle handover confirmed! Ownership has been officially transferred in the Digital Passport.',
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Complete transaction (Seller releases / receives funds)
 * @route   POST /api/transactions/:id/complete
 * @access  Private (Seller or Admin)
 */
exports.completeTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    const isSeller = transaction.seller.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isSeller && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only the seller or administrator can complete this transaction',
      });
    }

    if (transaction.status !== 'ownership_transferred' && transaction.status !== 'funds_locked') {
      return res.status(400).json({
        success: false,
        error: `Transaction cannot be completed from status: ${transaction.status}`,
      });
    }

    transaction.status = 'completed';
    transaction.completedAt = new Date();
    transaction.statusHistory.push({
      status: 'completed',
      changedAt: new Date(),
      changedBy: req.user._id,
      note: 'Transaction finalized: Escrow funds settled and dispersed to seller',
    });

    await transaction.save();

    res.json({
      success: true,
      message: 'Transaction successfully completed! Escrow funds released.',
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Cancel transaction and refund escrow funds
 * @route   POST /api/transactions/:id/cancel
 * @access  Private (Buyer, Seller, or Admin)
 */
exports.cancelTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    const isBuyer = transaction.buyer.toString() === req.user._id.toString();
    const isSeller = transaction.seller.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isBuyer && !isSeller && !isAdmin) {
      return res.status(403).json({ success: false, error: 'Unauthorized to cancel this transaction' });
    }

    if (transaction.status === 'ownership_transferred' || transaction.status === 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel transaction after vehicle ownership has been transferred',
      });
    }

    const { reason } = req.body;

    transaction.status = 'refunded';
    transaction.cancelledAt = new Date();
    transaction.statusHistory.push({
      status: 'refunded',
      changedAt: new Date(),
      changedBy: req.user._id,
      note: `Escrow cancelled and refunded. Reason: ${reason || 'Mutual cancellation'}`,
    });

    await transaction.save();

    // Reopen listing
    await Listing.findByIdAndUpdate(transaction.listing, { status: 'active' });

    res.json({
      success: true,
      message: 'Transaction cancelled and escrow deposit refunded to buyer.',
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current user's purchases
 * @route   GET /api/transactions/my-purchases
 * @access  Private
 */
exports.getMyPurchases = async (req, res, next) => {
  try {
    const transactions = await Transaction.find({ buyer: req.user._id })
      .populate('vehicle')
      .populate('listing')
      .populate('seller', 'firstName lastName email phone walletAddress')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: transactions.length,
      data: transactions,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current user's sales / incoming escrow orders
 * @route   GET /api/transactions/my-sales
 * @access  Private
 */
exports.getMySales = async (req, res, next) => {
  try {
    const transactions = await Transaction.find({ seller: req.user._id })
      .populate('vehicle')
      .populate('listing')
      .populate('buyer', 'firstName lastName email phone walletAddress')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: transactions.length,
      data: transactions,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single transaction by ID
 * @route   GET /api/transactions/:id
 * @access  Private
 */
exports.getTransactionById = async (req, res, next) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('vehicle')
      .populate('listing')
      .populate('seller', 'firstName lastName email phone walletAddress')
      .populate('buyer', 'firstName lastName email phone walletAddress');

    if (!transaction) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    const isParty =
      transaction.buyer._id.toString() === req.user._id.toString() ||
      transaction.seller._id.toString() === req.user._id.toString() ||
      req.user.role === 'admin';

    if (!isParty) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    res.json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
};
