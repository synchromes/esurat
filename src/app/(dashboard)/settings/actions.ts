'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/permissions'
import { requirePermission } from '@/lib/auth'

export async function updateSettings(formData: FormData) {
    try {
        const session = await requirePermission(PERMISSIONS.SETTINGS_EDIT)

        const keys = formData.getAll('keys[]') as string[]

        // Loop through all keys and update their values
        for (const key of keys) {
            const value = formData.get(`values_${key}`) as string

            if (value !== null) {
                await prisma.setting.update({
                    where: { key },
                    data: { value }
                })
            }
        }

        // Log this action
        await prisma.activityLog.create({
            data: {
                action: 'SETTINGS_UPDATE',
                description: `Updated system configuration keys: ${keys.slice(0, 3).join(', ')}... by ${session.user.name}`,
                userId: session.user.id,
            }
        })

        revalidatePath('/settings')
        revalidatePath('/dashboard') // In case app name changes
        return { success: true }
    } catch (error) {
        console.error('Update settings error:', error)
        return { success: false, error: 'Gagal melakukan penyimpanan pengaturan' }
    }
}
