import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const UPLOAD_BASE = process.env.UPLOAD_DIR || './public/uploads'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    try {
        const resolvedParams = await params
        const filePath = resolvedParams.path.join('/')
        const fullPath = path.join(UPLOAD_BASE, filePath)

        // Security: Prevent directory traversal
        const normalizedPath = path.normalize(fullPath)
        const normalizedBase = path.normalize(UPLOAD_BASE)
        if (!normalizedPath.startsWith(normalizedBase)) {
            return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
        }

        // Check if file exists
        if (!existsSync(fullPath)) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 })
        }

        // Read file
        const fileBuffer = await readFile(fullPath)

        // Determine content type
        const ext = path.extname(filePath).toLowerCase()
        let contentType = 'application/octet-stream'
        if (ext === '.pdf') contentType = 'application/pdf'
        else if (ext === '.png') contentType = 'image/png'
        else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg'

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': contentType,
                'Content-Length': fileBuffer.length.toString(),
                'Cache-Control': 'public, max-age=3600',
            },
        })
    } catch (error) {
        console.error('File serving error:', error)
        return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 })
    }
}
