import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendTelegramAlert } from '@/lib/telegram'

interface WebhookPayload {
    event: 'SESSION_CONNECTED' | 'SESSION_DISCONNECTED' | 'SESSION_BANNED'
    sessionId: string
    timestamp: string
    data: {
        phone?: string
        name?: string
        reason?: string
    }
}

export async function POST(request: NextRequest) {
    try {
        const payload: WebhookPayload = await request.json()

        console.log(`📥 WA Webhook received: ${payload.event} for session '${payload.sessionId}'`)

        // Update session status in database
        const updateData: any = {
            lastHealthCheckAt: new Date(),
            healthCheckFailed: 0
        }

        switch (payload.event) {
            case 'SESSION_CONNECTED':
                updateData.status = 'CONNECTED'
                updateData.lastConnectedAt = new Date()
                if (payload.data.phone) {
                    updateData.phoneNumber = payload.data.phone
                }
                break

            case 'SESSION_DISCONNECTED':
                updateData.status = 'DISCONNECTED'
                updateData.lastDisconnectedAt = new Date()
                break

            case 'SESSION_BANNED':
                updateData.status = 'BANNED'
                updateData.lastDisconnectedAt = new Date()
                updateData.isActive = false
                break
        }

        // Update database
        await prisma.whatsAppSession.updateMany({
            where: { name: payload.sessionId },
            data: updateData
        })

        // Send Telegram notification for disconnect/ban events
        if (payload.event === 'SESSION_DISCONNECTED' || payload.event === 'SESSION_BANNED') {
            await sendTelegramAlert(
                payload.event === 'SESSION_BANNED' ? 'error' : 'warning',
                `WhatsApp Session **${payload.sessionId}** ${payload.event === 'SESSION_BANNED' ? 'BANNED' : 'disconnected'}!`,
                `Timestamp: ${payload.timestamp}\n${payload.data.reason ? `Reason: ${payload.data.reason}` : ''}`
            )
        }

        // Send Telegram notification for reconnect
        if (payload.event === 'SESSION_CONNECTED') {
            await sendTelegramAlert(
                'info',
                `WhatsApp Session **${payload.sessionId}** connected`,
                `Phone: ${payload.data.phone || 'N/A'}\nName: ${payload.data.name || 'N/A'}`
            )
        }

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('Webhook processing error:', error)
        return NextResponse.json({ success: false, error: 'Processing failed' }, { status: 500 })
    }
}

// Allow GET for health check
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        endpoint: 'WhatsApp Webhook',
        timestamp: new Date().toISOString()
    })
}
