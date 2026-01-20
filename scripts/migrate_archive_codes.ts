import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

async function main() {
    console.log('Migrating archive codes...')

    const jsonPath = path.join(process.cwd(), 'src/lib/archive-codes.json')
    const rawData = fs.readFileSync(jsonPath, 'utf-8')
    const codes = JSON.parse(rawData)

    console.log(`Found ${codes.length} codes to migrate.`)

    let successful = 0
    let failed = 0

    for (const item of codes) {
        try {
            // Map JSON fields to DB
            // json.description is typically the Title/Name of the classification
            const retentionInfo = item.retention ? `Retensi: ${item.retention}` : ''
            const securityInfo = item.security ? `Keamanan: ${item.security}` : ''

            let description = ''
            if (retentionInfo && securityInfo) description = `${retentionInfo}\n${securityInfo}`
            else if (retentionInfo) description = retentionInfo
            else if (securityInfo) description = securityInfo

            await prisma.archiveCode.upsert({
                where: { code: item.code },
                update: {
                    name: item.description,
                    description: description || null
                },
                create: {
                    code: item.code,
                    name: item.description,
                    description: description || null
                }
            })
            successful++
            if (successful % 50 === 0) process.stdout.write('.')
        } catch (error) {
            console.error(`Failed to migrate code ${item.code}:`, error)
            failed++
        }
    }

    console.log('\nMigration completed.')
    console.log(`Successful: ${successful}`)
    console.log(`Failed: ${failed}`)
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
