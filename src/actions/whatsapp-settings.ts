'use server'

import { requirePermission } from '@/lib/auth'
import { PERMISSIONS } from '@/lib/permissions'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

async function getConfig() {
    const settings = await prisma.setting.findMany({
        where: { key: { in: ['wa.api_url', 'wa.session', 'wa.api_key'] } }
    })
    const map = settings.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {} as Record<string, string>)
    return {
        url: map['wa.api_url'] || process.env.WA_API_URL || 'http://localhost:5001',
        session: map['wa.session'] || process.env.WA_SESSION || 'esurat',
        apiKey: map['wa.api_key'] || process.env.WA_API_KEY || ''
    }
}

export async function getGlobalSettings() {
    await requirePermission(PERMISSIONS.SETTINGS_VIEW)
    const config = await getConfig()
    return { success: true, data: config }
}

export async function saveGlobalSettings(url: string, session: string, apiKey?: string) {
    try {
        await requirePermission(PERMISSIONS.SETTINGS_EDIT)
        // Upsert settings
        await prisma.setting.upsert({
            where: { key: 'wa.api_url' },
            create: { key: 'wa.api_url', value: url, type: 'string' },
            update: { value: url }
        })
        await prisma.setting.upsert({
            where: { key: 'wa.session' },
            create: { key: 'wa.session', value: session, type: 'string' },
            update: { value: session }
        })
        if (apiKey !== undefined) {
            await prisma.setting.upsert({
                where: { key: 'wa.api_key' },
                create: { key: 'wa.api_key', value: apiKey, type: 'string' },
                update: { value: apiKey }
            })
        }
        revalidatePath('/admin/whatsapp')
        revalidatePath('/admin/notifications')
        return { success: true }
    } catch (e) {
        return { success: false, error: 'Gagal menyimpan pengaturan' }
    }
}

export async function testConnectionGlobal() {
    try {
        await requirePermission(PERMISSIONS.SETTINGS_VIEW)
        const config = await getConfig()
        // Try to fetch version or something simple 
        // usually GET / or /api-docs or /session
        const headers: Record<string, string> = {}
        if (config.apiKey) headers['Key'] = config.apiKey

        const response = await fetch(`${config.url}/session`, { cache: 'no-store', headers })
        if (response.ok) {
            return { success: true, message: `Terhubung ke Gateway (${config.url})` }
        }
        return { success: false, error: 'Respon tidak valid dari gateway' }
    } catch (e) {
        return { success: false, error: 'Gagal menghubungi gateway' }
    }
}

export async function getSessions() {
    try {
        await requirePermission(PERMISSIONS.SETTINGS_VIEW)
        const config = await getConfig()
        const headers: Record<string, string> = {}
        if (config.apiKey) headers['Key'] = config.apiKey

        const response = await fetch(`${config.url}/session`, { cache: 'no-store', headers })
        const data = await response.json()

        if (Array.isArray(data)) {
            return { success: true, data: data }
        }
        if (data.data && Array.isArray(data.data)) {
            return { success: true, data: data.data }
        }
        return { success: true, data: [] }
    } catch (error) {
        console.error('Get sessions error:', error)
        return { success: false, error: 'Gagal mengambil data session' }
    }
}

export async function getSessionStatus(sessionName: string) {
    try {
        await requirePermission(PERMISSIONS.SETTINGS_VIEW)
        const config = await getConfig()
        const headers: Record<string, string> = {}
        if (config.apiKey) headers['Key'] = config.apiKey

        const response = await fetch(`${config.url}/session/status?session=${sessionName}`, { cache: 'no-store', headers })
        const data = await response.json()
        return { success: true, status: data.status || 'UNKNOWN' }
    } catch (error) {
        return { success: false, error: 'Gagal cek status' }
    }
}

export async function startSession(sessionName: string) {
    try {
        await requirePermission(PERMISSIONS.SETTINGS_VIEW)
        const config = await getConfig()
        const headers: Record<string, string> = {}
        if (config.apiKey) headers['Key'] = config.apiKey

        const response = await fetch(`${config.url}/session/start?session=${sessionName}`, { cache: 'no-store', headers })
        const data = await response.json()

        if (data.status === 'success' || data.message === 'Session created' || response.ok) {
            return { success: true, message: 'Session started' }
        }
        return { success: false, error: data.message || 'Gagal start session' }
    } catch (error) {
        return { success: false, error: 'Gagal start session' }
    }
}

export async function stopSession(sessionName: string) {
    try {
        await requirePermission(PERMISSIONS.SETTINGS_VIEW)
        const config = await getConfig()
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (config.apiKey) headers['Key'] = config.apiKey

        const response = await fetch(`${config.url}/session/stop`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ session: sessionName })
        })
        const data = await response.json()
        return { success: true, message: data.message }
    } catch (error) {
        return { success: false, error: 'Gagal stop session' }
    }
}

export async function deleteSession(sessionName: string) {
    try {
        await requirePermission(PERMISSIONS.SETTINGS_VIEW)
        const config = await getConfig()
        const headers: Record<string, string> = {}
        if (config.apiKey) headers['Key'] = config.apiKey

        const response = await fetch(`${config.url}/session/logout?session=${sessionName}`, { cache: 'no-store', headers })
        const data = await response.json()
        return { success: true, message: data.message }
    } catch (error) {
        return { success: false, error: 'Gagal hapus session' }
    }
}

export async function getQRImage(sessionName: string) {
    try {
        await requirePermission(PERMISSIONS.SETTINGS_VIEW)
        const config = await getConfig()
        const headers: Record<string, string> = {}
        if (config.apiKey) headers['Key'] = config.apiKey

        const response = await fetch(`${config.url}/session/qr?session=${sessionName}`, { cache: 'no-store', headers })

        if (!response.ok) return { success: false }

        const blob = await response.blob()
        const buffer = Buffer.from(await blob.arrayBuffer())
        const base64 = buffer.toString('base64')
        const mimeType = response.headers.get('content-type') || 'image/png'

        return { success: true, image: `data:${mimeType};base64,${base64}` }
    } catch (error) {
        return { success: false, error: 'Gagal ambil QR' }
    }
}

export async function sendTargetedTestMessage(sessionName: string, to: string, message: string) {
    try {
        await requirePermission(PERMISSIONS.SETTINGS_VIEW)
        return await sendWhatsAppMessage(to, message, { sessionName })
    } catch (error) {
        return { success: false, error: 'Gagal kirim pesan' }
    }
}
