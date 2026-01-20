import { PDFDocument, rgb } from 'pdf-lib'
import { generateQRCode } from './qr-utils'

interface QRPosition {
    page: number
    xPercent: number
    yPercent: number
    size: number
}

export interface StampConfig {
    page: number
    xPercent: number
    yPercent: number
    size: number
    type: 'QR' | 'IMAGE'
    data: string // generic data: verification url for QR, or base64 string for IMAGE
}

interface StampResult {
    pdfBytes: Uint8Array
    qrHash: string
}

/**
 * Stamp images (QR and/or Paraf) onto a PDF
 * @param pdfBytes - Original PDF as bytes
 * @param qrHash - Unique hash for verification URL
 * @param stamps - Array of stamp configurations
 */
export async function stampDocument(
    pdfBytes: Uint8Array,
    qrHash: string,
    stamps: StampConfig[]
): Promise<StampResult> {
    // Load the PDF
    const pdfDoc = await PDFDocument.load(pdfBytes)
    const pages = pdfDoc.getPages()

    for (const stamp of stamps) {
        // Validate page number
        const pageIndex = stamp.page - 1
        if (pageIndex < 0 || pageIndex >= pages.length) {
            continue; // Skip invalid pages
        }

        const targetPage = pages[pageIndex]
        const { width, height } = targetPage.getSize()

        let imageBytes: Uint8Array;

        if (stamp.type === 'QR') {
            // Generate QR code
            imageBytes = await generateQRCode(stamp.data, stamp.size)
        } else {
            // Process Base64 image
            // stamp.data is expected to be "data:image/png;base64,....."
            const base64Data = stamp.data.split(',')[1] || stamp.data
            imageBytes = Buffer.from(base64Data, 'base64')
        }

        const embeddedImage = await pdfDoc.embedPng(imageBytes)

        // Calculate position - size is percentage of paper width
        // Frontend stores size as 50-200 for QR and 20-100 for paraf
        // We'll interpret this as the actual point size on an A4-like document
        // For better accuracy, calculate size as percentage of page width
        const sizeAsPoints = stamp.size // Direct interpretation as points on standard A4

        // Position: xPercent and yPercent are 0-1 percentages
        // Center the image at the specified position
        const x = (stamp.xPercent * width) - (sizeAsPoints / 2)
        // PDF Y-axis is bottom-up, so we invert the yPercent
        const y = height - (stamp.yPercent * height) - (sizeAsPoints / 2)

        // Draw the image
        targetPage.drawImage(embeddedImage, {
            x: x,
            y: y,
            width: sizeAsPoints,
            height: sizeAsPoints,
        })

        // Add border if it's a QR code
        if (stamp.type === 'QR') {
            targetPage.drawRectangle({
                x: x - 2,
                y: y - 2,
                width: stamp.size + 4,
                height: stamp.size + 4,
                borderColor: rgb(0.8, 0.8, 0.8),
                borderWidth: 0.5,
            })
        }
    }

    // Save the modified PDF
    const stampedPdfBytes = await pdfDoc.save()

    return {
        pdfBytes: new Uint8Array(stampedPdfBytes),
        qrHash
    }
}

// Keep generic deprecated function for backward compatibility if needed, 
// or just export this one. 
// We'll export stampQRCode as a wrapper for backward compatibility during refactor
export async function stampQRCode(
    pdfBytes: Uint8Array,
    qrHash: string,
    position: { page: number; xPercent: number; yPercent: number; size: number },
    verifyUrl: string
): Promise<StampResult> {
    return stampDocument(pdfBytes, qrHash, [
        {
            ...position,
            type: 'QR',
            data: `${verifyUrl}/${qrHash}`
        }
    ])
}

/**
 * Get the total number of pages in a PDF
 */
export async function getPdfPageCount(pdfBytes: Uint8Array): Promise<number> {
    const pdfDoc = await PDFDocument.load(pdfBytes)
    return pdfDoc.getPageCount()
}

/**
 * Get PDF page dimensions
 */
export async function getPdfPageSize(pdfBytes: Uint8Array, pageNumber: number = 1) {
    const pdfDoc = await PDFDocument.load(pdfBytes)
    const pages = pdfDoc.getPages()
    const pageIndex = pageNumber - 1

    if (pageIndex < 0 || pageIndex >= pages.length) {
        throw new Error(`Invalid page number: ${pageNumber}`)
    }

    const page = pages[pageIndex]
    return page.getSize()
}

/**
 * Validate if a file is a valid PDF
 */
export async function isValidPdf(pdfBytes: Uint8Array): Promise<boolean> {
    try {
        await PDFDocument.load(pdfBytes)
        return true
    } catch {
        return false
    }
}

/**
 * Extract metadata from PDF
 */
export async function getPdfMetadata(pdfBytes: Uint8Array) {
    const pdfDoc = await PDFDocument.load(pdfBytes)
    return {
        title: pdfDoc.getTitle(),
        author: pdfDoc.getAuthor(),
        subject: pdfDoc.getSubject(),
        creator: pdfDoc.getCreator(),
        producer: pdfDoc.getProducer(),
        creationDate: pdfDoc.getCreationDate(),
        modificationDate: pdfDoc.getModificationDate(),
        pageCount: pdfDoc.getPageCount()
    }
}
