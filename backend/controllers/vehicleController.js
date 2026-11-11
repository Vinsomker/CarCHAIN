const Vehicle = require('../models/Vehicle');
const MaintenanceRecord = require('../models/MaintenanceRecord');
const InspectionCertificate = require('../models/InspectionCertificate');
const asyncHandler = require('../utils/asyncHandler');

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/vehicles
// @desc    Register a new vehicle
// @access  Private (Seller, Admin)
// ─────────────────────────────────────────────────────────────────────────────
const createVehicle = asyncHandler(async (req, res) => {
  const {
    vin,
    make,
    model,
    year,
    variant,
    bodyType,
    color,
    fuelType,
    transmission,
    engineSize,
    horsepower,
    doors,
    seats,
    driveType,
    currentMileage,
    mileageUnit,
    images,
    registrationCountry,
    registrationPlate,
    registrationDate,
  } = req.body;

  // Normalize VIN
  const cleanVin = vin ? vin.trim().toUpperCase() : '';

  // Check if VIN already registered
  const existingVehicle = await Vehicle.findOne({ vin: cleanVin });
  if (existingVehicle) {
    return res.status(409).json({
      success: false,
      message: `A vehicle with VIN ${cleanVin} has already been registered on CarChain.`,
    });
  }

  // Format images array
  let formattedImages = [];
  if (Array.isArray(images) && images.length > 0) {
    formattedImages = images.map((img, idx) => {
      if (typeof img === 'string') {
        return { url: img, isPrimary: idx === 0 };
      }
      return {
        url: img.url,
        caption: img.caption || '',
        isPrimary: img.isPrimary !== undefined ? img.isPrimary : idx === 0,
      };
    });
  }

  // Initial ownership entry
  const initialOwnership = {
    owner: req.user._id,
    ownerName: `${req.user.firstName} ${req.user.lastName}`,
    acquiredAt: registrationDate || new Date(),
    transferMethod: 'purchase',
  };

  // Initial mileage history
  const initialMileage = {
    mileage: Number(currentMileage) || 0,
    recordedAt: new Date(),
    recordedBy: req.user._id,
    source: 'registration',
    note: 'Initial mileage at CarChain passport registration',
  };

  const vehicle = await Vehicle.create({
    vin: cleanVin,
    make,
    model,
    year: Number(year),
    variant,
    bodyType,
    color,
    fuelType,
    transmission,
    engineSize,
    horsepower: horsepower ? Number(horsepower) : undefined,
    doors: doors ? Number(doors) : 4,
    seats: seats ? Number(seats) : 5,
    driveType,
    currentMileage: Number(currentMileage) || 0,
    mileageUnit: mileageUnit || 'km',
    mileageHistory: [initialMileage],
    images: formattedImages,
    currentOwner: req.user._id,
    ownershipHistory: [initialOwnership],
    registrationCountry,
    registrationPlate,
    registrationDate: registrationDate || new Date(),
    passportStatus: 'partial', // Registered with verified identity
  });

  res.status(201).json({
    success: true,
    message: 'Vehicle registered and digital passport generated successfully.',
    vehicle,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/vehicles/my-vehicles
// @desc    Get all vehicles owned by current user
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getMyVehicles = asyncHandler(async (req, res) => {
  const vehicles = await Vehicle.find({ currentOwner: req.user._id })
    .populate('activeListing', 'title price currency status')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: vehicles.length,
    vehicles,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/vehicles/:id
// @desc    Get single vehicle specifications
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const getVehicleById = asyncHandler(async (req, res) => {
  const vehicle = await Vehicle.findById(req.params.id)
    .populate('currentOwner', 'firstName lastName businessName approvalStatus')
    .populate('activeListing');

  if (!vehicle) {
    return res.status(404).json({
      success: false,
      message: 'Vehicle not found.',
    });
  }

  res.status(200).json({
    success: true,
    vehicle,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/vehicles/:id/passport
// @desc    Get complete digital passport for a vehicle
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const getVehiclePassport = asyncHandler(async (req, res) => {
  const vehicle = await Vehicle.findById(req.params.id)
    .populate('currentOwner', 'firstName lastName businessName walletAddress')
    .populate('ownershipHistory.owner', 'firstName lastName');

  if (!vehicle) {
    return res.status(404).json({
      success: false,
      message: 'Vehicle not found.',
    });
  }

  // Fetch associated verified records in parallel
  const [maintenanceRecords, inspectionCertificates] = await Promise.all([
    MaintenanceRecord.find({ vehicle: vehicle._id })
      .populate('garage', 'firstName lastName businessName')
      .sort({ serviceDate: -1 }),
    InspectionCertificate.find({ vehicle: vehicle._id })
      .populate('inspector', 'firstName lastName businessName')
      .sort({ inspectionDate: -1 }),
  ]);

  // Construct a unified chronological timeline
  const timeline = [];

  // 1. Genesis / Registration
  timeline.push({
    type: 'registration',
    title: 'Vehicle Digital Passport Created',
    date: vehicle.createdAt,
    details: `Registered on CarChain by ${vehicle.ownershipHistory[0]?.ownerName || 'Owner'} with initial mileage ${vehicle.currentMileage.toLocaleString()} ${vehicle.mileageUnit}`,
    mileage: vehicle.mileageHistory[0]?.mileage,
    badgeClass: 'accent',
    icon: '📋',
  });

  // 2. Ownership transitions
  vehicle.ownershipHistory.forEach((oh, idx) => {
    if (idx > 0) {
      timeline.push({
        type: 'ownership_transfer',
        title: 'Ownership Transferred',
        date: oh.acquiredAt,
        details: `Transferred to ${oh.ownerName} via ${oh.transferMethod}`,
        badgeClass: 'info',
        icon: '🤝',
      });
    }
  });

  // 3. Maintenance records
  maintenanceRecords.forEach((rec) => {
    timeline.push({
      type: 'maintenance',
      title: `Maintenance: ${rec.serviceType.replace('_', ' ').toUpperCase()}`,
      date: rec.serviceDate,
      details: rec.description,
      mileage: rec.mileageAtService,
      garage: rec.garage?.businessName || rec.garage?.firstName || 'Certified Garage',
      cost: rec.totalCost ? `${rec.totalCost} ${rec.currency}` : null,
      badgeClass: 'success',
      icon: '🔧',
      isVerified: rec.isVerified,
    });
  });

  // 4. Inspection certificates
  inspectionCertificates.forEach((cert) => {
    timeline.push({
      type: 'inspection',
      title: `Technical Inspection: ${cert.result.toUpperCase()}`,
      date: cert.inspectionDate,
      details: cert.comments || `Certificate #${cert.certificateNumber}`,
      mileage: cert.mileageAtInspection,
      inspector: cert.inspector?.businessName || cert.inspector?.firstName || 'Certified Inspector',
      badgeClass: cert.result === 'pass' ? 'success' : cert.result === 'fail' ? 'danger' : 'warning',
      icon: '🛡️',
      certificateNumber: cert.certificateNumber,
      isVerified: cert.isVerified,
    });
  });

  // Sort timeline chronologically descending (newest first)
  timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

  res.status(200).json({
    success: true,
    passport: {
      vehicle,
      maintenanceRecords,
      inspectionCertificates,
      timeline,
      stats: {
        totalServices: maintenanceRecords.length,
        totalInspections: inspectionCertificates.length,
        totalOwners: vehicle.ownershipHistory.length,
        isVerified: maintenanceRecords.length > 0 || inspectionCertificates.length > 0,
      },
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/vehicles/vin/:vin
// @desc    Lookup vehicle passport by VIN
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const getVehicleByVin = asyncHandler(async (req, res) => {
  const cleanVin = req.params.vin.trim().toUpperCase();
  const vehicle = await Vehicle.findOne({ vin: cleanVin });

  if (!vehicle) {
    return res.status(404).json({
      success: false,
      message: `No vehicle found with VIN: ${cleanVin}`,
    });
  }

  // Redirect to getVehiclePassport handler logic
  req.params.id = vehicle._id;
  return getVehiclePassport(req, res);
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/vehicles/:id/blockchain-mint
// @desc    Record on-chain NFT passport minting for a vehicle
// @access  Private (Owner, Admin)
// ─────────────────────────────────────────────────────────────────────────────
const recordBlockchainMint = asyncHandler(async (req, res) => {
  const { tokenId, contractAddress, transactionHash } = req.body;
  const vehicle = await Vehicle.findById(req.params.id);
  if (!vehicle) {
    return res.status(404).json({ success: false, message: 'Vehicle not found' });
  }

  const isOwner = vehicle.currentOwner.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'admin';
  if (!isOwner && !isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Only the current vehicle owner or an administrator can register blockchain minting',
    });
  }

  vehicle.blockchainTokenId = String(tokenId);
  if (contractAddress) vehicle.blockchainContract = contractAddress;
  vehicle.isOnChain = true;
  vehicle.passportStatus = 'verified';
  vehicle.lastBlockchainSync = new Date();

  await vehicle.save();

  res.status(200).json({
    success: true,
    message: 'Digital Passport NFT successfully linked and verified on blockchain!',
    vehicle,
  });
});

module.exports = {
  createVehicle,
  getMyVehicles,
  getVehicleById,
  getVehiclePassport,
  getVehicleByVin,
  recordBlockchainMint,
};
