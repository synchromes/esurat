import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'
import { getUserPermissions, getUserRoles } from '@/lib/permissions'

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Credentials({
            name: 'credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error('Email dan password harus diisi')
                }

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email as string }
                })

                if (!user) {
                    throw new Error('Email atau password salah')
                }

                if (!user.isActive) {
                    throw new Error('Akun Anda telah dinonaktifkan')
                }

                const isPasswordValid = await bcrypt.compare(
                    credentials.password as string,
                    user.password
                )

                if (!isPasswordValid) {
                    throw new Error('Email atau password salah')
                }

                // Get user permissions and roles
                const [permissions, roles] = await Promise.all([
                    getUserPermissions(user.id),
                    getUserRoles(user.id)
                ])

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    avatar: user.avatar,
                    permissions,
                    roles
                }
            }
        })
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id
                token.permissions = user.permissions
                token.roles = user.roles
                token.avatar = user.avatar
            }
            return token
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.id as string
                session.user.permissions = token.permissions as string[]
                session.user.roles = token.roles as string[]
                session.user.avatar = token.avatar as string | null
            }
            return session
        }
    },
    pages: {
        signIn: '/login',
        error: '/login'
    },
    session: {
        strategy: 'jwt',
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    trustHost: true,
})

/**
 * Get current session with typed user
 */
export async function getSession() {
    return await auth()
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth() {
    const session = await auth()
    if (!session?.user) {
        throw new Error('Unauthorized')
    }
    return session
}

/**
 * Check if current user has permission
 */
export async function checkPermission(permissionName: string): Promise<boolean> {
    const session = await auth()
    if (!session?.user?.permissions) return false
    return session.user.permissions.includes(permissionName)
}

/**
 * Require a specific permission - throws if not authorized
 */
export async function requirePermission(permissionName: string) {
    const session = await requireAuth()
    if (!session.user.permissions?.includes(permissionName)) {
        throw new Error('Forbidden: Insufficient permissions')
    }
    return session
}
