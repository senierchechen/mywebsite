import { get } from '@vercel/blob';
import { Readable } from 'node:stream';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  const pathname = typeof req.query.pathname === 'string' ? req.query.pathname : '';

  if (!pathname || !pathname.startsWith('books/') || !pathname.toLowerCase().endsWith('.pdf')) {
    return res.status(400).send('Недопустимый файл.');
  }

  try {
    const result = await get(pathname, { access: 'private' });

    if (!result || result.statusCode !== 200) {
      return res.status(404).send('Книга не найдена.');
    }

    res.setHeader('Content-Type', result.blob.contentType || 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=300');

    return Readable.fromWeb(result.stream).pipe(res);
  } catch {
    return res.status(404).send('Книга не найдена.');
  }
}
