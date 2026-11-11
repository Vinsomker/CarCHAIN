const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      minlength: [2, 'First name must be at least 2 characters'],
      maxlength: [50, 'First name cannot exceed 50 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      minlength: [2, 'Last name must be at least 2 characters'],
      maxlength: [50, 'Last name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Never return password in queries by default
    },
    role: {
      type: String,
      enum: {
        values: ['buyer', 'seller', 'garage', 'inspector', 'admin'],
        message: 'Role must be one of: buyer, seller, garage, inspector, admin',
      },
      default: 'buyer',
    },
    phone: {
      type: String,
      trim: true,
      match: [/^[\d\s\+\-\(\)]{7,20}$/, 'Please provide a valid phone number'],
    },
    avatar: {
      type: String,
      default: null,
    },
    // Address
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      postalCode: String,
    },
    // Business info (for garages and inspectors)
    businessName: {
      type: String,
      trim: true,
    },
    businessLicense: {
      type: String,
      trim: true,
    },
    // Approval status (for garages and inspectors)
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: function () {
        return ['garage', 'inspector'].includes(this.role) ? 'pending' : 'approved';
      },
    },
    approvalNote: {
      type: String,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: {
      type: Date,
    },
    // Blockchain / Web3 (for future MetaMask integration)
    walletAddress: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^0x[a-fA-F0-9]{40}$/, 'Please provide a valid Ethereum wallet address'],
    },
    // Account status
    isActive: {
      type: Boolean,
      default: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    lastLogin: {
      type: Date,
    },
    // Password reset (for future implementation)
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// --- Indexes ---
// email and walletAddress uniqueness enforced in schema field definitions
userSchema.index({ role: 1 });
userSchema.index({ approvalStatus: 1, role: 1 });
userSchema.index({ walletAddress: 1 }, { unique: true, sparse: true });

// --- Virtual: Full name ---
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// --- Pre-save hook: Hash password ---
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// --- Method: Compare password ---
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// --- Method: Check if garage/inspector is approved ---
userSchema.methods.isApproved = function () {
  if (['buyer', 'seller', 'admin'].includes(this.role)) return true;
  return this.approvalStatus === 'approved';
};

// --- Static: Find active approved garages ---
userSchema.statics.findApprovedGarages = function () {
  return this.find({ role: 'garage', approvalStatus: 'approved', isActive: true });
};

// --- Static: Find active approved inspectors ---
userSchema.statics.findApprovedInspectors = function () {
  return this.find({ role: 'inspector', approvalStatus: 'approved', isActive: true });
};

const User = mongoose.model('User', userSchema);

module.exports = User;
