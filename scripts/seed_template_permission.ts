import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Seeding template permissions...')

    const permissions = [
        {
            name: 'template.manage',
            description: 'Can upload and delete templates',
            module: 'template'
        },
        {
            name: 'template.view',
            description: 'Can view and download templates',
            module: 'template'
        },
        {
            name: 'category.manage',
            description: 'Can manage letter categories',
            module: 'category'
        },
        {
            name: 'category.view',
            description: 'Can view letter categories',
            module: 'category'
        },
        {
            name: 'archive_code.manage',
            description: 'Can manage archive codes',
            module: 'archive_code'
        },
        {
            name: 'archive_code.view',
            description: 'Can view archive codes',
            module: 'archive_code'
        }
    ]

    for (const perm of permissions) {
        await prisma.permission.upsert({
            where: { name: perm.name },
            update: {
                description: perm.description,
                module: perm.module
            },
            create: {
                name: perm.name,
                description: perm.description,
                module: perm.module
            }
        })
        console.log(`Permission ${perm.name} upserted.`)
    }

    // Assign permissions to roles
    const roles = {
        'Admin': ['template.manage', 'template.view', 'category.manage', 'category.view', 'archive_code.manage', 'archive_code.view'],
        'Kasubbag TU': ['template.manage', 'template.view', 'category.manage', 'category.view', 'archive_code.manage', 'archive_code.view'],
        'Kepala Stasiun': ['template.view', 'category.view', 'archive_code.view'],
        'Plt. Kepala Stasiun': ['template.view', 'category.view', 'archive_code.view'],
        'Ketua Tim': ['template.view', 'category.view', 'archive_code.view'],
        'Anggota Tim': ['template.view', 'category.view', 'archive_code.view'],
        'Pegawai': ['template.view', 'category.view', 'archive_code.view'],
        'Staff': ['template.view', 'category.view', 'archive_code.view'],
        'Agendaris': ['template.view', 'category.view', 'archive_code.view'],
    }

    // Get all roles from DB to be safe
    const dbRoles = await prisma.role.findMany()
    const roleMap = new Map(dbRoles.map(r => [r.name, r.id]))

    for (const [roleName, perms] of Object.entries(roles)) {
        if (!roleMap.has(roleName)) {
            console.log(`Role ${roleName} not found, skipping.`)
            continue
        }

        const roleId = roleMap.get(roleName)!

        for (const permName of perms) {
            const perm = await prisma.permission.findUnique({ where: { name: permName } })
            if (perm) {
                await prisma.rolePermission.upsert({
                    where: {
                        roleId_permissionId: {
                            roleId,
                            permissionId: perm.id
                        }
                    },
                    update: {},
                    create: {
                        roleId,
                        permissionId: perm.id
                    }
                })
                console.log(`Assigned ${permName} to ${roleName}`)
            }
        }
    }

    console.log('Seeding completed.')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
