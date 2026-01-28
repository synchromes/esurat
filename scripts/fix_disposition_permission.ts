import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const newPermName = 'disposition.set_number'
    const oldPermName = 'disposition:set-number'

    // Delete old permission if exists
    try {
        await prisma.permission.delete({ where: { name: oldPermName } })
        console.log('✅ Deleted old permission:', oldPermName)
    } catch (e: any) {
        if (e.code === 'P2025') {
            console.log('Old permission not found (already deleted)')
        } else {
            console.log('Error deleting old permission:', e.message)
        }
    }

    // Create/update correct permission
    const permission = await prisma.permission.upsert({
        where: { name: newPermName },
        update: {
            description: 'Can set disposition number',
            module: 'disposition'
        },
        create: {
            name: newPermName,
            description: 'Can set disposition number',
            module: 'disposition'
        }
    })
    console.log('✅ Permission ready:', permission.name)

    // Get all available roles
    const allRoles = await prisma.role.findMany({ select: { name: true } })
    console.log('\nAvailable roles:', allRoles.map(r => r.name))

    // Assign to admin-like roles (case insensitive search)
    const targetRoles = ['admin', 'Admin', 'ADMIN', 'tata_usaha', 'tu', 'TU', 'Tata Usaha']

    for (const roleName of targetRoles) {
        const role = await prisma.role.findUnique({ where: { name: roleName } })
        if (role) {
            await prisma.rolePermission.upsert({
                where: {
                    roleId_permissionId: {
                        roleId: role.id,
                        permissionId: permission.id
                    }
                },
                update: {},
                create: {
                    roleId: role.id,
                    permissionId: permission.id
                }
            })
            console.log(`✅ Assigned to: ${roleName}`)
        }
    }

    // Final verification
    const finalPerm = await prisma.permission.findUnique({
        where: { name: newPermName },
        include: { roles: { include: { role: true } } }
    })

    console.log('\n=== FINAL STATUS ===')
    console.log('Permission:', finalPerm?.name)
    console.log('Assigned to:', finalPerm?.roles.map(r => r.role.name) || [])
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
