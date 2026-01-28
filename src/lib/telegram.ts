import prisma from '@/lib/prisma'
import os from 'os'

// ==================== CONFIG ====================

interface TelegramConfigData {
    botToken: string
    chatId: string
    isEnabled: boolean
    notifyOnSessionDisconnect: boolean
    notifyOnSessionReconnect: boolean
    notifyOnHighTraffic: boolean
    notifyOnSystemError: boolean
}

async function getTelegramConfig(): Promise<TelegramConfigData | null> {
    try {
        const config = await prisma.telegramConfig.findFirst({
            where: { isEnabled: true }
        })

        if (!config) return null

        return {
            botToken: config.botToken,
            chatId: config.chatId,
            isEnabled: config.isEnabled,
            notifyOnSessionDisconnect: config.notifyOnSessionDisconnect,
            notifyOnSessionReconnect: config.notifyOnSessionReconnect,
            notifyOnHighTraffic: config.notifyOnHighTraffic,
            notifyOnSystemError: config.notifyOnSystemError
        }
    } catch (error) {
        // Table might not exist yet
        console.warn('TelegramConfig table not available')
        return null
    }
}

// ==================== MESSAGE SENDING ====================

/**
 * Send a message via Telegram Bot API
 */
export async function sendTelegramMessage(message: string): Promise<boolean> {
    const config = await getTelegramConfig()
    if (!config) {
        console.warn('Telegram not configured')
        return false
    }

    try {
        const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: config.chatId,
                text: message,
                parse_mode: 'Markdown'
            })
        })

        if (!response.ok) {
            const error = await response.json()
            console.error('Telegram API Error:', error)
            return false
        }

        return true
    } catch (error) {
        console.error('Telegram send error:', error)
        return false
    }
}

/**
 * Send an alert notification with emoji based on type
 */
export async function sendTelegramAlert(
    type: 'warning' | 'error' | 'info' | 'success',
    title: string,
    details?: string
): Promise<boolean> {
    const config = await getTelegramConfig()
    if (!config) return false

    // Check notification preferences
    if (type === 'warning' && !config.notifyOnSessionDisconnect) return false
    if (type === 'error' && !config.notifyOnSystemError) return false

    const emoji = {
        warning: '⚠️',
        error: '🚨',
        info: 'ℹ️',
        success: '✅'
    }

    const message = `${emoji[type]} *E-SURAT ALERT*\n\n*${title}*${details ? `\n\n${details}` : ''}\n\n_${new Date().toLocaleString('id-ID')}_`

    return await sendTelegramMessage(message)
}

// ==================== HEALTH MONITORING ====================

interface HealthStatus {
    cpu: number
    memory: {
        total: number
        used: number
        free: number
        percentage: number
    }
    uptime: number
    database: boolean
    whatsappSessions: {
        total: number
        connected: number
        disconnected: number
    }
}

/**
 * Get current system health status
 */
export async function getSystemHealth(): Promise<HealthStatus> {
    // CPU usage (simplified - average load)
    const cpus = os.cpus()
    const cpuUsage = cpus.reduce((acc, cpu) => {
        const total = Object.values(cpu.times).reduce((a, b) => a + b, 0)
        const idle = cpu.times.idle
        return acc + ((total - idle) / total) * 100
    }, 0) / cpus.length

    // Memory usage
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const usedMem = totalMem - freeMem

    // Database check
    let dbOk = false
    try {
        await prisma.$queryRaw`SELECT 1`
        dbOk = true
    } catch {
        dbOk = false
    }

    // WhatsApp sessions
    let waSessions = { total: 0, connected: 0, disconnected: 0 }
    try {
        const sessions = await prisma.whatsAppSession.findMany({
            where: { isActive: true }
        })
        waSessions.total = sessions.length
        waSessions.connected = sessions.filter(s => s.status === 'CONNECTED').length
        waSessions.disconnected = sessions.filter(s => s.status !== 'CONNECTED').length
    } catch { }

    return {
        cpu: Math.round(cpuUsage * 100) / 100,
        memory: {
            total: totalMem,
            used: usedMem,
            free: freeMem,
            percentage: Math.round((usedMem / totalMem) * 100 * 100) / 100
        },
        uptime: os.uptime(),
        database: dbOk,
        whatsappSessions: waSessions
    }
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let i = 0
    while (bytes >= 1024 && i < units.length - 1) {
        bytes /= 1024
        i++
    }
    return `${bytes.toFixed(2)} ${units[i]}`
}

/**
 * Format uptime to human readable
 */
function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const mins = Math.floor((seconds % 3600) / 60)

    const parts = []
    if (days > 0) parts.push(`${days}d`)
    if (hours > 0) parts.push(`${hours}h`)
    parts.push(`${mins}m`)

    return parts.join(' ')
}

/**
 * Send health report to Telegram
 */
export async function sendHealthReport(): Promise<boolean> {
    const health = await getSystemHealth()

    const statusEmoji = (ok: boolean) => ok ? '🟢' : '🔴'
    const cpuStatus = health.cpu < 80
    const memStatus = health.memory.percentage < 85

    const message = `📊 *E-SURAT HEALTH REPORT*

*System Status*
${statusEmoji(cpuStatus)} CPU: ${health.cpu.toFixed(1)}%
${statusEmoji(memStatus)} Memory: ${health.memory.percentage.toFixed(1)}% (${formatBytes(health.memory.used)}/${formatBytes(health.memory.total)})
⏱ Uptime: ${formatUptime(health.uptime)}

*Services*
${statusEmoji(health.database)} Database: ${health.database ? 'Connected' : 'Disconnected'}

*WhatsApp Sessions*
📱 Total: ${health.whatsappSessions.total}
🟢 Connected: ${health.whatsappSessions.connected}
🔴 Disconnected: ${health.whatsappSessions.disconnected}

_${new Date().toLocaleString('id-ID')}_`

    return await sendTelegramMessage(message)
}

// ==================== BOT COMMANDS ====================

interface CommandResponse {
    text: string
    parse_mode?: string
}

/**
 * Handle Telegram bot commands
 */
export async function handleBotCommand(command: string): Promise<CommandResponse> {
    const cmd = command.toLowerCase().trim()

    switch (cmd) {
        case '/status':
        case '/health': {
            const health = await getSystemHealth()
            const cpuStatus = health.cpu < 80 ? '🟢' : '🔴'
            const memStatus = health.memory.percentage < 85 ? '🟢' : '🔴'

            return {
                text: `📊 *System Status*

${cpuStatus} CPU: ${health.cpu.toFixed(1)}%
${memStatus} Memory: ${health.memory.percentage.toFixed(1)}%
${health.database ? '🟢' : '🔴'} Database: ${health.database ? 'OK' : 'Error'}

*WhatsApp*: ${health.whatsappSessions.connected}/${health.whatsappSessions.total} connected`,
                parse_mode: 'Markdown'
            }
        }

        case '/sessions': {
            try {
                const sessions = await prisma.whatsAppSession.findMany({
                    where: { isActive: true },
                    orderBy: { isPrimary: 'desc' }
                })

                if (sessions.length === 0) {
                    return { text: 'No WhatsApp sessions configured.' }
                }

                const list = sessions.map(s => {
                    const status = s.status === 'CONNECTED' ? '🟢' : '🔴'
                    const primary = s.isPrimary ? '⭐' : ''
                    return `${status}${primary} ${s.name} (${s.phoneNumber || 'N/A'})`
                }).join('\n')

                return {
                    text: `📱 *WhatsApp Sessions*\n\n${list}`,
                    parse_mode: 'Markdown'
                }
            } catch {
                return { text: 'Failed to get sessions.' }
            }
        }

        case '/letters': {
            try {
                const today = new Date()
                today.setHours(0, 0, 0, 0)

                const stats = await prisma.letter.groupBy({
                    by: ['status'],
                    _count: true,
                    where: {
                        createdAt: { gte: today }
                    }
                })

                const total = stats.reduce((acc, s) => acc + s._count, 0)
                const breakdown = stats.map(s => `  ${s.status}: ${s._count}`).join('\n')

                return {
                    text: `📄 *Today's Letters*\n\nTotal: ${total}\n${breakdown || 'No letters today'}`,
                    parse_mode: 'Markdown'
                }
            } catch {
                return { text: 'Failed to get letter stats.' }
            }
        }

        case '/pending': {
            try {
                const pending = await prisma.letter.count({
                    where: {
                        status: { in: ['PENDING_APPROVAL', 'PENDING_SIGN'] }
                    }
                })

                return {
                    text: `⏳ *Pending Items*\n\nLetters awaiting action: ${pending}`,
                    parse_mode: 'Markdown'
                }
            } catch {
                return { text: 'Failed to get pending count.' }
            }
        }

        case '/help':
        default:
            return {
                text: `🤖 *E-Surat Bot Commands*

/status - System health overview
/sessions - WhatsApp session status
/letters - Today's letter statistics
/pending - Pending approvals count
/help - Show this help`,
                parse_mode: 'Markdown'
            }
    }
}

// ==================== ADMIN FUNCTIONS ====================

/**
 * Save Telegram configuration
 */
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
}): Promise<any> {
    // Upsert - update if exists, create if not
    const existing = await prisma.telegramConfig.findFirst()

    if (existing) {
        return await prisma.telegramConfig.update({
            where: { id: existing.id },
            data: {
                botToken: data.botToken,
                chatId: data.chatId,
                botUsername: data.botUsername,
                notifyOnSessionDisconnect: data.notifyOnSessionDisconnect ?? true,
                notifyOnSessionReconnect: data.notifyOnSessionReconnect ?? true,
                notifyOnHighTraffic: data.notifyOnHighTraffic ?? true,
                notifyOnSystemError: data.notifyOnSystemError ?? true,
                notifyDailyReport: data.notifyDailyReport ?? true,
                dailyReportTime: data.dailyReportTime ?? '08:00',
                isEnabled: true
            }
        })
    }

    return await prisma.telegramConfig.create({
        data: {
            botToken: data.botToken,
            chatId: data.chatId,
            botUsername: data.botUsername,
            isEnabled: true
        }
    })
}

/**
 * Get current Telegram configuration
 */
export async function getTelegramConfigAdmin(): Promise<any> {
    try {
        return await prisma.telegramConfig.findFirst()
    } catch {
        return null
    }
}

/**
 * Test Telegram connection by sending a test message
 */
export async function testTelegramConnection(botToken: string, chatId: string): Promise<boolean> {
    try {
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: '✅ *E-Surat Bot Connected!*\n\nTelegram integration is working correctly.',
                parse_mode: 'Markdown'
            })
        })

        return response.ok
    } catch {
        return false
    }
}
