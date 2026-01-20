'use client'

import { useSession, signOut } from 'next-auth/react'
import { Bell, LogOut, Moon, Sun, User, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { useTheme } from 'next-themes'
import { Badge } from '@/components/ui/badge'

import { MobileSidebar } from './Sidebar'

export function Header() {
    const { data: session } = useSession()
    const { theme, setTheme } = useTheme()

    const userInitials = session?.user?.name
        ?.split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'U'

    return (
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 md:px-6 gap-4">
            {/* Mobile Menu & Search Bar */}
            <div className="flex flex-1 items-center gap-2 lg:gap-4 max-w-md">
                <MobileSidebar />
                <div className="relative w-full">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Cari surat..."
                        className="pl-8 w-full bg-muted/50"
                    />
                </div>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-2">
                {/* Notifications */}
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    <Badge
                        variant="destructive"
                        className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                    >
                        3
                    </Badge>
                </Button>

                {/* Theme Toggle */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                >
                    <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    <span className="sr-only">Toggle theme</span>
                </Button>

                {/* User Menu */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                            <Avatar className="h-10 w-10">
                                <AvatarImage src={session?.user?.avatar || ''} alt={session?.user?.name || ''} />
                                <AvatarFallback className="bg-primary text-primary-foreground">
                                    {userInitials}
                                </AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end" forceMount>
                        <DropdownMenuLabel className="font-normal">
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-medium leading-none">{session?.user?.name}</p>
                                <p className="text-xs leading-none text-muted-foreground">
                                    {session?.user?.email}
                                </p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <span>Profil Saya</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            className="flex items-center gap-2 text-destructive focus:text-destructive"
                            onClick={() => {
                                const callbackUrl = process.env.NEXT_PUBLIC_APP_URL
                                    ? `${process.env.NEXT_PUBLIC_APP_URL}/login`
                                    : '/login'
                                signOut({ callbackUrl })
                            }}
                        >
                            <LogOut className="h-4 w-4" />
                            <span>Keluar</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    )
}
