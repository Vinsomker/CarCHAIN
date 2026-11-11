const mongoose = require('mongoose');

const inspectionCertificateSchema = new mongoose.Schema(
  {
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: [true, 'Vehicle reference is required'],
    },
    inspector: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Inspector reference is required'],
    },
    inspectionType: {
      type: String,
      enum: ['annual', 'pre_sale', 'post_accident', 'import', 'custom'],
      required: [true, 'Inspection type is required'],
    },
    inspectionDate: {
      type: Date,
      required: [true, 'Inspection date is required'],
    },
    expiryDate: {
      type: Date,
    },
    mileageAtInspection: {
      type: Number,
      required: [true, 'Mileage at inspection is required'],
      min: [0, 'Mileage cannot be negative'],
    },
    // Overall result
    result: {
      type: String,
      enum: ['pass', 'conditional_pass', 'fail'],
      required: [true, 'Inspection result is required'],
    },
    // Detailed inspection checklist
    checklist: {
      engine: { status: { type: String, enum: ['ok', 'warning', 'fail', 'not_checked'] }, notes: String },
      transmission: { status: { type: String, enum: ['ok', 'warning', 'fail', 'not_checked'] }, notes: String },
      brakes: { status: { type: String, enum: ['ok', 'warning', 'fail', 'not_checked'] }, notes: String },
      suspension: { status: { type: String, enum: ['ok', 'warning', 'fail', 'not_checked'] }, notes: String },
      steering: { status: { type: String, enum: ['ok', 'warning', 'fail', 'not_checked'] }, notes: String },
      tires: { status: { type: String, enum: ['ok', 'warning', 'fail', 'not_checked'] }, notes: String },
      lights: { status: { type: String, enum: ['ok', 'warning', 'fail', 'not_checked'] }, notes: String },
      electrical: { status: { type: String, enum: ['ok', 'warning', 'fail', 'not_checked'] }, notes: String },
      bodywork: { status: { type: String, enum: ['ok', 'warning', 'fail', 'not_checked'] }, notes: String },
      interior: { status: { type: String, enum: ['ok', 'warning', 'fail', 'not_checked'] }, notes: String },
      undercarriage: { status: { type: String, enum: ['ok', 'warning', 'fail', 'not_checked'] }, notes: String },
      emissions: { status: { type: String, enum: ['ok', 'warning', 'fail', 'not_checked'] }, notes: String },
    },
    comments: {
      type: String,
      trim: true,
      maxlength: [2000, 'Comments cannot exceed 2000 characters'],
    },
    requiredRepairs: [{ type: String }],
    documents: [
      {
        name: String,
        url: String,
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    certificateNumber: {
      type: String,
      unique: true,
      sparse: true,
    },
    // Verification
    isVerified: { type: Boolean, default: true }, // True because only approved inspectors can submit
    // Blockchain (future)
    blockchainCertHash: { type: String },
    transactionHash: { type: String },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
inspectionCertificateSchema.index({ vehicle: 1, inspectionDate: -1 });
inspectionCertificateSchema.index({ inspector: 1 });
inspectionCertificateSchema.index({ result: 1 });
inspectionCertificateSchema.index({ expiryDate: 1 });

// Auto-generate certificate number before saving
inspectionCertificateSchema.pre('save', async function (next) {
  if (!this.certificateNumber) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substr(2, 5).toUpperCase();
    this.certificateNumber = `CERT-${timestamp}-${random}`;
  }
  next();
});

const InspectionCertificate = mongoose.model('InspectionCertificate', inspectionCertificateSchema);

module.exports = InspectionCertificate;
