
/**
 * Converts each page of a PDF file into a base64 encoded JPEG image.
 * This is necessary for sending visual data to the Gemini Pro Vision model.
 */
export async function convertPdfToImages(file: File): Promise<string[]> {
  const pdfjsLib = (window as any).pdfjsLib;
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const imageUrls: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 }); // Reasonable scale for handwriting readability
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    if (context) {
      await page.render({ canvasContext: context, viewport }).promise;
      imageUrls.push(canvas.toDataURL('image/jpeg', 0.8));
    }
  }

  return imageUrls;
}
