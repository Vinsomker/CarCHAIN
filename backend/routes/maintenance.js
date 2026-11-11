const express = require('express');
const router = express.Router();
const {
  createMaintenanceRecord,
  getMyMaintenanceRecords,
  getVehicleMaintenanceRecords,
  getMaintenanceRecordById,
} = require('../controllers/maintenanceController');
const { protect, authorize, requireApproval } = require('../middleware/auth');

// Public routes
router.get('/vehicle/:vehicleId', getVehicleMaintenanceRecords);
router.get('/:id', getMaintenanceRecordById);

// Protected routes (Only approved garages and admins can log certified records)
router.get('/user/my-records', protect, authorize('garage', 'admin'), getMyMaintenanceRecords);
router.post('/', protect, authorize('garage', 'admin'), requireApproval, createMaintenanceRecord);

module.exports = router;
