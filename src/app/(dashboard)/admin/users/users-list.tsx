'use client'

import { useEffect, useState, useTransition } from 'react'
import { MoreHorizontal, Mail, Shield, Power, Trash2, Edit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import Link from 'next/link'
import { getUsers, updateUser, deleteUser } from '@/actions/users'

type User = {
    id: string
    name: string
    email: string
    isActive: boolean
    createdAt: Date
    roles: { role: { name: string } }[]
}

export function UsersList() {
    const [users, setUsers] = useState<User[]>([])
    const [isPending, startTransition] = useTransition()

    useEffect(() => {
        loadUsers()
    }, [])

    const loadUsers = () => {
        startTransition(async () => {
            const result = await getUsers()
            if (result.success && result.data) {
                setUsers(result.data as any)
            }
        })
    }

    const handleToggleStatus = async (user: User) => {
        const result = await updateUser(user.id, { isActive: !user.isActive })
        if (result.success) {
            toast.success(`Status pengguna berhasil diubah`)
            loadUsers()
        } else {
            toast.error(result.error)
        }
    }

    const handleDelete = async (userId: string) => {
        if (!confirm('Yakin ingin menghapus pengguna ini?')) return
        const result = await deleteUser(userId)
        if (result.success) {
            toast.success('Pengguna berhasil dihapus')
            loadUsers()
        } else {
            toast.error(result.error)
        }
    }

    return (
        <Card>
            <CardContent className="p-0">
                {isPending && users.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">Memuat data...</div>
                ) : users.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">Tidak ada pengguna</div>
                ) : (
                    <div className="divide-y">
                        {users.map((user) => (
                            <div key={user.id} className="flex items-center gap-4 p-4 hover:bg-muted/50">
                                <Avatar>
                                    <AvatarFallback>
                                        {user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="font-medium truncate">{user.name}</p>
                                        {!user.isActive && (
                                            <Badge variant="secondary">Nonaktif</Badge>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Mail className="h-3 w-3" />
                                        <span>{user.email}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {user.roles.map((r, i) => (
                                        <Badge key={i} variant="outline" className="flex items-center gap-1">
                                            <Shield className="h-3 w-3" />
                                            {r.role.name}
                                        </Badge>
                                    ))}
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem asChild>
                                            <Link href={`/admin/users/${user.id}`} className="flex items-center cursor-pointer">
                                                <Edit className="mr-2 h-4 w-4" />
                                                Edit
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleToggleStatus(user)}>
                                            <Power className="mr-2 h-4 w-4" />
                                            {user.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            className="text-destructive"
                                            onClick={() => handleDelete(user.id)}
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Hapus
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
