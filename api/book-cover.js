import { Readable } from 'node:stream';

function getTarget(req) {
  if (typeof req.query.url === 'string' && req.query.url) return req.query.url;
  if (typeof req.query.pathname === 'string' && req.query.pathname) {
    const raw = req.query.pathname;
    const storeId = process.env.BLOB_STORE_ID;
    if (storeId) {
      const encodedPath = raw.split('/').map((part) => encodeURIComponent(part)).join('/');
      return `https://${storeId}.private.blob.vercel-storage.com/${encodedPath}`;
    }
    return raw;
  }
  return '';
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  const target = getTarget(req);

  if (!target || !target.startsWith('https://')) {
    return res.status(400).send('Недопустимая обложка.');
  }

  try {
    const response = await fetch(target, {
      headers: {
        Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN || ''}`,
      },
    });

    if (!response.ok || !response.body) {
      console.error('Book cover delivery failed:', response.status, response.statusText);
      return res.status(404).send('Обложка не найдена.');
    }

    res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=300');

    return Readable.fromWeb(response.body).pipe(res);
  } catch (error) {
    console.error('Book cover delivery failed:', error);
    return res.status(404).send('Обложка не найдена.');
  }
}
