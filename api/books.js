export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN || '';
    const response = await fetch('https://blob.vercel-storage.com/?prefix=books/&limit=1000&cache=0', {
      headers: { Authorization: 'Bearer ' + token },
      cache: 'no-store',
    });

    if (!response.ok) throw new Error('Blob API returned ' + response.status);

    const data = await response.json();
    const blobs = Array.isArray(data.blobs) ? data.blobs : [];

    const books = blobs
      .filter((blob) => blob.pathname?.toLowerCase().endsWith('.pdf'))
      .map((blob) => {
        const name = blob.pathname.split('/').pop().replace(/\.pdf$/i, '');
        const parts = name.split('__');
        const title = decodeURIComponent(parts[1] || 'Книга');
        const author = decodeURIComponent(parts[2] || '');
        const coverUrl = parts[3] ? decodeURIComponent(parts[3]) : '';

        return {
          title,
          author,
          pathname: blob.pathname,
          blob_url: blob.url,
          file_url: '/api/book?url=' + encodeURIComponent(blob.url),
          cover_url: coverUrl ? '/api/book-cover?url=' + encodeURIComponent(coverUrl) : '',
          size: blob.size,
          uploadedAt: blob.uploadedAt,
        };
      })
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).json({ books });
  } catch (error) {
    console.error('Books list failed:', error);
    return res.status(500).json({ error: 'Не удалось получить список книг.', books: [] });
  }
}
