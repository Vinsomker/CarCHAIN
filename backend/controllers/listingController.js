const Listing = require('../models/Listing');
const Vehicle = require('../models/Vehicle');
const asyncHandler = require('../utils/asyncHandler');

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/listings
// @desc    Get marketplace listings with search, filter, sort & pagination
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const getListings = asyncHandler(async (req, res) => {
  const {
    q,
    make,
    model,
    bodyType,
    fuelType,
    transmission,
    minPrice,
    maxPrice,
    minYear,
    maxYear,
    maxMileage,
    sort,
    page = 1,
    limit = 12,
  } = req.query;

  // Base listing query: active and approved
  const listingQuery = { status: 'active', isApproved: true };

  // Price filters
  if (minPrice || maxPrice) {
    listingQuery.price = {};
    if (minPrice) listingQuery.price.$gte = Number(minPrice);
    if (maxPrice) listingQuery.price.$lte = Number(maxPrice);
  }

  // Text search on title/description
  if (q && q.trim()) {
    listingQuery.$or = [
      { title: { $regex: q.trim(), $options: 'i' } },
      { description: { $regex: q.trim(), $options: 'i' } },
    ];
  }

  // Vehicle-specific match criteria
  const vehicleMatch = {};
  if (make) vehicleMatch.make = { $regex: make.trim(), $options: 'i' };
  if (model) vehicleMatch.model = { $regex: model.trim(), $options: 'i' };
  if (bodyType) vehicleMatch.bodyType = bodyType;
  if (fuelType) vehicleMatch.fuelType = fuelType;
  if (transmission) vehicleMatch.transmission = transmission;
  if (minYear || maxYear) {
    vehicleMatch.year = {};
    if (minYear) vehicleMatch.year.$gte = Number(minYear);
    if (maxYear) vehicleMatch.year.$lte = Number(maxYear);
  }
  if (maxMileage) {
    vehicleMatch.currentMileage = { $lte: Number(maxMileage) };
  }

  // Sorting
  let sortOption = { createdAt: -1 }; // default: newest
  if (sort === 'price') sortOption = { price: 1 };
  else if (sort === '-price') sortOption = { price: -1 };
  else if (sort === 'oldest') sortOption = { createdAt: 1 };
  else if (sort === '-createdAt') sortOption = { createdAt: -1 };

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  // Populate vehicle and filter if vehicleMatch is active
  let listings = await Listing.find(listingQuery)
    .populate({
      path: 'vehicle',
      match: Object.keys(vehicleMatch).length > 0 ? vehicleMatch : undefined,
    })
    .populate('seller', 'firstName lastName businessName approvalStatus')
    .sort(sortOption);

  // If vehicleMatch was present, exclude listings where vehicle did not match
  if (Object.keys(vehicleMatch).length > 0) {
    listings = listings.filter((l) => l.vehicle !== null);
  }

  const total = listings.length;
  const paginatedListings = listings.slice(skip, skip + limitNum);

  res.status(200).json({
    success: true,
    total,
    page: pageNum,
    pages: Math.ceil(total / limitNum),
    count: paginatedListings.length,
    listings: paginatedListings,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/listings/:id
// @desc    Get single listing details with full vehicle specifications
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const getListingById = asyncHandler(async (req, res) => {
  const listing = await Listing.findById(req.params.id)
    .populate({
      path: 'vehicle',
      populate: { path: 'currentOwner', select: 'firstName lastName businessName' },
    })
    .populate('seller', 'firstName lastName businessName phone email approvalStatus walletAddress');

  if (!listing) {
    return res.status(404).json({
      success: false,
      message: 'Listing not found.',
    });
  }

  // Increment view count asynchronously
  Listing.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } }).exec();

  res.status(200).json({
    success: true,
    listing,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/listings
// @desc    Create a new vehicle listing
// @access  Private (Seller, Admin)
// ─────────────────────────────────────────────────────────────────────────────
const createListing = asyncHandler(async (req, res) => {
  const { vehicleId, title, description, price, currency, location, contactInfo } = req.body;

  // Verify the vehicle exists and belongs to the seller
  const vehicle = await Vehicle.findById(vehicleId);
  if (!vehicle) {
    return res.status(404).json({ success: false, message: 'Vehicle not found.' });
  }

  if (vehicle.currentOwner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'You can only create listings for vehicles that you own.',
    });
  }

  // Check if already actively listed
  const existingActive = await Listing.findOne({
    vehicle: vehicleId,
    status: { $in: ['active', 'pending_sale'] },
  });

  if (existingActive) {
    return res.status(409).json({
      success: false,
      message: 'This vehicle already has an active or pending listing.',
    });
  }

  const listingTitle = title || `${vehicle.year} ${vehicle.make} ${vehicle.model}`;

  const listing = await Listing.create({
    vehicle: vehicleId,
    seller: req.user._id,
    title: listingTitle,
    description,
    price: Number(price),
    currency: currency || 'USD',
    location: location || { city: '', state: '', country: '' },
    contactInfo: contactInfo || { showEmail: true, showPhone: true },
    status: 'active',
  });

  // Link active listing to vehicle
  vehicle.activeListing = listing._id;
  await vehicle.save();

  res.status(201).json({
    success: true,
    message: 'Vehicle listed successfully in marketplace.',
    listing,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/listings/:id
// @desc    Update listing details (price, description, status)
// @access  Private (Owner, Admin)
// ─────────────────────────────────────────────────────────────────────────────
const updateListing = asyncHandler(async (req, res) => {
  const listing = await Listing.findById(req.params.id);

  if (!listing) {
    return res.status(404).json({ success: false, message: 'Listing not found.' });
  }

  // Check ownership
  if (listing.seller.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Not authorized to edit this listing.' });
  }

  const { title, description, price, currency, status, location } = req.body;

  if (title !== undefined) listing.title = title;
  if (description !== undefined) listing.description = description;
  if (price !== undefined) listing.price = Number(price);
  if (currency !== undefined) listing.currency = currency;
  if (location !== undefined) listing.location = location;
  if (status !== undefined) listing.status = status;

  await listing.save();

  // If status is withdrawn or sold, clear vehicle activeListing reference
  if (['withdrawn', 'sold'].includes(listing.status)) {
    await Vehicle.findByIdAndUpdate(listing.vehicle, { activeListing: null });
  }

  res.status(200).json({
    success: true,
    message: 'Listing updated successfully.',
    listing,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   DELETE /api/listings/:id
// @desc    Delete a listing
// @access  Private (Owner, Admin)
// ─────────────────────────────────────────────────────────────────────────────
const deleteListing = asyncHandler(async (req, res) => {
  const listing = await Listing.findById(req.params.id);

  if (!listing) {
    return res.status(404).json({ success: false, message: 'Listing not found.' });
  }

  if (listing.seller.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Not authorized to delete this listing.' });
  }

  // Remove vehicle activeListing link
  await Vehicle.findByIdAndUpdate(listing.vehicle, { activeListing: null });
  await listing.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Listing removed from marketplace.',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/listings/my-listings
// @desc    Get all listings created by the logged-in seller
// @access  Private (Seller, Admin)
// ─────────────────────────────────────────────────────────────────────────────
const getMyListings = asyncHandler(async (req, res) => {
  const listings = await Listing.find({ seller: req.user._id })
    .populate('vehicle')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: listings.length,
    listings,
  });
});

module.exports = {
  getListings,
  getListingById,
  createListing,
  updateListing,
  deleteListing,
  getMyListings,
};
