'use server'

import prisma from '@/lib/prisma'

// Get users who can approve letters (have letter.approve permission)
export async function getApprovers() {
    try {
        const approvers = await prisma.user.findMany({
            where: {
                isActive: true,
                roles: {
                    some: {
                        role: {
                            permissions: {
                                some: {
                                    permission: {
                                        name: 'letter.approve'
                                    }
                                }
                            }
                        }
                    }
                }
            },
            select: {
                id: true,
                name: true,
                email: true,
                roles: {
                    select: {
                        role: {
                            select: {
                                name: true
                            }
                        }
                    }
                }
            },
            orderBy: { name: 'asc' }
        })

        return approvers.map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.roles[0]?.role.name || 'User'
        }))
    } catch (error) {
        console.error('Error getting approvers:', error)
        return []
    }
}

// Get users who can sign letters (have letter.sign permission)
export async function getSigners() {
    try {
        const signers = await prisma.user.findMany({
            where: {
                isActive: true,
                roles: {
                    some: {
                        role: {
                            permissions: {
                                some: {
                                    permission: {
                                        name: 'letter.sign'
                                    }
                                }
                            }
                        }
                    }
                }
            },
            select: {
                id: true,
                name: true,
                email: true,
                roles: {
                    select: {
                        role: {
                            select: {
                                name: true
                            }
                        }
                    }
                }
            },
            orderBy: { name: 'asc' }
        })

        return signers.map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.roles[0]?.role.name || 'User'
        }))
    } catch (error) {
        console.error('Error getting signers:', error)
        return []
    }
}

// Get all categories
export async function getCategories() {
    try {
        return await prisma.letterCategory.findMany({
            select: {
                id: true,
                name: true,
                code: true,
                color: true
            },
            orderBy: { name: 'asc' }
        })
    } catch (error) {
        console.error('Error getting categories:', error)
        return []
    }
}
