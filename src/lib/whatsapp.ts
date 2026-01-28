import prisma from '@/lib/prisma'

// Use dynamic access to avoid TypeScript errors for optional models
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaAny = prisma as any

export interface WhatsAppResponse {
    success: boolean
    data?: any
    error?: string
    sessionUsed?: string
}

interface SessionInfo {
    id: string
    name: string
    status: string
    isPrimary: boolean
    priority: number
    currentDailyCount: number
    dailyLimit: number
}

// ==================== CONFIG ====================

interface WhatsAppConfig {
    url: string
    apiKey: string
}

async function getWhatsAppConfig(): Promise<WhatsAppConfig> {
    const settings = await prisma.setting.findMany({
        where: { key: { in: ['wa.api_url', 'wa.api_key'] } }
    })
    const map = settings.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {} as Record<string, string>)
    return {
        url: map['wa.api_url'] || process.env.WA_API_URL || 'http://localhost:5001',
        apiKey: map['wa.api_key'] || process.env.WA_API_KEY || ''
    }
}

// ==================== SESSION SELECTION ====================

/**
 * Get all available (connected and active) sessions from database
 */
async function getAvailableSessions(): Promise<SessionInfo[]> {
    try {
        const sessions = await prismaAny.whatsAppSession.findMany({
            where: {
                isActive: true,
                status: 'CONNECTED'
            },
            orderBy: [
                { isPrimary: 'desc' },
                { priority: 'asc' }
            ]
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return sessions.map((s: any) => ({
            id: s.id,
            name: s.name,
            status: s.status,
            isPrimary: s.isPrimary,
            priority: s.priority,
            currentDailyCount: s.currentDailyCount,
            dailyLimit: s.dailyLimit
        }))
    } catch (error) {
        // Table might not exist yet, fallback to settings
        console.warn('WhatsAppSession table not available, using legacy config')
        return []
    }
}

/**
 * Get legacy single-session config (fallback)
 */
async function getLegacySession(): Promise<string> {
    const setting = await prisma.setting.findUnique({
        where: { key: 'wa.session' }
    })
    return setting?.value || process.env.WA_SESSION || 'esurat'
}

/**
 * Select best session based on mode
 * @param mode - 'failover' | 'round-robin' | 'hybrid'
 */
async function selectSession(mode: 'failover' | 'round-robin' | 'hybrid' = 'failover'): Promise<string> {
    const sessions = await getAvailableSessions()

    // Fallback to legacy if no sessions in DB
    if (sessions.length === 0) {
        return await getLegacySession()
    }

    // Filter sessions that haven't exceeded daily limit
    const availableSessions = sessions.filter(s => s.currentDailyCount < s.dailyLimit)

    if (availableSessions.length === 0) {
        console.warn('All sessions have reached daily limit, using primary anyway')
        return sessions[0]?.name || await getLegacySession()
    }

    switch (mode) {
        case 'round-robin': {
            // Simple round-robin: select session with lowest message count today
            const sorted = [...availableSessions].sort((a, b) => a.currentDailyCount - b.currentDailyCount)
            return sorted[0].name
        }

        case 'hybrid': {
            // Use primary if under 80% capacity, otherwise round-robin
            const primary = availableSessions.find(s => s.isPrimary)
            if (primary && primary.currentDailyCount < primary.dailyLimit * 0.8) {
                return primary.name
            }
            // Fall through to round-robin
            const sorted = [...availableSessions].sort((a, b) => a.currentDailyCount - b.currentDailyCount)
            return sorted[0].name
        }

        case 'failover':
        default: {
            // Use primary if available, otherwise highest priority backup
            return availableSessions[0].name
        }
    }
}

/**
 * Update session stats after sending a message
 */
async function updateSessionStats(sessionName: string, success: boolean): Promise<void> {
    try {
        await prismaAny.whatsAppSession.updateMany({
            where: { name: sessionName },
            data: {
                currentDailyCount: { increment: 1 },
                totalMessagesSent: { increment: 1 },
                lastMessageAt: new Date()
            }
        })
    } catch (error) {
        // Ignore if table doesn't exist
    }
}

/**
 * Check and reset daily counts at midnight
 */
async function resetDailyCountsIfNeeded(): Promise<void> {
    try {
        const now = new Date()
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

        await prismaAny.whatsAppSession.updateMany({
            where: {
                lastResetAt: { lt: startOfDay }
            },
            data: {
                currentDailyCount: 0,
                lastResetAt: now
            }
        })
    } catch (error) {
        // Ignore if table doesn't exist
    }
}

// ==================== HEALTH CHECK ====================

/**
 * Check health of all sessions from WA Gateway
 */
export async function syncSessionStatuses(): Promise<void> {
    try {
        const config = await getWhatsAppConfig()
        const headers: Record<string, string> = {}
        if (config.apiKey) headers['Key'] = config.apiKey

        const response = await fetch(`${config.url}/health/sessions`, { headers })

        if (!response.ok) return

        const data = await response.json()
        const sessions = data.sessions || []

        for (const session of sessions) {
            await prismaAny.whatsAppSession.updateMany({
                where: { name: session.id },
                data: {
                    status: session.status,
                    phoneNumber: session.phone || undefined,
                    lastHealthCheckAt: new Date(),
                    lastConnectedAt: session.status === 'CONNECTED' ? new Date() : undefined,
                    healthCheckFailed: session.status === 'CONNECTED' ? 0 : { increment: 1 }
                }
            })
        }
    } catch (error) {
        console.error('Failed to sync session statuses:', error)
    }
}

// ==================== MESSAGE SENDING ====================

/**
 * Send WhatsApp message with multi-session support
 */
export async function sendWhatsAppMessage(
    to: string,
    message: string,
    options: {
        sessionName?: string
        mode?: 'failover' | 'round-robin' | 'hybrid'
        logMessage?: boolean
    } = {}
): Promise<WhatsAppResponse> {
    if (!to) return { success: false, error: 'No phone number provided' }

    // Reset daily counts if needed
    await resetDailyCountsIfNeeded()

    // Basic normalization: Replace leading 08 with 628 if needed
    let phone = to.replace(/\D/g, '') // Remove non-digits
    if (phone.startsWith('08')) {
        phone = '62' + phone.substring(1)
    }

    // Select session
    const session = options.sessionName || await selectSession(options.mode || 'failover')
    const config = await getWhatsAppConfig()

    // Build headers with Key authentication
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (config.apiKey) headers['Key'] = config.apiKey

    try {
        const response = await fetch(`${config.url}/message/send-text`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                session,
                to: phone,
                text: message
            })
        })

        const data = await response.json()

        if (!response.ok) {
            console.error('WhatsApp API Error:', data)

            // Log failed message if enabled
            if (options.logMessage !== false) {
                await logMessage(session, phone, message, 'FAILED', data.message)
            }

            return {
                success: false,
                error: data.message || 'Failed to send message',
                sessionUsed: session
            }
        }

        // Update stats
        await updateSessionStats(session, true)

        // Log successful message if enabled
        if (options.logMessage !== false) {
            await logMessage(session, phone, message, 'SENT')
        }

        return { success: true, data, sessionUsed: session }

    } catch (error) {
        console.error('WhatsApp Fetch Error:', error)

        // Log failed message
        if (options.logMessage !== false) {
            await logMessage(session, phone, message, 'FAILED', 'Connection error')
        }

        return {
            success: false,
            error: 'Failed to connect to WhatsApp Gateway',
            sessionUsed: session
        }
    }
}

/**
 * Log message to database
 */
async function logMessage(
    sessionName: string,
    phone: string,
    message: string,
    status: 'PENDING' | 'SENT' | 'FAILED',
    errorReason?: string
): Promise<void> {
    try {
        const session = await prismaAny.whatsAppSession.findUnique({
            where: { name: sessionName }
        })

        if (session) {
            await prismaAny.whatsAppMessageLog.create({
                data: {
                    sessionId: session.id,
                    phoneNumber: phone,
                    message: message.substring(0, 1000), // Limit message length
                    status,
                    errorReason
                }
            })
        }
    } catch (error) {
        // Ignore if table doesn't exist
    }
}

// ==================== ADMIN FUNCTIONS ====================

/**
 * Get all sessions with their status
 */
export async function getAllSessions(): Promise<any[]> {
    try {
        return await prismaAny.whatsAppSession.findMany({
            orderBy: [
                { isPrimary: 'desc' },
                { priority: 'asc' }
            ]
        })
    } catch (error) {
        return []
    }
}

/**
 * Create a new WhatsApp session
 */
export async function createSession(data: {
    name: string
    phoneNumber?: string
    isPrimary?: boolean
    priority?: number
    dailyLimit?: number
}): Promise<any> {
    // If setting as primary, unset other primaries
    if (data.isPrimary) {
        await prismaAny.whatsAppSession.updateMany({
            data: { isPrimary: false }
        })
    }

    return await prismaAny.whatsAppSession.create({
        data: {
            name: data.name,
            phoneNumber: data.phoneNumber,
            isPrimary: data.isPrimary ?? false,
            priority: data.priority ?? 0,
            dailyLimit: data.dailyLimit ?? 1000
        }
    })
}

/**
 * Update session configuration
 */
export async function updateSession(id: string, data: {
    isPrimary?: boolean
    priority?: number
    dailyLimit?: number
    isActive?: boolean
}): Promise<any> {
    // If setting as primary, unset other primaries
    if (data.isPrimary) {
        await prismaAny.whatsAppSession.updateMany({
            where: { id: { not: id } },
            data: { isPrimary: false }
        })
    }

    return await prismaAny.whatsAppSession.update({
        where: { id },
        data
    })
}

/**
 * Delete a session
 */
export async function deleteSession(id: string): Promise<void> {
    await prismaAny.whatsAppSession.delete({
        where: { id }
    })
}
