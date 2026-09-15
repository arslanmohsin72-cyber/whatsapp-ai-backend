import express from 'express';
import { body } from 'express-validator';
import authController from '../controllers/authController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();

const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('businessName').trim().notEmpty().withMessage('Business name is required')
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
];

router.post('/register', authLimiter, validate(registerValidation), authController.register);
router.post('/login', authLimiter, validate(loginValidation), authController.login);
router.get('/me', authenticate, authController.getMe);
router.post('/forgot-password', authLimiter, authController.forgotPassword);
router.post('/reset-password', authLimiter, authController.resetPassword);

export default router;
