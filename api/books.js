import { list } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { blobs } = await list({ prefix: 'books/', limit: 1000 });

    const books = blobs
      .filter((blob) => blob.pathname.toLowerCase().endsWith('.pdf'))
      .map((blob) => {
        const name = blob.pathname.split('/').pop().replace(/\.pdf$/i, '');
        const parts = name.split('__');
        const title = decodeURIComponent(parts[1] || 'Книга');
        const author = decodeURIComponent(parts[2] || '');
        const coverPath = parts[3] ? decodeURIComponent(parts[3]) : '';

        return {
          title,
          author,
          pathname: blob.pathname,
          file_url: '/api/book?pathname=' + encodeURIComponent(blob.pathname),
          cover_pathname: coverPath,
          cover_url: coverPath
            ? '/api/book-cover?pathname=' + encodeURIComponent(coverPath)
            : '',
          size: blob.size,
          uploadedAt: blob.uploadedAt,
        };
      })
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({ books });
  } catch {
    return res.status(500).json({
      error: 'Не удалось получить список книг.',
      books: [],
    });
  }
}
