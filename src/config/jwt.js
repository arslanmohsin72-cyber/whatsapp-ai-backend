import 'dotenv/config';
import jwt from 'jsonwebtoken';

const getJwtSecret = () => process.env.JWT_SECRET || 'super_secret_jwt_key_whatsapp_saas_2026_production_grade_59a8c12b8';
const getJwtExpiresIn = () => process.env.JWT_EXPIRES_IN || '7d';

export const generateToken = (payload) => {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: getJwtExpiresIn() });
};

export const verifyToken = (token) => {
  return jwt.verify(token, getJwtSecret());
};

export default { generateToken, verifyToken };
