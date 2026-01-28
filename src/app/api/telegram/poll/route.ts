import { NextRequest, NextResponse } from 'next/server'
import { handleBotCommand } from '@/lib/telegram'
import prisma from '@/lib/prisma'

let lastUpdateId = 0

/**
 * GET - Poll for new Telegram updates and respond to commands
 * Call this endpoint periodically (e.g., every 2 seconds) to receive and respond to commands
 */
export async function GET(request: NextRequest) {
    try {
        // Get bot token from config
        const config = await prisma.telegramConfig.findFirst({
            where: { isEnabled: true }
        })

        if (!config) {
            // Return success but indicate no config - this is not an error during polling
            return NextResponse.json({
                success: true,
                processed: 0,
                message: 'Telegram not configured'
            })
        }

        // Get updates from Telegram with shorter timeout to avoid long hangs
        const updatesUrl = `https://api.telegram.org/bot${config.botToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=2&limit=10`

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

        let response
        try {
            response = await fetch(updatesUrl, { signal: controller.signal })
        } catch (fetchError: any) {
            clearTimeout(timeoutId)
            // Network error - return success with no updates
            return NextResponse.json({
                success: true,
                processed: 0,
                error: 'Network error'
            })
        }
        clearTimeout(timeoutId)

        const data = await response.json()

        if (!data.ok) {
            // Telegram API error - log but don't fail the polling
            console.warn('Telegram API error:', data.description)
            return NextResponse.json({
                success: true,
                processed: 0,
                warning: data.description
            })
        }

        const updates = data.result || []
        let processedCount = 0

        for (const update of updates) {
            // Update last processed ID
            if (update.update_id > lastUpdateId) {
                lastUpdateId = update.update_id
            }

            // Only process text messages that are commands
            if (!update.message?.text?.startsWith('/')) continue

            const text = update.message.text
            const chatId = update.message.chat.id

            try {
                // Handle command
                const commandResponse = await handleBotCommand(text)

                // Send response
                await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: chatId,
                        text: commandResponse.text,
                        parse_mode: commandResponse.parse_mode || 'Markdown'
                    })
                })

                processedCount++
            } catch (cmdError) {
                console.error('Error processing command:', cmdError)
            }
        }

        return NextResponse.json({
            success: true,
            processed: processedCount,
            lastUpdateId
        })

    } catch (error: any) {
        console.error('Telegram poll error:', error)
        // Still return 200 to avoid console errors
        return NextResponse.json({
            success: true,
            processed: 0,
            error: error.message
        })
    }
}

/**
 * POST - Set or delete webhook
 * Body: { action: 'set' | 'delete', url?: string }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { action, url } = body

        const config = await prisma.telegramConfig.findFirst({
            where: { isEnabled: true }
        })

        if (!config) {
            return NextResponse.json({
                success: false,
                error: 'Telegram not configured'
            }, { status: 400 })
        }

        if (action === 'set' && url) {
            // Set webhook
            const response = await fetch(
                `https://api.telegram.org/bot${config.botToken}/setWebhook?url=${encodeURIComponent(url)}`
            )
            const data = await response.json()
            return NextResponse.json(data)
        }

        if (action === 'delete') {
            // Delete webhook (for polling mode)
            const response = await fetch(
                `https://api.telegram.org/bot${config.botToken}/deleteWebhook`
            )
            const data = await response.json()
            return NextResponse.json(data)
        }

        return NextResponse.json({
            success: false,
            error: 'Invalid action'
        }, { status: 400 })

    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}
