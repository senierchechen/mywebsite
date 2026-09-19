import { isAdmin } from './_auth.js';

function decodePath(value = '') {
  try { return decodeURIComponent(value); } catch { return value; }
}

async function listBooksFresh() {
  const token = process.env.BLOB_READ_WRITE_TOKEN || '';
  const url = 'https://blob.vercel-storage.com/?prefix=books/&limit=1000&cache=0';
  const response = await fetch(url, {
    headers: { Authorization: 'Bearer ' + token },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Не удалось получить список файлов из Blob.');
  return (await response.json()).blobs || [];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isAdmin(req)) return res.status(401).json({ error: 'Требуется вход администратора.' });

  const pathname = decodePath(typeof req.body?.pathname === 'string' ? req.body.pathname : '');

  if (!pathname || !pathname.startsWith('books/') || !pathname.toLowerCase().endsWith('.pdf')) {
    return res.status(400).json({ error: 'Недопустимый файл.' });
  }

  try {
    const blobs = await listBooksFresh();
    const target = blobs.find((blob) => blob.pathname === pathname);

    if (!target) {
      return res.status(404).json({ error: 'Книга уже удалена или не найдена.' });
    }

    const deleteResponse = await fetch(target.url, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + (process.env.BLOB_READ_WRITE_TOKEN || '') },
      cache: 'no-store',
    });

    if (!deleteResponse.ok) {
      const message = await deleteResponse.text().catch(() => '');
      console.error('Blob delete failed:', deleteResponse.status, message);
      return res.status(500).json({ error: 'Vercel Blob не подтвердил удаление файла.' });
    }

    // Remove the cover if this book has one.
    const name = pathname.split('/').pop().replace(/\.pdf$/i, '');
    const parts = name.split('__');
    const coverUrl = parts[3] ? decodePath(parts[3]) : '';

    if (coverUrl && coverUrl.startsWith('https://')) {
      const coverDelete = await fetch(coverUrl, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + (process.env.BLOB_READ_WRITE_TOKEN || '') },
        cache: 'no-store',
      });
      if (!coverDelete.ok) console.error('Cover delete failed:', coverDelete.status);
    }

    // Verify against the uncached Blob API.
    const remaining = await listBooksFresh();
    if (remaining.some((blob) => blob.pathname === pathname)) {
      return res.status(500).json({ error: 'Vercel Blob всё ещё видит книгу. Удаление не подтверждено.' });
    }

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).json({ ok: true, deleted: pathname });
  } catch (error) {
    console.error('Book deletion failed:', error);
    return res.status(500).json({ error: error?.message || 'Не удалось удалить книгу.' });
  }
}
