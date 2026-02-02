
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { mergeDispositionAndLetter } from '@/lib/pdf-generator'
import { requireAuth } from '@/lib/auth'

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await requireAuth()
        const { id } = await params

        // Fetch letter and its dispositions
        const letter = await prisma.letter.findUnique({
            where: { id },
            include: {
                dispositions: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        })

        if (!letter) {
            return new NextResponse('Surat tidak ditemukan', { status: 404 })
        }

        if (!letter.fileFinal) {
            return new NextResponse('Surat belum ditandatangani', { status: 400 })
        }

        const latestDisposition = letter.dispositions[0]

        // If no disposition or disposition not signed (no fileDraft/fileFinal), return just the letter?
        // Or error? User wants "Download surat beserta disposisi".
        // If NO disposition, maybe just redirect to letter file?
        // But the button says "Gabungan".
        // If disposition exists but is not signed (draft), we can use fileDraft? 
        // User said "disposisi di TTE > surat selesai".
        // Let's assume we need a valid disposition file.

        let dispostionFile = latestDisposition?.fileDraft // or fileFinal if we implement signed disposition storage separately

        // Check if disposition file exists (it relies on fileDraft currently per schema)
        if (!latestDisposition || !dispostionFile) {
            return new NextResponse('Disposisi belum tersedia atau belum dicetak', { status: 404 })
        }

        const mergedPdf = await mergeDispositionAndLetter(dispostionFile, letter.fileFinal)

        if (!mergedPdf) {
            return new NextResponse('Gagal menggabungkan dokumen', { status: 500 })
        }

        // Return PDF
        const filename = `Bundle-${letter.letterNumber ? letter.letterNumber.replace(/\//g, '-') : 'surat'}.pdf`

        return new NextResponse(mergedPdf, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`
            }
        })

    } catch (error) {
        console.error('Download Bundle Error:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
