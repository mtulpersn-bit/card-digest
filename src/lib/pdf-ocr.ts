// Free client-side PDF OCR using pdfjs-dist and tesseract.js
// Renders each page to a canvas, then performs OCR (Turkish by default)

import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';

// Use official pdf.js worker from CDN to avoid bundler worker config
(pdfjsLib as any).GlobalWorkerOptions.workerSrc =
  'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

export type OcrProgress = {
  stage: 'loading' | 'render' | 'ocr' | 'done';
  page?: number;
  totalPages?: number;
  progress?: number; // 0..1 for OCR progress per page
};

export async function extractTextFromPdf(
  url: string,
  onProgress?: (p: OcrProgress) => void,
  lang: string = 'tur'
): Promise<string> {
  onProgress?.({ stage: 'loading' });

  const loadingTask = (pdfjsLib as any).getDocument({ url, useSystemFonts: true });
  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;

  let fullText = '';

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    onProgress?.({ stage: 'render', page: pageNum, totalPages });

    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2 });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas context oluşturulamadı');

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: context as any, viewport }).promise;

    onProgress?.({ stage: 'ocr', page: pageNum, totalPages, progress: 0 });

    const { data } = await Tesseract.recognize(canvas, lang, {
      logger: (m) => {
        if (m.status === 'recognizing text' && typeof m.progress === 'number') {
          onProgress?.({ stage: 'ocr', page: pageNum, totalPages, progress: m.progress });
        }
      },
    });

    const pageText = (data?.text || '').trim();
    if (pageText) {
      fullText += (fullText ? '\n\n' : '') + pageText;
    }
  }

  onProgress?.({ stage: 'done', page: totalPages, totalPages });

  const cleaned = fullText
    .replace(/\u0000/g, ' ')
    .replace(/[\t\r]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!cleaned || cleaned.length < 10) {
    throw new Error('PDF dosyasından yeterli metin çıkarılamadı');
  }

  return cleaned;
}
