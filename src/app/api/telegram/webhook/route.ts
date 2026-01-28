import { NextRequest, NextResponse } from 'next/server'
import { handleBotCommand } from '@/lib/telegram'
import prisma from '@/lib/prisma'

interface TelegramUpdate {
    update_id: number
    message?: {
        message_id: number
        from: {
            id: number
            first_name: string
            username?: string
        }
        chat: {
            id: number
            type: string
        }
        text?: string
        date: number
    }
}

export async function POST(request: NextRequest) {
    try {
        const update: TelegramUpdate = await request.json()

        // Only process text messages
        if (!update.message?.text) {
            return NextResponse.json({ ok: true })
        }

        const text = update.message.text
        const chatId = update.message.chat.id

        // Only respond to commands (starting with /)
        if (!text.startsWith('/')) {
            return NextResponse.json({ ok: true })
        }

        // Get bot token from config
        const config = await prisma.telegramConfig.findFirst({
            where: { isEnabled: true }
        })

        if (!config) {
            return NextResponse.json({ ok: true })
        }

        // Handle command
        const response = await handleBotCommand(text)

        // Send response
        await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: response.text,
                parse_mode: response.parse_mode || 'Markdown'
            })
        })

        return NextResponse.json({ ok: true })

    } catch (error) {
        console.error('Telegram webhook error:', error)
        return NextResponse.json({ ok: true }) // Always return ok to Telegram
    }
}

export async function GET() {
    return NextResponse.json({
        status: 'ok',
        endpoint: 'Telegram Bot Webhook',
        timestamp: new Date().toISOString()
    })
}
