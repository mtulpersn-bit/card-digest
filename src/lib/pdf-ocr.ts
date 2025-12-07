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

export interface PageRange {
  start: number;
  end: number;
}

export function parsePageRange(rangeStr: string, totalPages: number): PageRange | null {
  if (!rangeStr || rangeStr === 'all') {
    return { start: 1, end: totalPages };
  }

  // Parse "0-3" or "4-7" format
  const match = rangeStr.match(/^(\d+)-(\d+)$/);
  if (match) {
    const start = parseInt(match[1], 10);
    const end = parseInt(match[2], 10);
    
    // Convert 0-indexed to 1-indexed for PDF pages
    // "0-3" means pages 1-4 (first 4 pages)
    const actualStart = start + 1;
    const actualEnd = Math.min(end + 1, totalPages);
    
    if (actualStart <= totalPages && actualStart <= actualEnd) {
      return { start: actualStart, end: actualEnd };
    }
  }

  return null;
}

export async function extractTextFromPdf(
  url: string,
  onProgress?: (p: OcrProgress) => void,
  lang: string = 'tur',
  pageRangeStr?: string
): Promise<string> {
  onProgress?.({ stage: 'loading' });

  const loadingTask = (pdfjsLib as any).getDocument({ url, useSystemFonts: true });
  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;

  // Parse page range
  const range = parsePageRange(pageRangeStr || 'all', totalPages);
  if (!range) {
    throw new Error('Geçersiz sayfa aralığı');
  }

  const pagesToProcess = range.end - range.start + 1;
  let fullText = '';
  let processedPages = 0;

  for (let pageNum = range.start; pageNum <= range.end; pageNum++) {
    processedPages++;
    onProgress?.({ stage: 'render', page: processedPages, totalPages: pagesToProcess });

    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2 });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas context oluşturulamadı');

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: context as any, viewport }).promise;

    onProgress?.({ stage: 'ocr', page: processedPages, totalPages: pagesToProcess, progress: 0 });

    const { data } = await Tesseract.recognize(canvas, lang, {
      logger: (m) => {
        if (m.status === 'recognizing text' && typeof m.progress === 'number') {
          onProgress?.({ stage: 'ocr', page: processedPages, totalPages: pagesToProcess, progress: m.progress });
        }
      },
    });

    const pageText = (data?.text || '').trim();
    if (pageText) {
      fullText += (fullText ? '\n\n' : '') + pageText;
    }
  }

  onProgress?.({ stage: 'done', page: pagesToProcess, totalPages: pagesToProcess });

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
