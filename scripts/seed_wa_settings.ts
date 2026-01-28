import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    // Seed WhatsApp Gateway Settings
    const settings = [
        { key: 'wa.api_url', value: 'https://wa.tvrikalbar.id', type: 'string' },
        { key: 'wa.api_key', value: 'wa-tvri-kalbar', type: 'string' },
        { key: 'wa.session', value: '664c55d8-2426-49d5-8e87-f7b1fc3d91f6', type: 'string' }
    ]

    for (const setting of settings) {
        await prisma.setting.upsert({
            where: { key: setting.key },
            update: { value: setting.value },
            create: setting
        })
        console.log(`✅ ${setting.key}: ${setting.value}`)
    }

    console.log('\n🎉 WhatsApp Gateway configured!')
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
