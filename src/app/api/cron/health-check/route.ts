import { NextRequest, NextResponse } from 'next/server'
import { sendHealthReport, getSystemHealth, sendTelegramAlert } from '@/lib/telegram'
import { syncSessionStatuses } from '@/lib/whatsapp'
import prisma from '@/lib/prisma'

/**
 * Health check endpoint - can be called by cron job
 * 
 * Performs:
 * 1. Sync WhatsApp session statuses from gateway
 * 2. Check system health
 * 3. Send alerts if thresholds exceeded
 * 4. Log health status
 */
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // Simple auth check for cron jobs
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // 1. Sync WhatsApp session statuses
        await syncSessionStatuses()

        // 2. Get system health
        const health = await getSystemHealth()

        // 3. Check thresholds and send alerts
        if (health.cpu > 90) {
            await sendTelegramAlert('warning', 'High CPU Usage', `CPU usage is at ${health.cpu.toFixed(1)}%`)
        }

        if (health.memory.percentage > 90) {
            await sendTelegramAlert('warning', 'High Memory Usage', `Memory usage is at ${health.memory.percentage.toFixed(1)}%`)
        }

        if (!health.database) {
            await sendTelegramAlert('error', 'Database Connection Lost', 'Unable to connect to database!')
        }

        if (health.whatsappSessions.total > 0 && health.whatsappSessions.connected === 0) {
            await sendTelegramAlert('error', 'All WhatsApp Sessions Disconnected', 'No WhatsApp sessions are currently connected!')
        }

        // 4. Log health status
        try {
            await prisma.systemHealthLog.create({
                data: {
                    type: 'SYSTEM',
                    value: JSON.stringify(health),
                    status: health.database && health.cpu < 90 && health.memory.percentage < 90 ? 'OK' : 'WARNING',
                    message: `CPU: ${health.cpu.toFixed(1)}%, MEM: ${health.memory.percentage.toFixed(1)}%, DB: ${health.database ? 'OK' : 'ERR'}`
                }
            })
        } catch {
            // Ignore if table doesn't exist
        }

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            health
        })

    } catch (error) {
        console.error('Health check error:', error)
        return NextResponse.json({
            success: false,
            error: 'Health check failed'
        }, { status: 500 })
    }
}

/**
 * POST - Trigger health report to Telegram
 */
export async function POST(request: NextRequest) {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        await sendHealthReport()

        return NextResponse.json({
            success: true,
            message: 'Health report sent to Telegram'
        })
    } catch (error) {
        console.error('Health report error:', error)
        return NextResponse.json({
            success: false,
            error: 'Failed to send health report'
        }, { status: 500 })
    }
}
