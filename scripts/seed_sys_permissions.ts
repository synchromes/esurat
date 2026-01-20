import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PERMISSIONS = [
    { name: 'log.view', description: 'View system activity logs', module: 'system' },
    { name: 'settings.view', description: 'View system settings', module: 'system' },
    { name: 'settings.edit', description: 'Edit system settings', module: 'system' },
]

async function main() {
    console.log('Seeding System Permissions...')

    for (const p of PERMISSIONS) {
        const permission = await prisma.permission.upsert({
            where: { name: p.name },
            update: {
                description: p.description,
                module: p.module
            },
            create: {
                name: p.name,
                description: p.description,
                module: p.module
            }
        })
        console.log(`- Permission prepared: ${permission.name}`)
    }

    // Assign to Admin Role
    const adminRole = await prisma.role.findUnique({ where: { name: 'admin' } })
    if (adminRole) {
        console.log('Assigning permissions to Admin...')
        for (const p of PERMISSIONS) {
            const permission = await prisma.permission.findUnique({ where: { name: p.name } })
            if (permission) {
                await prisma.rolePermission.upsert({
                    where: {
                        roleId_permissionId: {
                            roleId: adminRole.id,
                            permissionId: permission.id
                        }
                    },
                    update: {},
                    create: {
                        roleId: adminRole.id,
                        permissionId: permission.id
                    }
                })
            }
        }
    }

    // Assign Log View to TU Role? Maybe useful
    const tuRole = await prisma.role.findUnique({ where: { name: 'tata_usaha' } })
    if (tuRole) {
        console.log('Assigning log permission to Tata Usaha...')
        const logPerm = await prisma.permission.findUnique({ where: { name: 'log.view' } })
        if (logPerm) {
            await prisma.rolePermission.upsert({
                where: {
                    roleId_permissionId: {
                        roleId: tuRole.id,
                        permissionId: logPerm.id
                    }
                },
                update: {},
                create: {
                    roleId: tuRole.id,
                    permissionId: logPerm.id
                }
            })
        }
    }

    console.log('Seed completed.')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
