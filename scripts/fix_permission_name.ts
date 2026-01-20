import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const incorrectName = 'disposition:set-number'
    const correctName = 'disposition.set_number'

    // Check if incorrect exists
    const incorrect = await prisma.permission.findUnique({
        where: { name: incorrectName }
    })

    if (incorrect) {
        console.log(`Found incorrect permission: ${incorrectName}`)
        // Check if correct already exists
        const correct = await prisma.permission.findUnique({
            where: { name: correctName }
        })

        if (correct) {
            // If correct exists, migrate relations and delete incorrect?
            // Or just delete incorrect and ask user to re-assign?
            // Safer to update incorrect to correct if correct doesn't exist.
            // If both exist, we need to merge.
            console.log(`Correct permission ${correctName} also exists. Merging...`)

            // Move roles from incorrect to correct
            const userRoles = await prisma.rolePermission.findMany({
                where: { permissionId: incorrect.id }
            })

            for (const ur of userRoles) {
                await prisma.rolePermission.upsert({
                    where: {
                        roleId_permissionId: {
                            roleId: ur.roleId,
                            permissionId: correct.id
                        }
                    },
                    create: {
                        roleId: ur.roleId,
                        permissionId: correct.id
                    },
                    update: {}
                })
            }

            await prisma.permission.delete({ where: { id: incorrect.id } })
            console.log('Merged and deleted incorrect.')
        } else {
            // Rename
            await prisma.permission.update({
                where: { id: incorrect.id },
                data: { name: correctName }
            })
            console.log(`Renamed to ${correctName}`)
        }
    } else {
        console.log(`Incorrect permission ${incorrectName} not found. checking correct one...`)
        const correct = await prisma.permission.findUnique({
            where: { name: correctName }
        })
        if (correct) console.log("Correct permission exists.")
        else {
            console.log("Creating correct permission...")
            await prisma.permission.create({
                data: {
                    name: correctName,
                    module: 'disposition',
                    description: 'Can set disposition number'
                }
            })
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
