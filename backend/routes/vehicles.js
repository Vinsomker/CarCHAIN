const express = require('express');
const router = express.Router();
const {
  createVehicle,
  getMyVehicles,
  getVehicleById,
  getVehiclePassport,
  getVehicleByVin,
  recordBlockchainMint,
} = require('../controllers/vehicleController');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { vehicleValidation } = require('../utils/validators');
const upload = require('../middleware/upload');

// Public routes
router.get('/vin/:vin', getVehicleByVin);
router.get('/:id/passport', getVehiclePassport);
router.get('/:id', getVehicleById);

// Protected routes
router.get('/user/my-vehicles', protect, getMyVehicles);
router.post('/', protect, authorize('seller', 'admin'), vehicleValidation, validate, createVehicle);
router.post('/:id/blockchain-mint', protect, recordBlockchainMint);

// Image upload helper
router.post('/upload-image', protect, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Please upload an image file.' });
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  res.status(200).json({
    success: true,
    url: fileUrl,
    filename: req.file.filename,
  });
});

module.exports = router;
