import { writeFile, mkdir, unlink, stat } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

// Upload directories
const UPLOAD_BASE = process.env.UPLOAD_DIR || './public/uploads'
export const UPLOAD_PATHS = {
    drafts: path.join(UPLOAD_BASE, 'drafts'),
    stamped: path.join(UPLOAD_BASE, 'stamped'),
    signed: path.join(UPLOAD_BASE, 'signed'),
    templates: path.join(UPLOAD_BASE, 'templates'),
}

// Maximum file size (default: 10MB)
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760')

// Allowed file types
const ALLOWED_TYPES = ['application/pdf']
const ALLOWED_EXTENSIONS = ['.pdf']

/**
 * Initialize upload directories
 */
export async function initUploadDirs(): Promise<void> {
    for (const dir of Object.values(UPLOAD_PATHS)) {
        if (!existsSync(dir)) {
            await mkdir(dir, { recursive: true })
        }
    }
}

/**
 * Validate uploaded file
 */
export function validateFile(
    file: File,
    options: { maxSize?: number; allowedTypes?: string[] } = {}
): { valid: boolean; error?: string } {
    const maxSize = options.maxSize || MAX_FILE_SIZE
    const allowedTypes = options.allowedTypes || ALLOWED_TYPES

    // Check file size
    if (file.size > maxSize) {
        return {
            valid: false,
            error: `Ukuran file terlalu besar. Maksimum ${formatFileSize(maxSize)}`
        }
    }

    // Check file type
    if (!allowedTypes.includes(file.type)) {
        return {
            valid: false,
            error: `Tipe file tidak didukung. Hanya ${ALLOWED_EXTENSIONS.join(', ')} yang diperbolehkan`
        }
    }

    return { valid: true }
}

/**
 * Save uploaded file to disk
 */
export async function saveFile(
    file: File,
    directory: keyof typeof UPLOAD_PATHS,
    customFilename?: string
): Promise<{ filename: string; filepath: string; publicUrl: string }> {
    // Ensure directory exists
    await initUploadDirs()

    // Generate unique filename
    const ext = path.extname(file.name)
    const filename = customFilename || `${uuidv4()}${ext}`
    const filepath = path.join(UPLOAD_PATHS[directory], filename)

    // Convert File to buffer and save
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    await writeFile(filepath, buffer)

    // Generate public URL (use API route for dynamic serving)
    const publicUrl = `/api/uploads/${directory}/${filename}`

    return { filename, filepath, publicUrl }
}

/**
 * Save buffer to file
 */
export async function saveBuffer(
    buffer: Buffer | Uint8Array,
    directory: keyof typeof UPLOAD_PATHS,
    filename: string
): Promise<{ filepath: string; publicUrl: string }> {
    await initUploadDirs()

    const filepath = path.join(UPLOAD_PATHS[directory], filename)
    await writeFile(filepath, buffer)

    const publicUrl = `/api/uploads/${directory}/${filename}`

    return { filepath, publicUrl }
}

/**
 * Delete a file
 */
export async function deleteFile(filepath: string): Promise<boolean> {
    try {
        if (existsSync(filepath)) {
            await unlink(filepath)
            return true
        }
        return false
    } catch (error) {
        console.error('Error deleting file:', error)
        return false
    }
}

/**
 * Get file info
 */
export async function getFileInfo(filepath: string) {
    try {
        const stats = await stat(filepath)
        return {
            exists: true,
            size: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime
        }
    } catch {
        return { exists: false }
    }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Extract filename from path
 */
export function getFilenameFromPath(filepath: string): string {
    return path.basename(filepath)
}

/**
 * Get file extension
 */
export function getFileExtension(filename: string): string {
    return path.extname(filename).toLowerCase()
}
