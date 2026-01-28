import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const permName = 'disposition.set_number'

    // Create Permission
    const permission = await prisma.permission.upsert({
        where: { name: permName },
        update: {},
        create: {
            name: permName,
            description: 'Can set disposition number',
            module: 'disposition'
        }
    })

    console.log('Permission created:', permission.name)

    // Assign to Admin and TU
    const roles = ['admin', 'tata_usaha'] // Adjust role names as per your seeds

    for (const roleName of roles) {
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
            console.log(`Assigned to ${roleName}`)
        } else {
            console.log(`Role ${roleName} not found`)
        }
    }
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
