import { handleUpload } from '@vercel/blob/client';
import { isAdmin } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body;

    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Некорректное тело запроса.' });
    }

    if (body.type !== 'blob.upload-completed' && !isAdmin(req)) {
      return res.status(401).json({ error: 'Требуется вход администратора.' });
    }

    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (!blobToken) {
      throw new Error('BLOB_READ_WRITE_TOKEN не настроен в окружении Vercel.');
    }

    const result = await handleUpload({
      token: blobToken,
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let meta = {};
        if (typeof clientPayload === 'string') {
          try {
            meta = JSON.parse(clientPayload || '{}');
          } catch {
            throw new Error('Некорректные данные загрузки.');
          }
        } else if (clientPayload && typeof clientPayload === 'object') {
          meta = clientPayload;
        }

        const kind = String(meta.kind || 'book');

        if (kind === 'cover') {
          if (!pathname.startsWith('covers/')) {
            throw new Error('Обложка должна загружаться в раздел covers.');
          }

          return {
            allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
            maximumSizeInBytes: 15 * 1024 * 1024,
            addRandomSuffix: false,
            tokenPayload: JSON.stringify({ kind: 'cover' }),
          };
        }

        if (!pathname.startsWith('books/') || !pathname.toLowerCase().endsWith('.pdf')) {
          throw new Error('Разрешены только PDF-файлы в разделе books.');
        }

        const title = String(meta.title || '').trim().slice(0, 180);
        const author = String(meta.author || '').trim().slice(0, 120);
        const coverPath = String(meta.coverPath || '').trim();

        if (!title) throw new Error('Название книги обязательно.');

        return {
          allowedContentTypes: ['application/pdf'],
          maximumSizeInBytes: 200 * 1024 * 1024,
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({ title, author, coverPath }),
        };
      },
      onUploadCompleted: async ({ blob }) => {
        const isBook = blob.pathname.startsWith('books/') && blob.pathname.toLowerCase().endsWith('.pdf');
        const isCover = blob.pathname.startsWith('covers/') && /\.(jpe?g|png|webp)$/i.test(blob.pathname);

        if (!isBook && !isCover) {
          throw new Error('Недопустимый путь файла.');
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
