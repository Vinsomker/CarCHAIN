const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
      required: true,
    },
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0, 'Amount cannot be negative'],
    },
    currency: {
      type: String,
      enum: ['USD', 'EUR', 'GBP', 'ETH'],
      default: 'USD',
    },
    // ─── Status flow ───────────────────────────────────────────────────────────
    // initiated → escrow_pending → funds_locked → ownership_transferred → completed
    // Any state → cancelled / disputed
    status: {
      type: String,
      enum: [
        'initiated',
        'escrow_pending',
        'funds_locked',
        'ownership_transferred',
        'completed',
        'cancelled',
        'disputed',
        'refunded',
      ],
      default: 'initiated',
    },
    // ─── IMPORTANT: Simulation flag ───────────────────────────────────────────
    // All transactions are simulated until real smart contracts are deployed.
    isSimulated: {
      type: Boolean,
      default: true, // Will be set to false only after real blockchain integration
    },
    // Status history (append-only audit trail)
    statusHistory: [
      {
        status: String,
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        note: String,
      },
    ],
    // Escrow details (blockchain – future)
    escrowContractAddress: { type: String },
    escrowTransactionHash: { type: String },
    releaseTransactionHash: { type: String },
    // Timestamps for state changes
    escrowLockedAt: { type: Date },
    ownershipTransferredAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    // Notes
    buyerNote: { type: String },
    sellerNote: { type: String },
    adminNote: { type: String },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
transactionSchema.index({ buyer: 1 });
transactionSchema.index({ seller: 1 });
transactionSchema.index({ vehicle: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ createdAt: -1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
