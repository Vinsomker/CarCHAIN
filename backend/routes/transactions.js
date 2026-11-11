const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { protect } = require('../middleware/auth');

// All transaction routes require authentication
router.use(protect);

router.post('/', transactionController.initiatePurchase);
router.get('/my-purchases', transactionController.getMyPurchases);
router.get('/my-sales', transactionController.getMySales);
router.get('/:id', transactionController.getTransactionById);
router.post('/:id/confirm-handover', transactionController.confirmHandover);
router.post('/:id/complete', transactionController.completeTransaction);
router.post('/:id/cancel', transactionController.cancelTransaction);

module.exports = router;
