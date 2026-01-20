'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { PERMISSIONS, hasPermission } from '@/lib/permissions'
import { saveFile, deleteFile } from '@/lib/upload'

const createTemplateSchema = z.object({
    title: z.string().min(1, 'Judul harus diisi').max(255),
    description: z.string().optional()
})

export async function getTemplates() {
    try {
        const session = await requirePermission(PERMISSIONS.TEMPLATE_VIEW)

        const templates = await prisma.template.findMany({
            include: {
                uploader: {
                    select: {
                        name: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        })

        // Check if user has manage permission to determine if they can delete
        const canManage = await hasPermission(session.user.id, PERMISSIONS.TEMPLATE_MANAGE)

        return { success: true, data: templates, canManage }
    } catch (error) {
        console.error('Get templates error:', error)
        return { success: false, error: 'Gagal mengambil data template' }
    }
}

export async function createTemplate(formData: FormData) {
    try {
        const session = await requirePermission(PERMISSIONS.TEMPLATE_MANAGE)

        const file = formData.get('file') as File
        if (!file || file.size === 0) {
            return { success: false, error: 'File template harus diunggah' }
        }

        // Validate file type (PDF or Word)
        const validTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ]
        if (!validTypes.includes(file.type)) {
            return { success: false, error: 'Format file harus PDF atau Word (.doc, .docx)' }
        }

        const rawData = {
            title: formData.get('title') as string,
            description: formData.get('description') as string
        }

        const data = createTemplateSchema.parse(rawData)

        // Save file
        const { publicUrl } = await saveFile(file, 'templates')

        // Determine simple file type label
        const fileType = file.type === 'application/pdf' ? 'PDF' : 'DOCX'

        await prisma.template.create({
            data: {
                title: data.title,
                description: data.description,
                fileUrl: publicUrl,
                fileType,
                uploaderId: session.user.id
            }
        })

        revalidatePath('/templates')
        return { success: true }
    } catch (error) {
        console.error('Create template error:', error)
        if (error instanceof z.ZodError) {
            return { success: false, error: (error as any).errors[0].message }
        }
        return { success: false, error: 'Gagal membuat template' }
    }
}

export async function deleteTemplate(id: string) {
    try {
        await requirePermission(PERMISSIONS.TEMPLATE_MANAGE)

        const template = await prisma.template.findUnique({
            where: { id }
        })

        if (!template) {
            return { success: false, error: 'Template tidak ditemukan' }
        }

        // Delete file
        await deleteFile(template.fileUrl)

        // Delete record
        await prisma.template.delete({
            where: { id }
        })

        revalidatePath('/templates')
        return { success: true }
    } catch (error) {
        console.error('Delete template error:', error)
        return { success: false, error: 'Gagal menghapus template' }
    }
}
