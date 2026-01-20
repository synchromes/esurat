import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
    const isLoggedIn = !!req.auth
    const isOnDashboard = req.nextUrl.pathname.startsWith('/dashboard') ||
        req.nextUrl.pathname.startsWith('/letters') ||
        req.nextUrl.pathname.startsWith('/categories') ||
        req.nextUrl.pathname.startsWith('/admin')
    const isOnLogin = req.nextUrl.pathname === '/login'
    const isOnVerify = req.nextUrl.pathname.startsWith('/verify')
    const isOnApi = req.nextUrl.pathname.startsWith('/api')

    // Allow verify and API routes without auth
    if (isOnVerify || isOnApi) {
        return NextResponse.next()
    }

    // Redirect to dashboard if logged in and trying to access login
    if (isOnLogin && isLoggedIn) {
        return NextResponse.redirect(new URL('/dashboard', req.nextUrl))
    }

    // Redirect to login if not logged in and trying to access protected routes
    if (isOnDashboard && !isLoggedIn) {
        const callbackUrl = encodeURIComponent(req.nextUrl.pathname)
        return NextResponse.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, req.nextUrl))
    }

    return NextResponse.next()
})

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|uploads).*)']
}
