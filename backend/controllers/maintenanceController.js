const MaintenanceRecord = require('../models/MaintenanceRecord');
const Vehicle = require('../models/Vehicle');
const asyncHandler = require('../utils/asyncHandler');

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/maintenance
// @desc    Certified garage logs a verified maintenance record
// @access  Private (Approved Garage, Admin)
// ─────────────────────────────────────────────────────────────────────────────
const createMaintenanceRecord = asyncHandler(async (req, res) => {
  const {
    vehicleId,
    serviceType,
    serviceDate,
    mileageAtService,
    description,
    partsReplaced,
    laborCost,
    partsCost,
    totalCost,
    currency,
    technicianName,
    notes,
    nextServiceDue,
  } = req.body;

  // 1. Fetch vehicle
  const vehicle = await Vehicle.findById(vehicleId);
  if (!vehicle) {
    return res.status(404).json({ success: false, message: 'Vehicle not found.' });
  }

  const newMileage = Number(mileageAtService);
  if (isNaN(newMileage) || newMileage < 0) {
    return res.status(400).json({ success: false, message: 'A valid positive mileage reading is required.' });
  }

  // 2. Anti-tamper check: Mileage rollback prevention
  // New mileage cannot be lower than the vehicle's highest recorded mileage
  if (newMileage < vehicle.currentMileage) {
    return res.status(400).json({
      success: false,
      message: `Mileage rollback rejected! Submitted service mileage (${newMileage.toLocaleString()} ${vehicle.mileageUnit}) is lower than the vehicle's last certified odometer reading (${vehicle.currentMileage.toLocaleString()} ${vehicle.mileageUnit}).`,
    });
  }

  // 3. Create the maintenance record (append-only)
  const record = await MaintenanceRecord.create({
    vehicle: vehicle._id,
    garage: req.user._id,
    serviceType,
    serviceDate: serviceDate || new Date(),
    mileageAtService: newMileage,
    description,
    partsReplaced: Array.isArray(partsReplaced) ? partsReplaced : [],
    laborCost: laborCost ? Number(laborCost) : 0,
    partsCost: partsCost ? Number(partsCost) : 0,
    totalCost: totalCost ? Number(totalCost) : (Number(laborCost || 0) + Number(partsCost || 0)),
    currency: currency || 'USD',
    technicianName: technicianName || `${req.user.firstName} ${req.user.lastName}`,
    notes,
    nextServiceDue,
    isVerified: true, // Only approved garages can reach this handler
  });

  // 4. Update vehicle's current mileage and append to audit history
  vehicle.currentMileage = newMileage;
  vehicle.mileageHistory.push({
    mileage: newMileage,
    recordedAt: serviceDate || new Date(),
    recordedBy: req.user._id,
    source: 'maintenance',
    note: `Service: ${serviceType.replace('_', ' ').toUpperCase()} by ${req.user.businessName || req.user.firstName}`,
  });

  // Upgrade passport status to verified once certified garage adds a record
  vehicle.passportStatus = 'verified';
  await vehicle.save();

  // Populate garage for response
  const populatedRecord = await MaintenanceRecord.findById(record._id).populate('garage', 'firstName lastName businessName');

  res.status(201).json({
    success: true,
    message: 'Maintenance record certified and permanently logged to vehicle passport.',
    record: populatedRecord,
    vehicleCurrentMileage: vehicle.currentMileage,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/maintenance/my-records
// @desc    Get all maintenance records submitted by logged-in garage
// @access  Private (Garage, Admin)
// ─────────────────────────────────────────────────────────────────────────────
const getMyMaintenanceRecords = asyncHandler(async (req, res) => {
  const records = await MaintenanceRecord.find({ garage: req.user._id })
    .populate('vehicle', 'make model year vin currentMileage mileageUnit images')
    .sort({ serviceDate: -1 });

  res.status(200).json({
    success: true,
    count: records.length,
    records,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/maintenance/vehicle/:vehicleId
// @desc    Get all maintenance records for a vehicle
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const getVehicleMaintenanceRecords = asyncHandler(async (req, res) => {
  const records = await MaintenanceRecord.find({ vehicle: req.params.vehicleId })
    .populate('garage', 'firstName lastName businessName')
    .sort({ serviceDate: -1 });

  res.status(200).json({
    success: true,
    count: records.length,
    records,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/maintenance/:id
// @desc    Get single maintenance record details
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const getMaintenanceRecordById = asyncHandler(async (req, res) => {
  const record = await MaintenanceRecord.findById(req.params.id)
    .populate('vehicle', 'make model year vin currentMileage mileageUnit images')
    .populate('garage', 'firstName lastName businessName phone email address');

  if (!record) {
    return res.status(404).json({ success: false, message: 'Maintenance record not found.' });
  }

  res.status(200).json({
    success: true,
    record,
  });
});

module.exports = {
  createMaintenanceRecord,
  getMyMaintenanceRecords,
  getVehicleMaintenanceRecords,
  getMaintenanceRecordById,
};
