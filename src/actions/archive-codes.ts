'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { PERMISSIONS, hasPermission } from '@/lib/permissions'

const archiveCodeSchema = z.object({
    code: z.string().min(1, 'Kode harus diisi').max(20),
    name: z.string().optional(),
    description: z.string().optional()
})

export async function getArchiveCodes() {
    try {
        const session = await requirePermission(PERMISSIONS.ARCHIVE_CODE_VIEW)

        const codes = await prisma.archiveCode.findMany({
            orderBy: { code: 'asc' }
        })

        const canManage = await hasPermission(session.user.id, PERMISSIONS.ARCHIVE_CODE_MANAGE)

        return { success: true, data: codes, canManage }
    } catch (error) {
        console.error('Get archive codes error:', error)
        return { success: false, error: 'Gagal mengambil data kode arsip' }
    }
}

export async function createArchiveCode(data: z.infer<typeof archiveCodeSchema>) {
    try {
        await requirePermission(PERMISSIONS.ARCHIVE_CODE_MANAGE)

        const validData = archiveCodeSchema.parse(data)

        // specific validation: unique code
        const existing = await prisma.archiveCode.findUnique({
            where: { code: validData.code }
        })

        if (existing) {
            return { success: false, error: 'Kode arsip sudah ada' }
        }

        await prisma.archiveCode.create({
            data: validData
        })

        revalidatePath('/archive-codes')
        return { success: true }
    } catch (error) {
        console.error('Create archive code error:', error)
        if (error instanceof z.ZodError) {
            return { success: false, error: (error as any).errors[0].message }
        }
        return { success: false, error: 'Gagal membuat kode arsip' }
    }
}

export async function updateArchiveCode(id: string, data: z.infer<typeof archiveCodeSchema>) {
    try {
        await requirePermission(PERMISSIONS.ARCHIVE_CODE_MANAGE)

        const validData = archiveCodeSchema.parse(data)

        // Validation unique exclude self (for code)
        const existing = await prisma.archiveCode.findFirst({
            where: {
                AND: [
                    { id: { not: id } },
                    { code: validData.code }
                ]
            }
        })

        if (existing) {
            return { success: false, error: 'Kode arsip sudah digunakan' }
        }

        await prisma.archiveCode.update({
            where: { id },
            data: validData
        })

        revalidatePath('/archive-codes')
        return { success: true }
    } catch (error) {
        console.error('Update archive code error:', error)
        if (error instanceof z.ZodError) {
            return { success: false, error: (error as any).errors[0].message }
        }
        return { success: false, error: 'Gagal mengupdate kode arsip' }
    }
}

export async function deleteArchiveCode(id: string) {
    try {
        await requirePermission(PERMISSIONS.ARCHIVE_CODE_MANAGE)

        await prisma.archiveCode.delete({
            where: { id }
        })

        revalidatePath('/archive-codes')
        return { success: true }
    } catch (error) {
        console.error('Delete archive code error:', error)
        return { success: false, error: 'Gagal menghapus kode arsip' }
    }
}
