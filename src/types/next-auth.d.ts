import { DefaultSession, DefaultUser } from 'next-auth'
import { JWT, DefaultJWT } from 'next-auth/jwt'

declare module 'next-auth' {
    interface Session {
        user: {
            id: string
            permissions: string[]
            roles: string[]
            avatar: string | null
        } & DefaultSession['user']
    }

    interface User extends DefaultUser {
        id: string
        permissions: string[]
        roles: string[]
        avatar: string | null
    }
}

declare module 'next-auth/jwt' {
    interface JWT extends DefaultJWT {
        id: string
        permissions: string[]
        roles: string[]
        avatar: string | null
    }
}
