import { get } from '@vercel/blob';
import { Readable } from 'node:stream';

function decodePath(value = '') {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  const encodedPathname = typeof req.query.pathname === 'string' ? req.query.pathname : '';
  const pathname = decodePath(encodedPathname);

  if (!pathname || !pathname.startsWith('books/') || !pathname.toLowerCase().endsWith('.pdf')) {
    return res.status(400).send('Недопустимый файл.');
  }

  try {
    const result = await get(pathname, {
      access: 'private',
      token: process.env.BLOB_READ_WRITE_TOKEN,
      useCache: false,
    });

    if (!result || result.statusCode !== 200) {
      return res.status(404).send('Книга не найдена.');
    }

    res.setHeader('Content-Type', result.blob.contentType || 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=300');

    return Readable.fromWeb(result.stream).pipe(res);
  } catch (error) {
    console.error('Book delivery failed:', error);
    return res.status(404).send('Книга не найдена.');
  }
}
