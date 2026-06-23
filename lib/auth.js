import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'lumina_secret_key_change_me_in_prod';

export async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password, hashedPassword) {
  return bcrypt.compare(password, hashedPassword);
}

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Next.js App Router cookies reader for API routes
export function getUserFromRequest(req) {
  try {
    const sessionCookie = req.cookies.get('session');
    if (!sessionCookie) return null;

    const payload = verifyToken(sessionCookie.value);
    if (!payload || !payload.userId) return null;

    return payload.userId;
  } catch (err) {
    console.error('Error reading user from request cookies:', err);
    return null;
  }
}
