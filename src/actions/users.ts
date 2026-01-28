'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { requirePermission, getSession } from '@/lib/auth'
import { PERMISSIONS } from '@/lib/permissions'
import bcrypt from 'bcryptjs'

// Helper: Check if current user is admin
async function isCurrentUserAdmin(): Promise<boolean> {
    const session = await getSession()
    return session?.user?.roles?.includes('admin') || false
}

// Helper: Check if trying to assign admin role
async function containsAdminRole(roleIds: string[]): Promise<boolean> {
    if (!roleIds || roleIds.length === 0) return false
    const adminRole = await prisma.role.findUnique({ where: { name: 'admin' } })
    if (!adminRole) return false
    return roleIds.includes(adminRole.id)
}

// ==================== GET USERS ====================

export async function getUsers() {
    try {
        await requirePermission(PERMISSIONS.USER_VIEW)

        const users = await prisma.user.findMany({
            include: {
                roles: {
                    include: {
                        role: { select: { name: true } }
                    }
                }
            },
            orderBy: { name: 'asc' }
        })

        return { success: true, data: users }
    } catch (error) {
        console.error('Get users error:', error)
        return { success: false, error: 'Gagal mengambil data pengguna' }
    }
}

// ==================== GET USER BY ID ====================

export async function getUserById(userId: string) {
    try {
        await requirePermission(PERMISSIONS.USER_VIEW)

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                roles: {
                    select: { roleId: true }
                }
            }
        })

        if (!user) {
            return { success: false, error: 'Pengguna tidak ditemukan' }
        }

        return {
            success: true,
            data: {
                ...user,
                roleIds: user.roles.map((r: any) => r.roleId)
            }
        }
    } catch (error) {
        console.error('Get user error:', error)
        return { success: false, error: 'Gagal mengambil data pengguna' }
    }
}

// ==================== CREATE USER ====================

export async function createUser(data: {
    name: string;
    email: string;
    password: string;
    isActive: boolean;

    roleIds: string[];
    phoneNumber?: string;
}) {
    try {
        await requirePermission(PERMISSIONS.USER_CREATE)

        const existing = await prisma.user.findUnique({ where: { email: data.email } })
        if (existing) {
            return { success: false, error: 'Email sudah digunakan' }
        }

        const hashedPassword = await bcrypt.hash(data.password, 10)

        // Prevent non-admin from assigning admin role
        if (data.roleIds && data.roleIds.length > 0) {
            const tryingToAssignAdmin = await containsAdminRole(data.roleIds)
            if (tryingToAssignAdmin && !(await isCurrentUserAdmin())) {
                return { success: false, error: 'Hanya admin yang dapat menetapkan role admin' }
            }
        }

        await prisma.$transaction(async (tx: any) => {
            const user = await tx.user.create({
                data: {
                    name: data.name,
                    email: data.email,
                    password: hashedPassword,
                    isActive: data.isActive,
                    phoneNumber: data.phoneNumber || null,
                }
            })

            if (data.roleIds.length > 0) {
                await tx.userRole.createMany({
                    data: data.roleIds.map(roleId => ({
                        userId: user.id,
                        roleId
                    }))
                })
            }
        })

        revalidatePath('/admin/users')
        return { success: true }
    } catch (error) {
        console.error('Create user error:', error)
        return { success: false, error: 'Gagal membuat pengguna' }
    }
}

// ==================== UPDATE USER ====================

export async function updateUser(userId: string, data: {
    name?: string;
    email?: string;
    password?: string;
    isActive?: boolean;

    roleIds?: string[];
    phoneNumber?: string;
}) {
    try {
        await requirePermission(PERMISSIONS.USER_UPDATE)

        const user = await prisma.user.findUnique({ where: { id: userId } })
        if (!user) {
            return { success: false, error: 'Pengguna tidak ditemukan' }
        }

        if (data.email && data.email !== user.email) {
            const existing = await prisma.user.findUnique({ where: { email: data.email } })
            if (existing) {
                return { success: false, error: 'Email sudah digunakan' }
            }
        }

        await prisma.$transaction(async (tx: any) => {
            // Update basic info
            const updateData: any = {}
            if (data.name) updateData.name = data.name
            if (data.email) updateData.email = data.email
            if (typeof data.isActive === 'boolean') updateData.isActive = data.isActive
            if (data.phoneNumber !== undefined) updateData.phoneNumber = data.phoneNumber || null
            if (data.password) {
                updateData.password = await bcrypt.hash(data.password, 10)
            }

            if (Object.keys(updateData).length > 0) {
                await tx.user.update({
                    where: { id: userId },
                    data: updateData
                })
            }

            // Update roles if provided
            if (data.roleIds) {
                // Prevent non-admin from assigning admin role
                const tryingToAssignAdmin = await containsAdminRole(data.roleIds)
                if (tryingToAssignAdmin && !(await isCurrentUserAdmin())) {
                    throw new Error('Hanya admin yang dapat menetapkan role admin')
                }
                await tx.userRole.deleteMany({ where: { userId } })
                if (data.roleIds.length > 0) {
                    await tx.userRole.createMany({
                        data: data.roleIds.map(roleId => ({
                            userId,
                            roleId
                        }))
                    })
                }
            }
        })

        revalidatePath('/admin/users')
        revalidatePath(`/admin/users/${userId}`)
        return { success: true }
    } catch (error) {
        console.error('Update user error:', error)
        return { success: false, error: 'Gagal mengupdate pengguna' }
    }
}

// ==================== DELETE USER ====================

export async function deleteUser(userId: string) {
    try {
        await requirePermission(PERMISSIONS.USER_DELETE)

        await prisma.user.delete({ where: { id: userId } })

        revalidatePath('/admin/users')
        return { success: true }
    } catch (error) {
        console.error('Delete user error:', error)
        return { success: false, error: 'Gagal menghapus pengguna' }
    }
}
