const mongoose = require('mongoose');

// ─── Sub-schemas ─────────────────────────────────────────────────────────────

const ownershipHistorySchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    ownerName: { type: String, required: true }, // Denormalized for history integrity
    acquiredAt: { type: Date, required: true },
    transferredAt: { type: Date },
    transferMethod: {
      type: String,
      enum: ['purchase', 'gift', 'inheritance', 'auction', 'other'],
      default: 'purchase',
    },
    // Blockchain (future)
    transactionHash: { type: String },
    blockNumber: { type: Number },
  },
  { _id: true }
);

// ─── Main Vehicle Schema ──────────────────────────────────────────────────────

const vehicleSchema = new mongoose.Schema(
  {
    // Identification
    vin: {
      type: String,
      required: [true, 'VIN is required'],
      uppercase: true,
      trim: true,
      minlength: [17, 'VIN must be exactly 17 characters'],
      maxlength: [17, 'VIN must be exactly 17 characters'],
      match: [/^[A-HJ-NPR-Z0-9]{17}$/, 'VIN contains invalid characters'],
    },
    // Basic info
    make: {
      type: String,
      required: [true, 'Vehicle make is required'],
      trim: true,
    },
    model: {
      type: String,
      required: [true, 'Vehicle model is required'],
      trim: true,
    },
    year: {
      type: Number,
      required: [true, 'Manufacturing year is required'],
      min: [1886, 'Year cannot be before 1886'],
      max: [new Date().getFullYear() + 2, 'Year cannot be more than 2 years in the future'],
    },
    variant: { type: String, trim: true },
    bodyType: {
      type: String,
      enum: ['sedan', 'suv', 'hatchback', 'coupe', 'convertible', 'wagon', 'pickup', 'van', 'minivan', 'other'],
      default: 'sedan',
    },
    color: { type: String, trim: true },
    // Technical specs
    fuelType: {
      type: String,
      enum: ['gasoline', 'diesel', 'electric', 'hybrid', 'plugin_hybrid', 'hydrogen', 'lpg', 'cng', 'other'],
      required: [true, 'Fuel type is required'],
    },
    transmission: {
      type: String,
      enum: ['manual', 'automatic', 'semi_automatic', 'cvt', 'other'],
      required: [true, 'Transmission type is required'],
    },
    engineSize: { type: String, trim: true }, // e.g. "2.0L"
    horsepower: { type: Number, min: 0 },
    doors: { type: Number, min: 2, max: 7 },
    seats: { type: Number, min: 1, max: 20 },
    driveType: {
      type: String,
      enum: ['fwd', 'rwd', 'awd', '4wd', 'other'],
    },
    // Mileage (tamper-evident: append-only via dedicated routes)
    currentMileage: {
      type: Number,
      required: [true, 'Current mileage is required'],
      min: [0, 'Mileage cannot be negative'],
    },
    mileageUnit: {
      type: String,
      enum: ['km', 'miles'],
      default: 'km',
    },
    mileageHistory: [
      {
        mileage: { type: Number, required: true },
        recordedAt: { type: Date, default: Date.now },
        recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        source: {
          type: String,
          enum: ['registration', 'maintenance', 'inspection', 'sale', 'manual'],
          default: 'manual',
        },
        note: String,
      },
    ],
    // Images
    images: [
      {
        url: { type: String, required: true },
        caption: String,
        isPrimary: { type: Boolean, default: false },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    // Ownership
    currentOwner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Current owner is required'],
    },
    ownershipHistory: [ownershipHistorySchema],
    // Registration
    registrationCountry: { type: String, trim: true },
    registrationPlate: { type: String, trim: true, uppercase: true },
    registrationDate: { type: Date },
    // Status flags
    hasAccidentHistory: { type: Boolean, default: false },
    isWrittenOff: { type: Boolean, default: false },
    isStolen: { type: Boolean, default: false },
    // Verification
    passportStatus: {
      type: String,
      enum: ['unverified', 'partial', 'verified'],
      default: 'unverified',
    },
    // Blockchain (future integration)
    blockchainTokenId: { type: String },
    blockchainContract: { type: String },
    lastBlockchainSync: { type: Date },
    isOnChain: { type: Boolean, default: false },
    // Active listing reference
    activeListing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// Note: vin uniqueness is enforced via schema options above.
vehicleSchema.index({ currentOwner: 1 });
vehicleSchema.index({ make: 1, model: 1, year: 1 });
vehicleSchema.index({ passportStatus: 1 });

// ─── Virtual: Primary image ───────────────────────────────────────────────────
vehicleSchema.virtual('primaryImage').get(function () {
  if (!Array.isArray(this.images)) return null;
  const primary = this.images.find((img) => img.isPrimary);
  return primary ? primary.url : (this.images[0] ? this.images[0].url : null);
});

// ─── Virtual: Display name ────────────────────────────────────────────────────
vehicleSchema.virtual('displayName').get(function () {
  return `${this.year} ${this.make} ${this.model}`;
});

const Vehicle = mongoose.model('Vehicle', vehicleSchema);

module.exports = Vehicle;
