const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema(
  {
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: [true, 'Vehicle reference is required'],
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Seller reference is required'],
    },
    title: {
      type: String,
      required: [true, 'Listing title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [3000, 'Description cannot exceed 3000 characters'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    currency: {
      type: String,
      enum: ['USD', 'EUR', 'GBP', 'ETH'],
      default: 'USD',
    },
    negotiable: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'pending_sale', 'sold', 'withdrawn'],
      default: 'active',
    },
    location: {
      city: String,
      state: String,
      country: String,
    },
    contactInfo: {
      showEmail: { type: Boolean, default: false },
      showPhone: { type: Boolean, default: false },
      preferredContact: {
        type: String,
        enum: ['email', 'phone', 'platform'],
        default: 'platform',
      },
    },
    // Counters
    viewCount: { type: Number, default: 0 },
    favoriteCount: { type: Number, default: 0 },
    // Featured / promoted
    isFeatured: { type: Boolean, default: false },
    featuredUntil: { type: Date },
    // Moderation
    isApproved: { type: Boolean, default: true },
    moderationNote: String,
    // Sold info
    soldAt: { type: Date },
    soldPrice: { type: Number },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // Blockchain escrow (future)
    escrowContractAddress: { type: String },
    escrowTransactionHash: { type: String },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
listingSchema.index({ seller: 1 });
listingSchema.index({ vehicle: 1 });
listingSchema.index({ status: 1 });
listingSchema.index({ price: 1 });
listingSchema.index({ isFeatured: 1, status: 1 });
listingSchema.index({ createdAt: -1 });
// Text search index
listingSchema.index({ title: 'text', description: 'text' });

const Listing = mongoose.model('Listing', listingSchema);

module.exports = Listing;
