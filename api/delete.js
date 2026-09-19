import { del } from '@vercel/blob';
import { isAdmin } from './_auth.js';

function decodePath(value = '') {
  try { return decodeURIComponent(value); } catch { return value; }
}

async function listBooksFresh() {
  const token = process.env.BLOB_READ_WRITE_TOKEN || '';
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN не настроен.');

  const response = await fetch(
    'https://blob.vercel-storage.com/?prefix=books/&limit=1000&cache=0',
    {
      headers: { Authorization: 'Bearer ' + token },
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    throw new Error('Не удалось получить список файлов из Blob.');
  }

  const data = await response.json();
  return Array.isArray(data.blobs) ? data.blobs : [];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isAdmin(req)) {
    return res.status(401).json({ error: 'Требуется вход администратора.' });
  }

  const rawPath = typeof req.body?.pathname === 'string' ? req.body.pathname : '';
  const pathname = decodePath(rawPath);

  if (
    !pathname ||
    !pathname.startsWith('books/') ||
    !pathname.toLowerCase().endsWith('.pdf')
  ) {
    return res.status(400).json({ error: 'Недопустимый файл.' });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN || '';

  try {
    const blobs = await listBooksFresh();
    const target = blobs.find(
      (blob) => blob.pathname === pathname || decodePath(blob.pathname) === pathname
    );

    if (!target) {
      return res.status(404).json({ error: 'Книга уже удалена или не найдена.' });
    }

    // Delete using the exact Blob URL returned by the Blob API.
    // This avoids pathname encoding mismatches.
    await del(target.url, { token });

    // Covers are encoded into the PDF filename as the 4th "__" segment.
    const filename = pathname.split('/').pop() || '';
    const withoutPdf = filename.replace(/\.pdf$/i, '');
    const parts = withoutPdf.split('__');
    const coverUrl = parts.length >= 4
      ? decodePath(parts.slice(3).join('__'))
      : '';

    if (coverUrl.startsWith('https://')) {
      try {
        await del(coverUrl, { token });
      } catch (coverError) {
        // The PDF is already deleted; a missing cover must not make the
        // whole operation look like a failed book deletion.
        console.error('Cover delete failed:', coverError);
      }
    }

    res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
    return res.status(200).json({
      ok: true,
      deleted: pathname,
      deletedUrl: target.url,
    });
  } catch (error) {
    console.error('Book deletion failed:', error);
    res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
    return res.status(500).json({
      error: error?.message || 'Не удалось удалить книгу.',
    });
  }
}
