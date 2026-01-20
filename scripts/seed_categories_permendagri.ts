
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CATEGORIES = [
    { name: 'Peraturan Daerah', code: 'PERDA', description: 'Naskah Dinas Pengaturan' },
    { name: 'Peraturan Kepala Daerah', code: 'PERKADA', description: 'Naskah Dinas Pengaturan' },
    { name: 'Peraturan DPRD', code: 'PERDPRD', description: 'Naskah Dinas Pengaturan' },
    { name: 'Keputusan Kepala Daerah', code: 'KEP_KDH', description: 'Naskah Dinas Penetapan' },
    { name: 'Surat Perintah', code: 'SPT', description: 'Naskah Dinas Penugasan' },
    { name: 'Surat Tugas', code: 'ST', description: 'Naskah Dinas Penugasan' },
    { name: 'Surat Perjalanan Dinas', code: 'SPPD', description: 'Naskah Dinas Penugasan' },
    { name: 'Nota Dinas', code: 'ND', description: 'Naskah Dinas Korespondensi Internal' },
    { name: 'Memo', code: 'MEMO', description: 'Naskah Dinas Korespondensi Internal' },
    { name: 'Surat Dinas', code: 'SD', description: 'Naskah Dinas Korespondensi Eksternal' },
    { name: 'Instruksi', code: 'INS', description: 'Naskah Dinas Khusus' },
    { name: 'Surat Edaran', code: 'SE', description: 'Naskah Dinas Khusus' },
    { name: 'Surat Kuasa', code: 'SK', description: 'Naskah Dinas Khusus' },
    { name: 'Berita Acara', code: 'BA', description: 'Naskah Dinas Khusus' },
    { name: 'Surat Keterangan', code: 'SKET', description: 'Naskah Dinas Khusus' },
    { name: 'Surat Pengantar', code: 'SP', description: 'Naskah Dinas Khusus' },
    { name: 'Pengumuman', code: 'PENG', description: 'Naskah Dinas Khusus' },
    { name: 'Laporan', code: 'LAP', description: 'Naskah Dinas Khusus' },
    { name: 'Telaahan Staf', code: 'TS', description: 'Naskah Dinas Khusus' },
    { name: 'Notula', code: 'NOT', description: 'Naskah Dinas Khusus' },
    { name: 'Surat Undangan', code: 'UND', description: 'Naskah Dinas Khusus' },
    { name: 'Surat Pernyataan Melaksanakan Tugas', code: 'SPMT', description: 'Naskah Dinas Khusus' },
    { name: 'Surat Panggilan', code: 'SPG', description: 'Naskah Dinas Khusus' },
    { name: 'Surat Izin', code: 'SIZ', description: 'Naskah Dinas Khusus' },
    { name: 'Rekomendasi', code: 'REK', description: 'Naskah Dinas Khusus' },
    { name: 'Radiogram', code: 'RADIO', description: 'Naskah Dinas Khusus' },
    { name: 'Sertifikat', code: 'SERT', description: 'Naskah Dinas Khusus' },
    { name: 'Piagam', code: 'PIAGAM', description: 'Naskah Dinas Khusus' },
    { name: 'Surat Perjanjian', code: 'SPJ', description: 'Naskah Dinas Khusus' }
]

async function main() {
    console.log('Seeding Permendagri 1/2023 Categories...')

    for (const cat of CATEGORIES) {
        // 1. Try to find by CODE first
        const existingByCode = await prisma.letterCategory.findUnique({
            where: { code: cat.code }
        })

        if (existingByCode) {
            // Update existing by code
            console.log(`Updating existing category by code: ${cat.code}`)
            await prisma.letterCategory.update({
                where: { id: existingByCode.id },
                data: {
                    name: cat.name,
                    description: cat.description
                }
            })
        } else {
            // 2. Try to find by NAME to avoid unique constraint error
            const existingByName = await prisma.letterCategory.findUnique({
                where: { name: cat.name }
            })

            if (existingByName) {
                // Update existing by name (set the new code)
                console.log(`Updating existing category by name: ${cat.name} -> setting code to ${cat.code}`)
                await prisma.letterCategory.update({
                    where: { id: existingByName.id },
                    data: {
                        code: cat.code, // Enforce the Permendagri code
                        description: cat.description
                    }
                })
            } else {
                // 3. Create new
                console.log(`Creating new category: ${cat.name} (${cat.code})`)
                await prisma.letterCategory.create({
                    data: {
                        name: cat.name,
                        code: cat.code,
                        description: cat.description,
                        color: '#64748b'
                    }
                })
            }
        }
    }

    console.log(`Seeded ${CATEGORIES.length} categories.`)
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
