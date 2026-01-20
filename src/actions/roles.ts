'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { PERMISSIONS } from '@/lib/permissions'

// ==================== GET ROLES ====================

export async function getRoles() {
    try {
        await requirePermission(PERMISSIONS.ROLE_VIEW)

        const roles = await prisma.role.findMany({
            orderBy: { name: 'asc' },
            include: {
                _count: { select: { users: true } },
                permissions: {
                    select: { permission: { select: { id: true, name: true, module: true } } }
                }
            }
        })

        return { success: true, data: roles }
    } catch (error) {
        console.error('Get roles error:', error)
        return { success: false, error: 'Gagal mengambil data role' }
    }
}

// ==================== GET ROLE BY ID ====================

export async function getRoleById(roleId: string) {
    try {
        await requirePermission(PERMISSIONS.ROLE_VIEW)

        const role = await prisma.role.findUnique({
            where: { id: roleId },
            include: {
                permissions: {
                    select: { permission: { select: { id: true, name: true, module: true } } }
                }
            }
        })

        if (!role) {
            return { success: false, error: 'Role tidak ditemukan' }
        }

        return {
            success: true,
            data: {
                ...role,
                permissionIds: role.permissions.map((p: any) => p.permission.id)
            }
        }
    } catch (error) {
        console.error('Get role error:', error)
        return { success: false, error: 'Gagal mengambil data role' }
    }
}

// ==================== GET PERMISSIONS ====================

export async function getPermissions() {
    try {
        await requirePermission(PERMISSIONS.ROLE_VIEW)

        const permissions = await prisma.permission.findMany({
            orderBy: [{ module: 'asc' }, { name: 'asc' }]
        })

        return { success: true, data: permissions }
    } catch (error) {
        console.error('Get permissions error:', error)
        return { success: false, error: 'Gagal mengambil data permission' }
    }
}

// ==================== CREATE ROLE ====================

export async function createRole(data: {
    name: string;
    description?: string;
    permissionIds: string[]
}) {
    try {
        await requirePermission(PERMISSIONS.ROLE_CREATE)

        const existing = await prisma.role.findUnique({ where: { name: data.name } })
        if (existing) {
            return { success: false, error: 'Nama role sudah digunakan' }
        }

        await prisma.$transaction(async (tx: any) => {
            const role = await tx.role.create({
                data: {
                    name: data.name,
                    description: data.description,
                }
            })

            if (data.permissionIds.length > 0) {
                await tx.rolePermission.createMany({
                    data: data.permissionIds.map(permissionId => ({
                        roleId: role.id,
                        permissionId
                    }))
                })
            }
        })

        revalidatePath('/admin/roles')
        return { success: true }
    } catch (error) {
        console.error('Create role error:', error)
        return { success: false, error: 'Gagal membuat role' }
    }
}

// ==================== UPDATE ROLE ====================

export async function updateRole(roleId: string, data: {
    name?: string;
    description?: string;
    permissionIds?: string[]
}) {
    try {
        await requirePermission(PERMISSIONS.ROLE_EDIT)

        const role = await prisma.role.findUnique({ where: { id: roleId } })
        if (!role) {
            return { success: false, error: 'Role tidak ditemukan' }
        }

        if (role.isSystem) {
            return { success: false, error: 'Role sistem tidak dapat diubah' }
        }

        if (data.name && data.name !== role.name) {
            const existing = await prisma.role.findUnique({ where: { name: data.name } })
            if (existing) {
                return { success: false, error: 'Nama role sudah digunakan' }
            }
        }

        await prisma.$transaction(async (tx: any) => {
            // Update basic info
            const updateData: any = {}
            if (data.name) updateData.name = data.name
            if (data.description !== undefined) updateData.description = data.description

            if (Object.keys(updateData).length > 0) {
                await tx.role.update({
                    where: { id: roleId },
                    data: updateData
                })
            }

            // Update permissions if provided
            if (data.permissionIds) {
                await tx.rolePermission.deleteMany({ where: { roleId } })
                if (data.permissionIds.length > 0) {
                    await tx.rolePermission.createMany({
                        data: data.permissionIds.map(permissionId => ({
                            roleId,
                            permissionId
                        }))
                    })
                }
            }
        })

        revalidatePath('/admin/roles')
        revalidatePath(`/admin/roles/${roleId}`)
        return { success: true }
    } catch (error) {
        console.error('Update role error:', error)
        return { success: false, error: 'Gagal mengupdate role' }
    }
}

// ==================== DELETE ROLE ====================

export async function deleteRole(roleId: string) {
    try {
        await requirePermission(PERMISSIONS.ROLE_DELETE)

        const role = await prisma.role.findUnique({ where: { id: roleId } })
        if (!role) {
            return { success: false, error: 'Role tidak ditemukan' }
        }

        if (role.isSystem) {
            return { success: false, error: 'Role sistem tidak dapat dihapus' }
        }

        await prisma.role.delete({ where: { id: roleId } })

        revalidatePath('/admin/roles')
        return { success: true }
    } catch (error) {
        console.error('Delete role error:', error)
        return { success: false, error: 'Gagal menghapus role' }
    }
}
