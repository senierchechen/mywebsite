import { del } from '@vercel/blob';
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

async function waitUntilDeleted(pathname) {
  for (let attempt = 0; attempt < 15; attempt++) {
    const remaining = await listBooksFresh();
    if (!remaining.some((blob) => blob.pathname === pathname)) return true;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
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

    // Use Vercel's official Blob SDK delete operation with the private-store token.
    await del(pathname, {
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    // Remove the cover if this book has one.
    const name = pathname.split('/').pop().replace(/\.pdf$/i, '');
    const parts = name.split('__');
    const coverUrl = parts[3] ? decodePath(parts[3]) : '';

    if (coverUrl && coverUrl.startsWith('https://')) {
      try {
        await del(coverUrl, {
          token: process.env.BLOB_READ_WRITE_TOKEN,
        });
      } catch (coverError) {
        console.error('Cover delete failed:', coverError);
      }
    }

    // del() is asynchronous, so wait until the Blob API no longer lists the PDF.
    const deleted = await waitUntilDeleted(pathname);

    if (!deleted) {
      return res.status(500).json({
        error: 'Удаление запущено, но Vercel Blob пока не подтвердил исчезновение книги. Попробуйте обновить список через несколько секунд.',
      });
    }

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).json({ ok: true, deleted: pathname });
  } catch (error) {
    console.error('Book deletion failed:', error);
    return res.status(500).json({ error: error?.message || 'Не удалось удалить книгу.' });
  }
}
