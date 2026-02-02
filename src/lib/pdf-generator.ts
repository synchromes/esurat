
import puppeteer from 'puppeteer'
import { PDFDocument } from 'pdf-lib'
import path from 'path'
import fs from 'fs'
import { prisma } from './prisma'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export async function generateDispositionPdf(dispositionId: string) {
    let browser
    try {
        // Fetch disposition to get detail suitable name or validation
        const disposition = await prisma.disposition.findUnique({
            where: { id: dispositionId },
            include: { letter: true }
        })

        if (!disposition) throw new Error('Disposition not found')

        // Ensure directories exist
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'dispositions', 'drafts')
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true })
        }

        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        })

        const page = await browser.newPage()

        // Authenticate? Or ensure the route is accessible or use a special signed URL.
        // For simplicity in this environment, assuming localhost access or public-ish route for print.
        // Actually /print/dispositions/[id] might require auth.
        // Puppeteer doesn't share session. 
        // We might need a special token or "render mode" that bypasses auth if accessed from localhost with a secret.
        // Or we pass cookies. Getting cookies is hard here.
        // Best approach: A route handler /api/render-disposition/[id] that validates a temporary token, 
        // OR pass a "secret" query param that only server knows.

        const renderSecret = process.env.RENDER_SECRET || 'secret-render-key'
        const url = `${APP_URL}/print/dispositions/${dispositionId}?mode=pdf&secret=${renderSecret}`

        await page.goto(url, { waitUntil: 'networkidle0' })

        // Wait for content (QR Code might be async)
        // await page.waitForSelector('.qr-code-container') 

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '1cm',
                right: '1cm',
                bottom: '1cm',
                left: '1cm'
            }
        })

        const safeNumber = disposition.number ? disposition.number.replace(/\//g, '-') : 'draft'
        const filename = `disposition-${safeNumber}-draft.pdf`
        const filePath = path.join(uploadDir, filename)
        const publicPath = `/uploads/dispositions/drafts/${filename}`

        fs.writeFileSync(filePath, Buffer.from(pdfBuffer)) // Convert Uint8Array to Buffer

        // Update DB
        await prisma.disposition.update({
            where: { id: dispositionId },
            data: {
                fileDraft: publicPath
            }
        })

        return { success: true, filePath: publicPath }

    } catch (error) {
        console.error('PDF Generation Error:', error)
        return { success: false, error: 'Failed to generate PDF' }
    } finally {
        if (browser) await browser.close()
    }
}

export async function mergeDispositionAndLetter(dispositionPath: string, letterPath: string): Promise<Uint8Array | null> {
    try {
        // Resolve absolute paths
        // Convert API URL path (/api/uploads/...) to Permission file system path
        const resolvePath = (inputPath: string) => {
            if (inputPath.startsWith('/api/uploads/')) {
                // Remove /api/uploads/ prefix
                const relativePath = inputPath.replace('/api/uploads/', '')
                return path.join(process.cwd(), 'public', 'uploads', relativePath)
            } else if (inputPath.startsWith('/uploads/')) {
                // Standard public folder
                return path.join(process.cwd(), 'public', inputPath)
            } else if (inputPath.startsWith('/')) {
                // Other public folder path
                return path.join(process.cwd(), 'public', inputPath)
            }
            return inputPath
        }

        const fullDispPath = resolvePath(dispositionPath)
        const fullLetterPath = resolvePath(letterPath)

        if (!fs.existsSync(fullDispPath) || !fs.existsSync(fullLetterPath)) {
            console.error('File not found for merge:', { fullDispPath, fullLetterPath })
            return null
        }

        const dispBytes = fs.readFileSync(fullDispPath)
        const letterBytes = fs.readFileSync(fullLetterPath)

        const mergedPdf = await PDFDocument.create()
        const dispPdf = await PDFDocument.load(dispBytes)
        const letterPdf = await PDFDocument.load(letterBytes)

        // Copy all pages from Disposition
        const dispPages = await mergedPdf.copyPages(dispPdf, dispPdf.getPageIndices())
        dispPages.forEach((page) => mergedPdf.addPage(page))

        // Copy all pages from Letter
        const letterPages = await mergedPdf.copyPages(letterPdf, letterPdf.getPageIndices())
        letterPages.forEach((page) => mergedPdf.addPage(page))

        const mergedBytes = await mergedPdf.save()
        return mergedBytes

    } catch (error) {
        console.error('Merge PDF Error:', error)
        return null
    }
}
