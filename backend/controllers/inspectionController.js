const InspectionCertificate = require('../models/InspectionCertificate');
const Vehicle = require('../models/Vehicle');
const asyncHandler = require('../utils/asyncHandler');

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/inspections
// @desc    Certified inspector issues a technical inspection certificate
// @access  Private (Approved Inspector, Admin)
// ─────────────────────────────────────────────────────────────────────────────
const createInspectionCertificate = asyncHandler(async (req, res) => {
  const {
    vehicleId,
    inspectionType,
    inspectionDate,
    expiryDate,
    mileageAtInspection,
    result,
    checklist,
    comments,
    requiredRepairs,
    documents,
  } = req.body;

  // 1. Fetch vehicle
  const vehicle = await Vehicle.findById(vehicleId);
  if (!vehicle) {
    return res.status(404).json({ success: false, message: 'Vehicle not found.' });
  }

  const newMileage = Number(mileageAtInspection);
  if (isNaN(newMileage) || newMileage < 0) {
    return res.status(400).json({ success: false, message: 'A valid positive mileage reading is required.' });
  }

  // 2. Anti-tamper check: Mileage rollback prevention
  if (newMileage < vehicle.currentMileage) {
    return res.status(400).json({
      success: false,
      message: `Mileage rollback rejected! Inspection mileage (${newMileage.toLocaleString()} ${vehicle.mileageUnit}) cannot be lower than the vehicle's last recorded odometer reading (${vehicle.currentMileage.toLocaleString()} ${vehicle.mileageUnit}).`,
    });
  }

  // 3. Auto-calculate expiry date (default: 1 year from inspection date)
  const defaultExpiry = new Date(inspectionDate || Date.now());
  defaultExpiry.setFullYear(defaultExpiry.getFullYear() + 1);

  // 4. Create the inspection certificate
  const certificate = await InspectionCertificate.create({
    vehicle: vehicle._id,
    inspector: req.user._id,
    inspectionType: inspectionType || 'annual',
    inspectionDate: inspectionDate || new Date(),
    expiryDate: expiryDate || defaultExpiry,
    mileageAtInspection: newMileage,
    result: result || 'pass',
    checklist: checklist || {},
    comments,
    requiredRepairs: Array.isArray(requiredRepairs) ? requiredRepairs : [],
    documents: Array.isArray(documents) ? documents : [],
    isVerified: true, // Only approved inspectors can access this route
  });

  // 5. Update vehicle's mileage and audit trail
  vehicle.currentMileage = newMileage;
  vehicle.mileageHistory.push({
    mileage: newMileage,
    recordedAt: inspectionDate || new Date(),
    recordedBy: req.user._id,
    source: 'inspection',
    note: `Inspection: ${result.toUpperCase()} by ${req.user.businessName || req.user.firstName} (Cert #${certificate.certificateNumber})`,
  });

  // Upgrade passport status
  vehicle.passportStatus = 'verified';
  await vehicle.save();

  const populatedCertificate = await InspectionCertificate.findById(certificate._id)
    .populate('inspector', 'firstName lastName businessName')
    .populate('vehicle', 'make model year vin');

  res.status(201).json({
    success: true,
    message: 'Technical inspection certificate generated and anchored to vehicle digital passport.',
    certificate: populatedCertificate,
    vehicleCurrentMileage: vehicle.currentMileage,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/inspections/my-inspections
// @desc    Get all inspection certificates issued by the logged-in inspector
// @access  Private (Inspector, Admin)
// ─────────────────────────────────────────────────────────────────────────────
const getMyInspections = asyncHandler(async (req, res) => {
  const certificates = await InspectionCertificate.find({ inspector: req.user._id })
    .populate('vehicle', 'make model year vin currentMileage mileageUnit images')
    .sort({ inspectionDate: -1 });

  res.status(200).json({
    success: true,
    count: certificates.length,
    certificates,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/inspections/vehicle/:vehicleId
// @desc    Get all inspection certificates for a vehicle
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const getVehicleInspections = asyncHandler(async (req, res) => {
  const certificates = await InspectionCertificate.find({ vehicle: req.params.vehicleId })
    .populate('inspector', 'firstName lastName businessName')
    .sort({ inspectionDate: -1 });

  res.status(200).json({
    success: true,
    count: certificates.length,
    certificates,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/inspections/:id
// @desc    Get single inspection certificate details (including 12-point checklist)
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const getInspectionById = asyncHandler(async (req, res) => {
  const certificate = await InspectionCertificate.findById(req.params.id)
    .populate('vehicle', 'make model year vin currentMileage mileageUnit images')
    .populate('inspector', 'firstName lastName businessName phone email address');

  if (!certificate) {
    return res.status(404).json({ success: false, message: 'Inspection certificate not found.' });
  }

  res.status(200).json({
    success: true,
    certificate,
  });
});

module.exports = {
  createInspectionCertificate,
  getMyInspections,
  getVehicleInspections,
  getInspectionById,
};
