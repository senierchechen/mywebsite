import { get } from '@vercel/blob';
import { Readable } from 'node:stream';

function getTarget(req) {
  if (typeof req.query.url === 'string' && req.query.url) return req.query.url;
  if (typeof req.query.pathname === 'string' && req.query.pathname) {
    try {
      return decodeURIComponent(req.query.pathname);
    } catch {
      return req.query.pathname;
    }
  }
  return '';
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  const target = getTarget(req);

  if (!target || (!target.startsWith('https://') && !target.startsWith('books/'))) {
    return res.status(400).send('Недопустимый файл.');
  }

  try {
    const result = await get(target, {
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
