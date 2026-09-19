import { del, list } from '@vercel/blob';
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

  if (!pathname || !pathname.startsWith('books/') || !pathname.toLowerCase().endsWith('.pdf')) {
    return res.status(400).json({ error: 'Недопустимый файл.' });
  }

  try {
    const { blobs } = await list({ prefix: 'books/', limit: 1000 });
    const target = blobs.find((blob) => blob.pathname === pathname);

    if (!target) {
      return res.status(404).json({ error: 'Книга уже удалена или не найдена.' });
    }

    const name = pathname.split('/').pop().replace(/\.pdf$/i, '');
    const parts = name.split('__');
    const coverUrl = parts[3] ? decodePath(parts[3]) : '';

    // Delete by the exact Blob URL/path returned by storage.
    await del(target.url);

    // Delete the associated private cover too.
    if (coverUrl && coverUrl.startsWith('https://')) {
      try {
        await del(coverUrl);
      } catch (coverError) {
        console.error('Cover deletion failed:', coverError);
      }
    }

    // Verify that the PDF is really gone before reporting success.
    const { blobs: remaining } = await list({ prefix: 'books/', limit: 1000 });
    if (remaining.some((blob) => blob.pathname === pathname)) {
      return res.status(500).json({ error: 'Файл книги не удалился из хранилища.' });
    }

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).json({ ok: true, deleted: pathname });
  } catch (error) {
    console.error('Book deletion failed:', error);
    return res.status(500).json({ error: error?.message || 'Не удалось удалить книгу.' });
  }
}
