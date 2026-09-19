import { handleUpload } from '@vercel/blob/client';
import { isAdmin } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Vercel Node API routes parse the JSON body into req.body.
    const body = req.body;

    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Некорректное тело запроса.' });
    }

    // Client token generation must come from an authenticated admin.
    // Upload-completed callbacks are authenticated by Vercel Blob itself.
    if (body.type !== 'blob.upload-completed' && !isAdmin(req)) {
      return res.status(401).json({ error: 'Требуется вход администратора.' });
    }

    // Client-token generation requires the Blob read-write token specifically.
    // Pass it explicitly so the deployment cannot accidentally resolve a different credential.
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (!blobToken) {
      throw new Error('BLOB_READ_WRITE_TOKEN не настроен в окружении Vercel.');
    }

    const result = await handleUpload({
      token: blobToken,
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!pathname.startsWith('books/') || !pathname.toLowerCase().endsWith('.pdf')) {
          throw new Error('Разрешены только PDF-файлы в разделе books.');
        }

        let meta = {};
        if (typeof clientPayload === 'string') {
          try {
            meta = JSON.parse(clientPayload || '{}');
          } catch {
            throw new Error('Некорректные данные книги.');
          }
        } else if (clientPayload && typeof clientPayload === 'object') {
          meta = clientPayload;
        }

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
