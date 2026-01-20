import prisma from './prisma'

/**
 * Check if a user has a specific permission
 * This is the ONLY way to check permissions - never check role names directly
 */
export async function hasPermission(userId: string, permissionName: string): Promise<boolean> {
    const count = await prisma.rolePermission.count({
        where: {
            permission: {
                name: permissionName
            },
            role: {
                users: {
                    some: {
                        userId: userId
                    }
                }
            }
        }
    })

    return count > 0
}

/**
 * Get all permissions for a user
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
    const permissions = await prisma.permission.findMany({
        where: {
            roles: {
                some: {
                    role: {
                        users: {
                            some: {
                                userId: userId
                            }
                        }
                    }
                }
            }
        },
        select: {
            name: true
        }
    })

    return permissions.map(p => p.name)
}

/**
 * Get all roles for a user
 */
export async function getUserRoles(userId: string): Promise<string[]> {
    const roles = await prisma.role.findMany({
        where: {
            users: {
                some: {
                    userId: userId
                }
            }
        },
        select: {
            name: true
        }
    })

    return roles.map(r => r.name)
}

/**
 * Check if user has any of the specified permissions
 */
export async function hasAnyPermission(userId: string, permissionNames: string[]): Promise<boolean> {
    const count = await prisma.rolePermission.count({
        where: {
            permission: {
                name: {
                    in: permissionNames
                }
            },
            role: {
                users: {
                    some: {
                        userId: userId
                    }
                }
            }
        }
    })

    return count > 0
}

/**
 * Check if user has all of the specified permissions
 */
export async function hasAllPermissions(userId: string, permissionNames: string[]): Promise<boolean> {
    const permissions = await getUserPermissions(userId)
    return permissionNames.every(p => permissions.includes(p))
}

/**
 * Permission constants - use these instead of magic strings
 */
export const PERMISSIONS = {
    // Letter permissions
    LETTER_CREATE: 'letter.create',
    LETTER_VIEW: 'letter.view',
    LETTER_VIEW_ALL: 'letter.view_all',
    LETTER_EDIT: 'letter.edit',
    LETTER_DELETE: 'letter.delete',
    LETTER_APPROVE: 'letter.approve',
    LETTER_REJECT: 'letter.reject',
    LETTER_SIGN: 'letter.sign',
    LETTER_DOWNLOAD: 'letter.download',

    // User permissions
    USER_CREATE: 'user.create',
    USER_VIEW: 'user.view',
    USER_UPDATE: 'user.edit',
    USER_EDIT: 'user.edit',
    USER_DELETE: 'user.delete',

    // Role permissions
    ROLE_CREATE: 'role.create',
    ROLE_VIEW: 'role.view',
    ROLE_EDIT: 'role.edit',
    ROLE_DELETE: 'role.delete',
    ROLE_ASSIGN: 'role.assign',

    // Settings permissions
    SETTINGS_VIEW: 'settings.view',
    SETTINGS_EDIT: 'settings.edit',

    // Category permissions
    CATEGORY_CREATE: 'category.create',
    CATEGORY_EDIT: 'category.edit',
    CATEGORY_DELETE: 'category.delete',

    // Activity log permissions
    LOG_VIEW: 'log.view',

    // Disposition permissions
    DISPOSITION_CREATE: 'disposition.create',
    DISPOSITION_VIEW: 'disposition.view',
    DISPOSITION_VIEW_ALL: 'disposition.view_all',
    DISPOSITION_UPDATE: 'disposition.update',
    DISPOSITION_SET_NUMBER: 'disposition.set_number',

    // Template permissions
    TEMPLATE_MANAGE: 'template.manage',
    TEMPLATE_VIEW: 'template.view',

    // Category permissions
    CATEGORY_MANAGE: 'category.manage', // Create, Edit, Delete
    CATEGORY_VIEW: 'category.view',

    // Archive Code permissions
    ARCHIVE_CODE_MANAGE: 'archive_code.manage',
    ARCHIVE_CODE_VIEW: 'archive_code.view',
} as const

export type PermissionName = typeof PERMISSIONS[keyof typeof PERMISSIONS]
