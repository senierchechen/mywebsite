import { del } from '@vercel/blob';
import { isAdmin } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isAdmin(req)) return res.status(401).json({ error: 'Требуется вход администратора.' });

  const { pathname } = req.body || {};

  if (typeof pathname !== 'string' || !pathname.startsWith('books/') || !pathname.toLowerCase().endsWith('.pdf')) {
    return res.status(400).json({ error: 'Недопустимый файл.' });
  }

  try {
    await del(pathname);
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Не удалось удалить книгу.' });
  }
}
