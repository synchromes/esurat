'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
    LayoutDashboard,
    FileText,
    Users,
    Shield,
    Settings,
    FolderOpen,
    History,
    Plus,
    ChevronLeft,
    ChevronRight,
    Inbox,
    MessageCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { useSession } from 'next-auth/react'

interface NavItem {
    title: string
    href: string
    icon: React.ComponentType<{ className?: string }>
    permission?: string
}

const mainNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard
    },
    {
        title: 'Surat Saya',
        href: '/letters',
        icon: FileText,
        permission: 'letter.view'
    },
    {
        title: 'Buat Surat',
        href: '/letters/create',
        icon: Plus,
        permission: 'letter.create'
    },
    {
        title: 'Kategori',
        href: '/categories',
        icon: FolderOpen,
        permission: 'category.view'
    },
    {
        title: 'Kode Arsip',
        href: '/archive-codes',
        icon: FolderOpen,
        permission: 'archive_code.view'
    },
    {
        title: 'Disposisi',
        href: '/dispositions',
        icon: Inbox,
        permission: 'disposition.view'
    },
    {
        title: 'Template',
        href: '/templates',
        icon: FileText,
        permission: 'template.view'
    }
]

const adminNavItems: NavItem[] = [
    {
        title: 'Kelola Pengguna',
        href: '/admin/users',
        icon: Users,
        permission: 'user.view'
    },
    {
        title: 'Kelola Tim',
        href: '/admin/teams',
        icon: Users,
        permission: 'user.view'
    },
    {
        title: 'Kelola Role',
        href: '/admin/roles',
        icon: Shield,
        permission: 'role.view'
    },
    {
        title: 'Log Aktivitas',
        href: '/logs',
        icon: History,
        permission: 'log.view'
    },
    {
        title: 'Pengaturan',
        href: '/settings',
        icon: Settings,
        permission: 'settings.view'
    },
    {
        title: 'Notifikasi',
        href: '/admin/notifications',
        icon: MessageCircle,
        permission: 'settings.view'
    }
]

import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Menu } from "lucide-react"

// ... imports remain the same

// Helper component for Navigation Content
function NavContent({ collapsed = false, pathname, userPermissions }: { collapsed?: boolean, pathname: string, userPermissions: string[] }) {
    const hasPermission = (permission?: string) => {
        if (!permission) return true
        return userPermissions.includes(permission)
    }

    const filteredMainNav = mainNavItems.filter(item => hasPermission(item.permission))
    const filteredAdminNav = adminNavItems.filter(item => hasPermission(item.permission))

    return (
        <>
            <div className="flex h-16 items-center border-b px-4 gap-2">
                <Link href="/dashboard" className={cn("flex items-center gap-2", collapsed && "justify-center w-full")}>
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                        <FileText className="h-4 w-4 text-primary-foreground" />
                    </div>
                    {!collapsed && <span className="font-bold text-lg">E-Surat</span>}
                </Link>
            </div>

            <div className="flex flex-col gap-1 p-2">
                <div className="space-y-1">
                    {!collapsed && (
                        <span className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Menu Utama
                        </span>
                    )}
                    {filteredMainNav.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                                    isActive
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                                    collapsed && 'justify-center px-2'
                                )}
                                title={collapsed ? item.title : undefined}
                            >
                                <item.icon className="h-4 w-4 flex-shrink-0" />
                                {!collapsed && <span>{item.title}</span>}
                            </Link>
                        )
                    })}
                </div>

                {filteredAdminNav.length > 0 && (
                    <div className="mt-4 space-y-1">
                        {!collapsed && (
                            <span className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Administrasi
                            </span>
                        )}
                        {filteredAdminNav.map((item) => {
                            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                                        isActive
                                            ? 'bg-primary text-primary-foreground'
                                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                                        collapsed && 'justify-center px-2'
                                    )}
                                    title={collapsed ? item.title : undefined}
                                >
                                    <item.icon className="h-4 w-4 flex-shrink-0" />
                                    {!collapsed && <span>{item.title}</span>}
                                </Link>
                            )
                        })}
                    </div>
                )}
            </div>
        </>
    )
}

export function Sidebar() {
    const pathname = usePathname()
    const { data: session } = useSession()
    const [collapsed, setCollapsed] = useState(false)
    const userPermissions = session?.user?.permissions || []

    return (
        <aside
            className={cn(
                'hidden lg:flex fixed left-0 top-0 z-40 h-screen border-r bg-card flex-col transition-all duration-300',
                collapsed ? 'w-16' : 'w-64'
            )}
        >
            {/* Collapse Toggle - Only visible on desktop sidebar */}
            <div className="absolute right-[-12px] top-6 z-50">
                <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => setCollapsed(!collapsed)}
                    className="h-6 w-6 rounded-full border shadow-md"
                >
                    {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
                </Button>
            </div>

            <NavContent collapsed={collapsed} pathname={pathname} userPermissions={userPermissions} />
        </aside>
    )
}

export function MobileSidebar() {
    const pathname = usePathname()
    const { data: session } = useSession()
    const userPermissions = session?.user?.permissions || []
    const [open, setOpen] = useState(false)

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden mr-2">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Toggle Menu</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
                <SheetTitle className="sr-only">Menu Navigasi</SheetTitle>
                <SheetDescription className="sr-only">Menu navigasi aplikasi mobile</SheetDescription>
                <NavContent pathname={pathname} userPermissions={userPermissions} collapsed={false} />
            </SheetContent>
        </Sheet>
    )
}
