import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    console.log('🌱 Starting database seed...')

    // ==================== PERMISSIONS ====================
    console.log('Creating permissions...')

    const permissionData = [
        // Letter permissions
        { name: 'letter.create', description: 'Membuat surat baru', module: 'letter' },
        { name: 'letter.view', description: 'Melihat surat sendiri', module: 'letter' },
        { name: 'letter.view_all', description: 'Melihat semua surat', module: 'letter' },
        { name: 'letter.edit', description: 'Mengedit surat', module: 'letter' },
        { name: 'letter.delete', description: 'Menghapus surat', module: 'letter' },
        { name: 'letter.approve', description: 'Menyetujui surat', module: 'letter' },
        { name: 'letter.reject', description: 'Menolak surat', module: 'letter' },
        { name: 'letter.sign', description: 'Menandatangani surat', module: 'letter' },
        { name: 'letter.download', description: 'Mengunduh surat', module: 'letter' },

        // User permissions
        { name: 'user.create', description: 'Membuat pengguna baru', module: 'user' },
        { name: 'user.view', description: 'Melihat daftar pengguna', module: 'user' },
        { name: 'user.edit', description: 'Mengedit pengguna', module: 'user' },
        { name: 'user.delete', description: 'Menghapus pengguna', module: 'user' },

        // Role permissions
        { name: 'role.create', description: 'Membuat role baru', module: 'role' },
        { name: 'role.view', description: 'Melihat daftar role', module: 'role' },
        { name: 'role.edit', description: 'Mengedit role', module: 'role' },
        { name: 'role.delete', description: 'Menghapus role', module: 'role' },
        { name: 'role.assign', description: 'Menetapkan role ke pengguna', module: 'role' },

        // Settings permissions
        { name: 'settings.view', description: 'Melihat pengaturan', module: 'settings' },
        { name: 'settings.edit', description: 'Mengubah pengaturan', module: 'settings' },

        // Category permissions
        { name: 'category.create', description: 'Membuat kategori', module: 'category' },
        { name: 'category.edit', description: 'Mengedit kategori', module: 'category' },
        { name: 'category.delete', description: 'Menghapus kategori', module: 'category' },

        // Log permissions
        { name: 'log.view', description: 'Melihat log aktivitas', module: 'log' },

        // Disposition permissions
        { name: 'disposition.create', description: 'Membuat disposisi', module: 'disposition' },
        { name: 'disposition.view', description: 'Melihat disposisi sendiri', module: 'disposition' },
        { name: 'disposition.view_all', description: 'Melihat semua disposisi', module: 'disposition' },
        { name: 'disposition.update', description: 'Mengupdate status disposisi', module: 'disposition' },
    ]

    const permissions: { [key: string]: { id: string } } = {}
    for (const p of permissionData) {
        const permission = await prisma.permission.upsert({
            where: { name: p.name },
            update: {},
            create: p
        })
        permissions[p.name] = permission
    }
    console.log(`✅ Created ${permissionData.length} permissions`)

    // ==================== ROLES ====================
    console.log('Creating roles...')

    // Admin role - full access
    const adminRole = await prisma.role.upsert({
        where: { name: 'Admin' },
        update: {},
        create: {
            name: 'Admin',
            description: 'Administrator dengan akses penuh ke seluruh sistem',
            isSystem: true
        }
    })

    // Assign all permissions to Admin
    for (const p of Object.values(permissions)) {
        await prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: adminRole.id, permissionId: p.id } },
            update: {},
            create: { roleId: adminRole.id, permissionId: p.id }
        })
    }

    // Ketua Tim role
    const ketuaTimRole = await prisma.role.upsert({
        where: { name: 'Ketua Tim' },
        update: {},
        create: {
            name: 'Ketua Tim',
            description: 'Menyetujui atau menolak surat dari anggota tim',
            isSystem: true
        }
    })

    const ketuaTimPermissions = [
        'letter.view', 'letter.view_all', 'letter.approve', 'letter.reject', 'letter.download',
        'disposition.create', 'disposition.view', 'disposition.update'
    ]
    for (const pName of ketuaTimPermissions) {
        await prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: ketuaTimRole.id, permissionId: permissions[pName].id } },
            update: {},
            create: { roleId: ketuaTimRole.id, permissionId: permissions[pName].id }
        })
    }

    // Kepsta (Kepala Stasiun) role
    const kepstaRole = await prisma.role.upsert({
        where: { name: 'Kepsta' },
        update: {},
        create: {
            name: 'Kepsta',
            description: 'Menandatangani surat yang telah disetujui',
            isSystem: true
        }
    })

    const kepstaPermissions = [
        'letter.view', 'letter.view_all', 'letter.sign', 'letter.download',
        'disposition.create', 'disposition.view', 'disposition.view_all', 'disposition.update'
    ]
    for (const pName of kepstaPermissions) {
        await prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: kepstaRole.id, permissionId: permissions[pName].id } },
            update: {},
            create: { roleId: kepstaRole.id, permissionId: permissions[pName].id }
        })
    }

    // Staff role
    const staffRole = await prisma.role.upsert({
        where: { name: 'Staff' },
        update: {},
        create: {
            name: 'Staff',
            description: 'Membuat dan mengelola surat sendiri',
            isSystem: true
        }
    })

    const staffPermissions = [
        'letter.create', 'letter.view', 'letter.edit', 'letter.download',
        'disposition.view', 'disposition.update'
    ]
    for (const pName of staffPermissions) {
        await prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: staffRole.id, permissionId: permissions[pName].id } },
            update: {},
            create: { roleId: staffRole.id, permissionId: permissions[pName].id }
        })
    }

    console.log('✅ Created 4 roles: Admin, Ketua Tim, Kepsta, Staff')

    // ==================== USERS ====================
    console.log('Creating users...')

    const hashedPassword = await bcrypt.hash('password123', 12)

    // Admin user
    const adminUser = await prisma.user.upsert({
        where: { email: 'admin@tvri.go.id' },
        update: {},
        create: {
            name: 'Administrator',
            email: 'admin@tvri.go.id',
            password: hashedPassword,
            isActive: true
        }
    })

    await prisma.userRole.upsert({
        where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
        update: {},
        create: { userId: adminUser.id, roleId: adminRole.id }
    })

    // Ketua Tim user
    const ketuaTimUser = await prisma.user.upsert({
        where: { email: 'ketuatim@tvri.go.id' },
        update: {},
        create: {
            name: 'Budi Santoso',
            email: 'ketuatim@tvri.go.id',
            password: hashedPassword,
            isActive: true
        }
    })

    await prisma.userRole.upsert({
        where: { userId_roleId: { userId: ketuaTimUser.id, roleId: ketuaTimRole.id } },
        update: {},
        create: { userId: ketuaTimUser.id, roleId: ketuaTimRole.id }
    })

    // Kepsta user
    const kepstaUser = await prisma.user.upsert({
        where: { email: 'kepsta@tvri.go.id' },
        update: {},
        create: {
            name: 'Dr. Andi Wijaya',
            email: 'kepsta@tvri.go.id',
            password: hashedPassword,
            isActive: true
        }
    })

    await prisma.userRole.upsert({
        where: { userId_roleId: { userId: kepstaUser.id, roleId: kepstaRole.id } },
        update: {},
        create: { userId: kepstaUser.id, roleId: kepstaRole.id }
    })

    // Staff user
    const staffUser = await prisma.user.upsert({
        where: { email: 'staff@tvri.go.id' },
        update: {},
        create: {
            name: 'Dewi Lestari',
            email: 'staff@tvri.go.id',
            password: hashedPassword,
            isActive: true
        }
    })

    await prisma.userRole.upsert({
        where: { userId_roleId: { userId: staffUser.id, roleId: staffRole.id } },
        update: {},
        create: { userId: staffUser.id, roleId: staffRole.id }
    })

    console.log('✅ Created 4 users: admin, ketuatim, kepsta, staff')

    // ==================== CATEGORIES ====================
    console.log('Creating letter categories...')

    const categories = [
        { name: 'Surat Keputusan', code: 'SK', description: 'Surat keputusan resmi', color: '#3B82F6' },
        { name: 'Surat Perintah', code: 'SP', description: 'Surat perintah kerja', color: '#EF4444' },
        { name: 'Memo Internal', code: 'MEMO', description: 'Memo internal antar unit', color: '#10B981' },
        { name: 'Surat Keterangan', code: 'SKET', description: 'Surat keterangan', color: '#F59E0B' },
        { name: 'Surat Tugas', code: 'ST', description: 'Surat penugasan', color: '#8B5CF6' },
        { name: 'Surat Undangan', code: 'UND', description: 'Surat undangan', color: '#EC4899' },
    ]

    for (const cat of categories) {
        await prisma.letterCategory.upsert({
            where: { code: cat.code },
            update: {},
            create: cat
        })
    }

    console.log(`✅ Created ${categories.length} letter categories`)

    // ==================== SETTINGS ====================
    console.log('Creating default settings...')

    const settings = [
        { key: 'app.name', value: 'E-Surat Digital TVRI', type: 'string' },
        { key: 'app.logo', value: '/logo.png', type: 'string' },
        { key: 'letter.auto_number_prefix', value: 'TVRI/SK', type: 'string' },
        { key: 'qr.default_size', value: '100', type: 'number' },
        { key: 'upload.max_size', value: '10485760', type: 'number' },
    ]

    for (const setting of settings) {
        await prisma.setting.upsert({
            where: { key: setting.key },
            update: {},
            create: setting
        })
    }

    console.log(`✅ Created ${settings.length} settings`)

    // ==================== DISPOSITION INSTRUCTIONS ====================
    console.log('Creating disposition instructions...')

    const instructionsData = [
        { name: 'Diteliti / diselesaikan', sortOrder: 1 },
        { name: 'Dipertimbangkan', sortOrder: 2 },
        { name: 'Untuk diketahui / diperhatikan', sortOrder: 3 },
        { name: 'Mewakili / menghadiri / mengikuti', sortOrder: 4 },
        { name: 'Dikoordinasikan', sortOrder: 5 },
        { name: 'Ditampung permasalahannya', sortOrder: 6 },
        { name: 'Peringatkan / pendekatan', sortOrder: 7 },
        { name: 'Pendapat / analisa / saran', sortOrder: 8 },
        { name: 'Konsep jawaban / sambutan', sortOrder: 9 },
        { name: 'Konsep laporan', sortOrder: 10 },
        { name: 'Data diolah', sortOrder: 11 },
        { name: 'Ditindaklanjuti', sortOrder: 12 },
        { name: 'Diagendakan / dijadwalkan', sortOrder: 13 },
        { name: 'Harap dibantu', sortOrder: 14 },
        { name: 'File', sortOrder: 15 },
    ]

    for (const instr of instructionsData) {
        await prisma.dispositionInstruction.upsert({
            where: { name: instr.name },
            update: { sortOrder: instr.sortOrder },
            create: instr
        })
    }

    console.log(`✅ Created ${instructionsData.length} disposition instructions`)

    console.log('')
    console.log('🎉 Database seeding completed!')
    console.log('')
    console.log('📋 Login credentials:')
    console.log('   Admin:     admin@tvri.go.id / password123')
    console.log('   Ketua Tim: ketuatim@tvri.go.id / password123')
    console.log('   Kepsta:    kepsta@tvri.go.id / password123')
    console.log('   Staff:     staff@tvri.go.id / password123')
}

main()
    .catch((e) => {
        console.error('❌ Seed error:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
