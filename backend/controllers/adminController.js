const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/admin/users
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────────
const getAllUsers = asyncHandler(async (req, res) => {
  const { role, status, page = 1, limit = 20 } = req.query;
  const filter = {};

  if (role) filter.role = role;
  if (status) filter.approvalStatus = status;

  const skip = (Number(page) - 1) * Number(limit);
  const [users, total] = await Promise.all([
    User.find(filter).select('-password').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    User.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
    users,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/admin/users/:id
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────────
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
  res.status(200).json({ success: true, user });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/admin/users/:id/approve
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────────
const approveUser = asyncHandler(async (req, res) => {
  const { note } = req.body;
  const user = await User.findById(req.params.id);

  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
  if (!['garage', 'inspector'].includes(user.role)) {
    return res.status(400).json({ success: false, message: 'Only garage and inspector accounts require approval.' });
  }

  user.approvalStatus = 'approved';
  user.approvalNote = note || 'Approved by administrator.';
  user.approvedBy = req.user._id;
  user.approvedAt = new Date();
  await user.save({ validateBeforeSave: false });

  res.status(200).json({ success: true, message: `${user.fullName} has been approved.`, user });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/admin/users/:id/reject
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────────
const rejectUser = asyncHandler(async (req, res) => {
  const { note } = req.body;
  const user = await User.findById(req.params.id);

  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

  user.approvalStatus = 'rejected';
  user.approvalNote = note || 'Rejected by administrator.';
  user.approvedBy = req.user._id;
  user.approvedAt = new Date();
  await user.save({ validateBeforeSave: false });

  res.status(200).json({ success: true, message: `${user.fullName}'s application has been rejected.`, user });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/admin/users/:id/toggle-active
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────────
const toggleUserActive = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
  if (user.role === 'admin') return res.status(403).json({ success: false, message: 'Cannot deactivate admin accounts.' });

  user.isActive = !user.isActive;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: `Account ${user.isActive ? 'activated' : 'deactivated'} successfully.`,
    user,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/admin/stats
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────────
const getStats = asyncHandler(async (req, res) => {
  const Vehicle = require('../models/Vehicle');
  const Listing = require('../models/Listing');
  const Transaction = require('../models/Transaction');

  const [userStats, vehicleCount, listingStats, transactionStats] = await Promise.all([
    User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$approvalStatus', 'pending'] }, 1, 0] } },
        },
      },
    ]),
    Vehicle.countDocuments(),
    Listing.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Transaction.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
    ]),
  ]);

  res.status(200).json({
    success: true,
    stats: { userStats, vehicleCount, listingStats, transactionStats },
  });
});

module.exports = { getAllUsers, getUserById, approveUser, rejectUser, toggleUserActive, getStats };
