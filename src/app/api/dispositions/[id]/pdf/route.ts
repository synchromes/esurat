import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateDispositionPdf } from '@/lib/pdf-generator'
import { redirect } from 'next/navigation'

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params

    try {
        const disposition = await prisma.disposition.findUnique({
            where: { id },
            select: { id: true, fileDraft: true, number: true }
        })

        if (!disposition) {
            return NextResponse.json({ error: 'Disposition not found' }, { status: 404 })
        }

        if (disposition.fileDraft) {
            // Check if file exists in filesystem? Or just redirect.
            // If we regenerate every time number changes, fine.
            return redirect(disposition.fileDraft)
        }

        // If no file, generate it
        const result = await generateDispositionPdf(id)
        if (result.success && result.filePath) {
            return redirect(result.filePath)
        } else {
            return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
        }

    } catch (error) {
        console.error('API PDF Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
