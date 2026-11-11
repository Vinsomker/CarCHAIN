const express = require('express');
const router = express.Router();
const { getAllUsers, getUserById, approveUser, rejectUser, toggleUserActive, getStats } = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

// All admin routes require authentication + admin role
router.use(protect, authorize('admin'));

router.get('/stats', getStats);
router.get('/users', getAllUsers);
router.get('/users/:id', getUserById);
router.put('/users/:id/approve', approveUser);
router.put('/users/:id/reject', rejectUser);
router.put('/users/:id/toggle-active', toggleUserActive);

module.exports = router;
