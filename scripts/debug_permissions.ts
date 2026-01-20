import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('--- Roles ---')
    const roles = await prisma.role.findMany({ include: { permissions: { include: { permission: true } } } })
    roles.forEach(r => {
        console.log(`Role: ${r.name} (ID: ${r.id})`)
        const templatePerms = r.permissions.filter(p => p.permission.name.startsWith('template'))
        console.log(`  Template Perms: ${templatePerms.map(p => p.permission.name).join(', ') || 'NONE'}`)
    })

    console.log('\n--- Template Permissions in DB ---')
    const perms = await prisma.permission.findMany({ where: { name: { startsWith: 'template' } } })
    perms.forEach(p => console.log(`Perm: ${p.name} (ID: ${p.id})`))

    console.log('\n--- Users ---')
    const users = await prisma.user.findMany({
        include: { roles: { include: { role: true } } },
        take: 5
    })
    users.forEach(u => {
        console.log(`User: ${u.email} - Roles: ${u.roles.map(ur => ur.role.name).join(', ')}`)
    })
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
