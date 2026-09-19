import { del } from '@vercel/blob';
import { isAdmin } from './_auth.js';

function decodePath(value = '') {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isAdmin(req)) return res.status(401).json({ error: 'Требуется вход администратора.' });

  const rawPathname = typeof req.body?.pathname === 'string' ? req.body.pathname : '';
  const pathname = decodePath(rawPathname);

  if (typeof pathname !== 'string' || !pathname.startsWith('books/') || !pathname.toLowerCase().endsWith('.pdf')) {
    return res.status(400).json({ error: 'Недопустимый файл.' });
  }

  try {
    const name = pathname.split('/').pop().replace(/\.pdf$/i, '');
    const parts = name.split('__');
    const coverPath = parts[3] ? decodePath(parts[3]) : '';

    await del(pathname);
    if (coverPath && coverPath.startsWith('covers/')) {
      await del(coverPath);
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Book deletion failed:', error);
    return res.status(500).json({ error: 'Не удалось удалить книгу.' });
  }
}
