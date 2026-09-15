import { User } from '../models/User.js';
import { Business } from '../models/Business.js';
import { AISettings } from '../models/AISettings.js';
import { WorkingHours } from '../models/WorkingHours.js';
import { generateToken } from '../config/jwt.js';
import { sendSuccess, sendError } from '../utils/responseHelper.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';

export const register = async (req, res, next) => {
  try {
    const { name, email, password, businessName, phone, currency, timezone } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return sendError(res, 'An account with this email already exists', 409);
    }

    // 1. Create Business
    const business = await Business.create({
      name: businessName || `${name}'s Business`,
      phone: phone || '',
      currency: currency || 'MYR',
      timezone: timezone || 'Asia/Kuala_Lumpur'
    });

    // 2. Create User
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: 'owner',
      businessId: business._id
    });

    // 3. Create Default AI Settings
    await AISettings.create({
      businessId: business._id,
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      responseStyle: 'short',
      defaultTone: 'friendly',
      useEmojis: true,
      businessOnlyMode: true,
      humanHandoverEnabled: true
    });

    // 4. Create Default Working Hours
    await WorkingHours.create({
      businessId: business._id,
      timezone: timezone || 'Asia/Kuala_Lumpur'
    });

    // 5. Generate JWT Token
    const token = generateToken({
      id: user._id,
      email: user.email,
      role: user.role,
      businessId: business._id,
      name: user.name
    });

    logger.info(`New SaaS Tenant Registered: ${business.name} (User: ${user.email})`);

    return sendSuccess(
      res,
      {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          businessId: business._id
        },
        business: {
          id: business._id,
          name: business.name,
          currency: business.currency,
          timezone: business.timezone
        }
      },
      'Registration successful',
      201
    );
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, 'Email and password are required', 400);
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return sendError(res, 'Invalid email or password', 401);
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return sendError(res, 'Invalid email or password', 401);
    }

    const business = await Business.findById(user.businessId).lean();

    // Update last login asynchronously without blocking or full document re-validation
    User.updateOne({ _id: user._id }, { lastLogin: new Date() }).catch((err) =>
      logger.warn(`Failed to update lastLogin for ${user.email}: ${err.message}`)
    );

    const token = generateToken({
      id: user._id,
      email: user.email,
      role: user.role,
      businessId: user.businessId,
      name: user.name
    });

    logger.info(`User logged in: ${user.email} (Business: ${business?.name})`);

    return sendSuccess(
      res,
      {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          businessId: user.businessId
        },
        business: business ? {
          id: business._id,
          name: business.name,
          currency: business.currency,
          timezone: business.timezone,
          whatsappNumber: business.whatsappNumber,
          logo: business.logo
        } : null
      },
      'Login successful'
    );
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    const business = await Business.findById(user.businessId).lean();

    return sendSuccess(res, {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        businessId: user.businessId
      },
      business
    });
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() });
    if (!user) {
      // Return 200 to prevent user enumeration attacks
      return sendSuccess(res, null, 'If an account with that email exists, password reset instructions have been generated.');
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpire = Date.now() + 30 * 60 * 1000; // 30 minutes
    await user.save();

    logger.info(`Password reset requested for ${user.email}`);

    return sendSuccess(
      res,
      { resetToken: process.env.NODE_ENV !== 'production' ? resetToken : undefined },
      'If an account with that email exists, password reset instructions have been generated.'
    );
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return sendError(res, 'Reset token and new password are required', 400);
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return sendError(res, 'Invalid or expired password reset token', 400);
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    logger.info(`Password successfully reset for user ${user.email}`);

    return sendSuccess(res, null, 'Password has been reset successfully. You can now log in.');
  } catch (error) {
    next(error);
  }
};

export default { register, login, getMe, forgotPassword, resetPassword };
