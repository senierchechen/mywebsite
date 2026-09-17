import crypto from 'node:crypto';

export const COOKIE = 'admin_session';
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

export function sameSecret(a = '', b = '') {
  const ah = crypto.createHash('sha256').update(String(a)).digest();
  const bh = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ah, bh);
}

export function sign(value) {
  return crypto.createHmac('sha256', process.env.ADMIN_SESSION_SECRET || '').update(value).digest('hex');
}

export function makeSession(username) {
  const payload = `${username}.${Date.now()}`;
  return Buffer.from(`${payload}.${sign(payload)}`).toString('base64url');
}

export function isAdmin(req) {
  const header = req.headers.cookie || '';
  const match = header.match(new RegExp(`${COOKIE}=([^;]+)`));
  if (!match || !process.env.ADMIN_SESSION_SECRET || !process.env.ADMIN_USERNAME) return false;
  try {
    const decoded = Buffer.from(match[1], 'base64url').toString('utf8');
    const parts = decoded.split('.');
    if (parts.length !== 3) return false;
    const [username, timestamp, signature] = parts;
    const payload = `${username}.${timestamp}`;
    const age = Date.now() - Number(timestamp);
    return username === process.env.ADMIN_USERNAME && Number.isFinite(age) && age >= 0 && age <= MAX_AGE_MS && sameSecret(signature, sign(payload));
  } catch {
    return false;
  }
}

export function requireAdmin(req, res) {
  if (!isAdmin(req)) {
    res.status(401).json({ error: 'Требуется вход администратора.' });
    return false;
  }
  return true;
}
