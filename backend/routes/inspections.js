const express = require('express');
const router = express.Router();
const {
  createInspectionCertificate,
  getMyInspections,
  getVehicleInspections,
  getInspectionById,
} = require('../controllers/inspectionController');
const { protect, authorize, requireApproval } = require('../middleware/auth');

// Public routes
router.get('/vehicle/:vehicleId', getVehicleInspections);
router.get('/:id', getInspectionById);

// Protected routes (Only approved inspectors and admins can issue certified certificates)
router.get('/user/my-inspections', protect, authorize('inspector', 'admin'), getMyInspections);
router.post('/', protect, authorize('inspector', 'admin'), requireApproval, createInspectionCertificate);

module.exports = router;
