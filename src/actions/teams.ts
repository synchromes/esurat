'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { PERMISSIONS } from '@/lib/permissions'

// ==================== GET TEAMS ====================

export async function getTeams() {
    try {
        await requirePermission(PERMISSIONS.USER_VIEW)

        const teams = await prisma.team.findMany({
            include: {
                members: {
                    include: {
                        user: {
                            select: { id: true, name: true, email: true, avatar: true }
                        }
                    }
                },
                _count: { select: { members: true } }
            },
            orderBy: { name: 'asc' }
        })

        return { success: true, data: teams }
    } catch (error) {
        console.error('Get teams error:', error)
        return { success: false, error: 'Gagal mengambil data tim' }
    }
}

// ==================== GET TEAM BY ID ====================

export async function getTeamById(teamId: string) {
    try {
        await requirePermission(PERMISSIONS.USER_VIEW)

        const team = await prisma.team.findUnique({
            where: { id: teamId },
            include: {
                members: {
                    include: {
                        user: {
                            select: { id: true, name: true, email: true, avatar: true, isActive: true }
                        }
                    },
                    orderBy: { joinedAt: 'asc' }
                }
            }
        })

        if (!team) {
            return { success: false, error: 'Tim tidak ditemukan' }
        }

        return { success: true, data: team }
    } catch (error) {
        console.error('Get team error:', error)
        return { success: false, error: 'Gagal mengambil data tim' }
    }
}

// ==================== CREATE TEAM ====================

export async function createTeam(data: { name: string; description?: string }) {
    try {
        await requirePermission(PERMISSIONS.USER_CREATE)

        const existing = await prisma.team.findUnique({ where: { name: data.name } })
        if (existing) {
            return { success: false, error: 'Nama tim sudah digunakan' }
        }

        const team = await prisma.team.create({
            data: {
                name: data.name,
                description: data.description
            }
        })

        revalidatePath('/admin/teams')
        return { success: true, data: team }
    } catch (error) {
        console.error('Create team error:', error)
        return { success: false, error: 'Gagal membuat tim' }
    }
}

// ==================== UPDATE TEAM ====================

export async function updateTeam(teamId: string, data: { name?: string; description?: string; isActive?: boolean }) {
    try {
        await requirePermission(PERMISSIONS.USER_UPDATE)

        const team = await prisma.team.findUnique({ where: { id: teamId } })
        if (!team) {
            return { success: false, error: 'Tim tidak ditemukan' }
        }

        if (data.name && data.name !== team.name) {
            const existing = await prisma.team.findUnique({ where: { name: data.name } })
            if (existing) {
                return { success: false, error: 'Nama tim sudah digunakan' }
            }
        }

        const updated = await prisma.team.update({
            where: { id: teamId },
            data
        })

        revalidatePath('/admin/teams')
        return { success: true, data: updated }
    } catch (error) {
        console.error('Update team error:', error)
        return { success: false, error: 'Gagal mengupdate tim' }
    }
}

// ==================== DELETE TEAM ====================

export async function deleteTeam(teamId: string) {
    try {
        await requirePermission(PERMISSIONS.USER_DELETE)

        await prisma.teamMember.deleteMany({ where: { teamId } })
        await prisma.team.delete({ where: { id: teamId } })

        revalidatePath('/admin/teams')
        return { success: true }
    } catch (error) {
        console.error('Delete team error:', error)
        return { success: false, error: 'Gagal menghapus tim' }
    }
}

// ==================== ADD MEMBER TO TEAM ====================

export async function addTeamMember(teamId: string, userId: string, role: string = 'MEMBER') {
    try {
        await requirePermission(PERMISSIONS.USER_UPDATE)

        const existing = await prisma.teamMember.findUnique({
            where: { teamId_userId: { teamId, userId } }
        })

        if (existing) {
            return { success: false, error: 'Pengguna sudah menjadi anggota tim ini' }
        }

        await prisma.teamMember.create({
            data: { teamId, userId, role }
        })

        revalidatePath('/admin/teams')
        revalidatePath(`/admin/teams/${teamId}`)
        return { success: true }
    } catch (error) {
        console.error('Add team member error:', error)
        return { success: false, error: 'Gagal menambahkan anggota' }
    }
}

// ==================== REMOVE MEMBER FROM TEAM ====================

export async function removeTeamMember(teamId: string, userId: string) {
    try {
        await requirePermission(PERMISSIONS.USER_UPDATE)

        await prisma.teamMember.delete({
            where: { teamId_userId: { teamId, userId } }
        })

        revalidatePath('/admin/teams')
        revalidatePath(`/admin/teams/${teamId}`)
        return { success: true }
    } catch (error) {
        console.error('Remove team member error:', error)
        return { success: false, error: 'Gagal menghapus anggota' }
    }
}

// ==================== UPDATE MEMBER ROLE ====================

export async function updateTeamMemberRole(teamId: string, userId: string, role: string) {
    try {
        await requirePermission(PERMISSIONS.USER_UPDATE)

        await prisma.teamMember.update({
            where: { teamId_userId: { teamId, userId } },
            data: { role }
        })

        revalidatePath('/admin/teams')
        revalidatePath(`/admin/teams/${teamId}`)
        return { success: true }
    } catch (error) {
        console.error('Update member role error:', error)
        return { success: false, error: 'Gagal mengupdate role anggota' }
    }
}

// ==================== GET USERS NOT IN TEAM ====================

export async function getUsersNotInTeam(teamId: string) {
    try {
        await requirePermission(PERMISSIONS.USER_VIEW)

        const users = await prisma.user.findMany({
            where: {
                isActive: true,
                teamMemberships: {
                    none: { teamId }
                }
            },
            select: { id: true, name: true, email: true },
            orderBy: { name: 'asc' }
        })

        return { success: true, data: users }
    } catch (error) {
        console.error('Get users not in team error:', error)
        return { success: false, error: 'Gagal mengambil data pengguna' }
    }
}
