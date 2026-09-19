import { handleUpload } from '@vercel/blob/client';
import { isAdmin } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Vercel Node API routes expose the parsed request body as req.body.\n    const body = req.body;

    // Client token generation must come from an authenticated admin.
    // Upload-completed callbacks are authenticated by Vercel Blob itself.
    if (body?.type !== 'blob.upload-completed' && !isAdmin(req)) {
      return res.status(401).json({ error: 'Требуется вход администратора.' });
    }

    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!pathname.startsWith('books/') || !pathname.toLowerCase().endsWith('.pdf')) {
          throw new Error('Разрешены только PDF-файлы в разделе books.');
        }

        let meta = {};
        try { meta = JSON.parse(clientPayload || '{}'); } catch {}

        const title = String(meta.title || '').trim().slice(0, 180);
        const author = String(meta.author || '').trim().slice(0, 120);

        if (!title) throw new Error('Название книги обязательно.');

        return {
          allowedContentTypes: ['application/pdf'],
          maximumSizeInBytes: 200 * 1024 * 1024,
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({ title, author }),
        };
      },
      onUploadCompleted: async ({ blob }) => {
        if (!blob.pathname.startsWith('books/') || !blob.pathname.toLowerCase().endsWith('.pdf')) {
          throw new Error('Недопустимый путь книги.');
        }
      },
    });

    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
