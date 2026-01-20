import QRCode from 'qrcode'

/**
 * Generate a QR code as PNG buffer
 * @param data - Data to encode in the QR code
 * @param size - Size of the QR code in pixels
 * @returns PNG image as Buffer/Uint8Array
 */
export async function generateQRCode(data: string, size: number = 100): Promise<Uint8Array> {
    const buffer = await QRCode.toBuffer(data, {
        type: 'png',
        width: size,
        margin: 1,
        color: {
            dark: '#000000',
            light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
    })

    return new Uint8Array(buffer)
}

/**
 * Generate QR code as data URL (for frontend preview)
 */
export async function generateQRCodeDataURL(data: string, size: number = 100): Promise<string> {
    return await QRCode.toDataURL(data, {
        width: size,
        margin: 1,
        color: {
            dark: '#000000',
            light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
    })
}

/**
 * Generate QR code as SVG string
 */
export async function generateQRCodeSVG(data: string): Promise<string> {
    return await QRCode.toString(data, {
        type: 'svg',
        margin: 1,
        color: {
            dark: '#000000',
            light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
    })
}

/**
 * Validate QR code content (basic validation)
 */
export function validateQRContent(data: string): boolean {
    // QR codes have a maximum data capacity based on error correction level
    // For alphanumeric data with M error correction: max ~2953 characters
    if (!data || data.length === 0) return false
    if (data.length > 2000) return false // Leave some margin
    return true
}
