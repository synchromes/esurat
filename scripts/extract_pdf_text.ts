
import fs from 'fs';
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function extractText(path: string) {
    try {
        console.log(`Reading file: ${path}`);
        const data = new Uint8Array(fs.readFileSync(path));

        console.log('Parsing PDF...');
        const loadingTask = pdfjsLib.getDocument({
            data,
            // Disable worker for Node environment if possible, or use standard
            disableFontFace: true,
        });

        const doc = await loadingTask.promise;
        console.log(`Total Pages: ${doc.numPages}`);

        let fullText = '';
        // Read all pages or a subset? The user wants "comprehensive", so probably valid codes are in the attachment (Lampiran).
        // Usually Lampiran is at the end.
        // Let's read the whole thing but save to file.

        for (let i = 1; i <= doc.numPages; i++) {
            if (i % 10 === 0) console.log(`Processing page ${i}...`);
            const page = await doc.getPage(i);
            const content = await page.getTextContent();
            // @ts-ignore
            const strings = content.items.map((item: any) => item.str);
            fullText += `\n--- Page ${i} ---\n` + strings.join(' ') + '\n';
        }

        fs.writeFileSync('permendagri_text.txt', fullText);
        console.log('Extraction complete. Saved to permendagri_text.txt');
    } catch (error) {
        console.error('Error extracting text:', error);
    }
}

extractText('d:\\laragon\\www\\e-surat2\\Permendagri Nomor 1 Tahun 2023.pdf');
