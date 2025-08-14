import { jsPDF } from 'jspdf';
import * as pdfjs from 'pdfjs-dist';

// Use a CDN for the worker to avoid local setup complexities
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.mjs`;

export const convertTxtToPdf = async (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const textContent = event.target?.result as string;
        const pdf = new jsPDF();
        
        // Set properties
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(12);

        // Add text, handling page breaks
        const lines = pdf.splitTextToSize(textContent, 180); // 180mm width
        pdf.text(lines, 15, 15);
        
        resolve(pdf.output('blob'));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsText(file);
  });
};

export const extractTextFromPdf = async (pdfData: ArrayBuffer): Promise<string> => {
  if (pdfData.byteLength === 0) return "";
  
  const loadingTask = pdfjs.getDocument({ data: pdfData });
  const pdf = await loadingTask.promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => 'str' in item ? item.str : '').join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
};