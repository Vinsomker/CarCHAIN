const { body } = require('express-validator');

const registerValidation = [
  body('firstName')
    .trim()
    .notEmpty().withMessage('First name is required')
    .isLength({ min: 2, max: 50 }).withMessage('First name must be 2–50 characters'),

  body('lastName')
    .trim()
    .notEmpty().withMessage('Last name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Last name must be 2–50 characters'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),

  body('role')
    .optional()
    .isIn(['buyer', 'seller', 'garage', 'inspector'])
    .withMessage('Invalid role selected'),

  body('phone')
    .optional()
    .trim()
    .matches(/^[\d\s\+\-\(\)]{7,20}$/)
    .withMessage('Please provide a valid phone number'),

  body('businessName')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Business name cannot exceed 100 characters'),
];

const loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required'),
];

const vehicleValidation = [
  body('vin')
    .trim()
    .notEmpty().withMessage('VIN is required')
    .isLength({ min: 17, max: 17 }).withMessage('VIN must be exactly 17 characters')
    .matches(/^[A-HJ-NPR-Z0-9]{17}$/).withMessage('VIN contains invalid characters'),

  body('make')
    .trim()
    .notEmpty().withMessage('Vehicle make is required'),

  body('model')
    .trim()
    .notEmpty().withMessage('Vehicle model is required'),

  body('year')
    .isInt({ min: 1886, max: new Date().getFullYear() + 2 })
    .withMessage('Valid manufacturing year is required'),

  body('currentMileage')
    .isFloat({ min: 0 })
    .withMessage('Valid current mileage is required'),

  body('fuelType')
    .notEmpty().withMessage('Fuel type is required'),

  body('transmission')
    .notEmpty().withMessage('Transmission is required'),
];

const listingValidation = [
  body('vehicleId')
    .notEmpty().withMessage('Vehicle ID is required')
    .isMongoId().withMessage('Invalid Vehicle ID'),

  body('price')
    .isFloat({ min: 0 })
    .withMessage('A valid positive price is required'),

  body('title')
    .optional()
    .trim()
    .isLength({ max: 150 }).withMessage('Title cannot exceed 150 characters'),
];

module.exports = { registerValidation, loginValidation, vehicleValidation, listingValidation };
