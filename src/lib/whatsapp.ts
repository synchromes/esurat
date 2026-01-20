import prisma from '@/lib/prisma'

export interface WhatsAppResponse {
    success: boolean
    data?: any
    error?: string
}

async function getWhatsAppConfig() {
    // Try to get from DB first
    const settings = await prisma.setting.findMany({
        where: {
            key: { in: ['wa.api_url', 'wa.session'] }
        }
    })

    const dbConfig = settings.reduce((acc, curr) => {
        acc[curr.key] = curr.value
        return acc
    }, {} as Record<string, string>)

    return {
        baseUrl: dbConfig['wa.api_url'] || process.env.WA_API_URL || 'http://localhost:5001',
        session: dbConfig['wa.session'] || process.env.WA_SESSION || 'esurat'
    }
}

export async function sendWhatsAppMessage(to: string, message: string, sessionName?: string): Promise<WhatsAppResponse> {
    if (!to) return { success: false, error: 'No phone number provided' }

    // Basic normalization: Replace leading 08 with 628 if needed
    let phone = to.replace(/\D/g, '') // Remove non-digits
    if (phone.startsWith('08')) {
        phone = '62' + phone.substring(1)
    }

    try {
        const config = await getWhatsAppConfig()
        const session = sessionName || config.session

        const response = await fetch(`${config.baseUrl}/message/send-text`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                session,
                to: phone,
                text: message
            })
        })

        const data = await response.json()

        if (!response.ok) {
            console.error('WhatsApp API Error:', data)
            return { success: false, error: data.message || 'Failed to send message' }
        }

        return { success: true, data }

    } catch (error) {
        console.error('WhatsApp Fetch Error:', error)
        return { success: false, error: 'Failed to connect to WhatsApp Gateway' }
    }
}
