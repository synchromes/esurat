'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { PERMISSIONS, hasPermission } from '@/lib/permissions'

const categorySchema = z.object({
    name: z.string().min(1, 'Nama kategori harus diisi').max(100),
    code: z.string().min(1, 'Kode kategori harus diisi').max(20),
    description: z.string().optional(),
    color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Format warna harus HEX (contoh: #FF0000)').default('#3B82F6')
})

export async function getCategories() {
    try {
        const session = await requirePermission(PERMISSIONS.CATEGORY_VIEW)

        const categories = await prisma.letterCategory.findMany({
            orderBy: { name: 'asc' }
        })

        const canManage = await hasPermission(session.user.id, PERMISSIONS.CATEGORY_MANAGE)

        return { success: true, data: categories, canManage }
    } catch (error) {
        console.error('Get categories error:', error)
        return { success: false, error: 'Gagal mengambil data kategori' }
    }
}

export async function createCategory(data: z.infer<typeof categorySchema>) {
    try {
        await requirePermission(PERMISSIONS.CATEGORY_MANAGE)

        const validData = categorySchema.parse(data)

        // specific validation: unique name and code
        const existing = await prisma.letterCategory.findFirst({
            where: {
                OR: [
                    { name: validData.name },
                    { code: validData.code }
                ]
            }
        })

        if (existing) {
            return { success: false, error: 'Nama atau Kode kategori sudah ada' }
        }

        await prisma.letterCategory.create({
            data: validData
        })

        revalidatePath('/categories')
        return { success: true }
    } catch (error) {
        console.error('Create category error:', error)
        if (error instanceof z.ZodError) {
            return { success: false, error: (error as any).errors[0].message }
        }
        return { success: false, error: 'Gagal membuat kategori' }
    }
}

export async function updateCategory(id: string, data: z.infer<typeof categorySchema>) {
    try {
        await requirePermission(PERMISSIONS.CATEGORY_MANAGE)

        const validData = categorySchema.parse(data)

        // Validation unique exclude self
        const existing = await prisma.letterCategory.findFirst({
            where: {
                AND: [
                    { id: { not: id } },
                    {
                        OR: [
                            { name: validData.name },
                            { code: validData.code }
                        ]
                    }
                ]
            }
        })

        if (existing) {
            return { success: false, error: 'Nama atau Kode kategori sudah digunakan' }
        }

        await prisma.letterCategory.update({
            where: { id },
            data: validData
        })

        revalidatePath('/categories')
        return { success: true }
    } catch (error) {
        console.error('Update category error:', error)
        if (error instanceof z.ZodError) {
            return { success: false, error: (error as any).errors[0].message }
        }
        return { success: false, error: 'Gagal mengupdate kategori' }
    }
}

export async function deleteCategory(id: string) {
    try {
        await requirePermission(PERMISSIONS.CATEGORY_MANAGE)

        // Check if used in letters
        const count = await prisma.letter.count({
            where: { categoryId: id }
        })

        if (count > 0) {
            return { success: false, error: `Kategori sedang digunakan oleh ${count} surat. Tidak dapat dihapus.` }
        }

        await prisma.letterCategory.delete({
            where: { id }
        })

        revalidatePath('/categories')
        return { success: true }
    } catch (error) {
        console.error('Delete category error:', error)
        return { success: false, error: 'Gagal menghapus kategori' }
    }
}
