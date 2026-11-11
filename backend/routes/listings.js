const express = require('express');
const router = express.Router();
const {
  getListings,
  getListingById,
  createListing,
  updateListing,
  deleteListing,
  getMyListings,
} = require('../controllers/listingController');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { listingValidation } = require('../utils/validators');

// Public routes
router.get('/', getListings);
router.get('/:id', getListingById);

// Protected routes (Seller / Admin)
router.get('/user/my-listings', protect, authorize('seller', 'admin'), getMyListings);
router.post('/', protect, authorize('seller', 'admin'), listingValidation, validate, createListing);
router.put('/:id', protect, authorize('seller', 'admin'), updateListing);
router.delete('/:id', protect, authorize('seller', 'admin'), deleteListing);

module.exports = router;
