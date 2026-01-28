'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { testTelegramConnection, saveTelegramConfig as saveTgConfig } from '@/lib/telegram'
import { createSession as createWaSession, updateSession as updateWaSession, deleteSession as deleteWaSession, syncSessionStatuses } from '@/lib/whatsapp'

// ==================== WHATSAPP SESSION ACTIONS ====================

export async function getWhatsAppSessions() {
    try {
        return await prisma.whatsAppSession.findMany({
            orderBy: [
                { isPrimary: 'desc' },
                { priority: 'asc' }
            ]
        })
    } catch (error) {
        return []
    }
}

export async function createWhatsAppSession(data: {
    name: string
    phoneNumber?: string
    isPrimary?: boolean
    priority?: number
    dailyLimit?: number
}) {
    try {
        await createWaSession(data)
        revalidatePath('/admin/notifications')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function updateWhatsAppSession(id: string, data: {
    isPrimary?: boolean
    priority?: number
    dailyLimit?: number
    isActive?: boolean
}) {
    try {
        await updateWaSession(id, data)
        revalidatePath('/admin/notifications')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function deleteWhatsAppSession(id: string) {
    try {
        await deleteWaSession(id)
        revalidatePath('/admin/notifications')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function syncWhatsAppSessions() {
    try {
        await syncSessionStatuses()
        revalidatePath('/admin/notifications')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

// ==================== TELEGRAM CONFIG ACTIONS ====================

export async function getTelegramConfig() {
    try {
        return await prisma.telegramConfig.findFirst()
    } catch (error) {
        return null
    }
}

export async function saveTelegramConfig(data: {
    botToken: string
    chatId: string
    botUsername?: string
    notifyOnSessionDisconnect?: boolean
    notifyOnSessionReconnect?: boolean
    notifyOnHighTraffic?: boolean
    notifyOnSystemError?: boolean
    notifyDailyReport?: boolean
    dailyReportTime?: string
}) {
    try {
        await saveTgConfig(data)
        revalidatePath('/admin/notifications')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function testTelegramBot(botToken: string, chatId: string) {
    try {
        const success = await testTelegramConnection(botToken, chatId)
        return { success }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}
