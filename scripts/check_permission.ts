import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    // List all roles
    const roles = await prisma.role.findMany({ select: { name: true } })
    console.log('Available roles:', roles.map(r => r.name))

    // Check permission
    const perm = await prisma.permission.findUnique({
        where: { name: 'disposition.set_number' },
        include: {
            roles: {
                include: { role: true }
            }
        }
    })

    if (perm) {
        console.log('\nPermission found:', perm.name)
        console.log('Assigned to roles:', perm.roles.map(r => r.role.name))
    } else {
        console.log('\nPermission NOT FOUND!')
    }

    // Check if old permission exists
    const oldPerm = await prisma.permission.findUnique({
        where: { name: 'disposition:set-number' }
    })
    if (oldPerm) {
        console.log('\n⚠️ OLD permission still exists: disposition:set-number - should be deleted')
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
