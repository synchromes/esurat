import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DEFAULT_SETTINGS = [
    { key: 'app.name', value: 'E-Surat Digital TVRI', type: 'string' },
    { key: 'app.logo', value: '/logo.png', type: 'string' },
    { key: 'letter.auto_number_prefix', value: 'TVRI/SK', type: 'string' },
    { key: 'qr.default_size', value: '100', type: 'number' },
    { key: 'upload.max_size', value: '10485760', type: 'number' },
]

async function main() {
    console.log('Seeding Default Settings...')

    for (const s of DEFAULT_SETTINGS) {
        await prisma.setting.upsert({
            where: { key: s.key },
            update: {
                // Don't update value if exists to preserve user changes? 
                // Or maybe just ensure structure? Let's keep value if exists, or update if we want to reset?
                // For seeding, usually we want to ensure keys exist.
            },
            create: {
                key: s.key,
                value: s.value,
                type: s.type
            }
        })
        console.log(`- Ensured setting: ${s.key}`)
    }

    console.log('Settings seeded.')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
