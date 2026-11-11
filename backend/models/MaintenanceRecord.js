const mongoose = require('mongoose');

const maintenanceRecordSchema = new mongoose.Schema(
  {
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: [true, 'Vehicle reference is required'],
    },
    garage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Garage reference is required'],
    },
    // Service details
    serviceType: {
      type: String,
      enum: [
        'oil_change',
        'tire_change',
        'brake_service',
        'engine_repair',
        'transmission_service',
        'electrical',
        'bodywork',
        'ac_service',
        'inspection_prep',
        'general_service',
        'recall_fix',
        'other',
      ],
      required: [true, 'Service type is required'],
    },
    serviceDate: {
      type: Date,
      required: [true, 'Service date is required'],
    },
    mileageAtService: {
      type: Number,
      required: [true, 'Mileage at service is required'],
      min: [0, 'Mileage cannot be negative'],
    },
    description: {
      type: String,
      required: [true, 'Service description is required'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    partsReplaced: [
      {
        partName: String,
        partNumber: String,
        brand: String,
      },
    ],
    laborCost: { type: Number, min: 0 },
    partsCost: { type: Number, min: 0 },
    totalCost: { type: Number, min: 0 },
    currency: { type: String, default: 'USD' },
    technicianName: { type: String, trim: true },
    // Supporting documents
    documents: [
      {
        name: String,
        url: String,
        type: { type: String, enum: ['invoice', 'report', 'photo', 'other'] },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    notes: { type: String, trim: true, maxlength: [1000, 'Notes cannot exceed 1000 characters'] },
    nextServiceDue: {
      date: Date,
      mileage: Number,
      description: String,
    },
    // Verification
    isVerified: { type: Boolean, default: true }, // True because only approved garages can submit
    // Blockchain (future)
    blockchainRecordHash: { type: String },
    transactionHash: { type: String },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
maintenanceRecordSchema.index({ vehicle: 1, serviceDate: -1 });
maintenanceRecordSchema.index({ garage: 1 });
maintenanceRecordSchema.index({ serviceDate: -1 });

// ─── NOTE: Records are immutable after creation (append-only) ─────────────────
// Updates are blocked at the route/controller level to preserve history integrity.

const MaintenanceRecord = mongoose.model('MaintenanceRecord', maintenanceRecordSchema);

module.exports = MaintenanceRecord;
