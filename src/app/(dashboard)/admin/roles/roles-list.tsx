'use client'

import { useEffect, useState, useTransition } from 'react'
import { Shield, Users, Key, MoreHorizontal, Trash2, Edit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import Link from 'next/link'
import { getRoles, deleteRole } from '@/actions/roles'

interface Role {
    id: string
    name: string
    description: string | null
    isSystem: boolean
    permissions: { permission: { id: string; name: string; module: string } }[]
    _count: { users: number }
}

export function RolesList() {
    const [roles, setRoles] = useState<Role[]>([])
    const [isPending, startTransition] = useTransition()
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadRoles()
    }, [])

    const loadRoles = () => {
        startTransition(async () => {
            const result = await getRoles()
            if (result.success && result.data) {
                setRoles(result.data as any)
            }
            setLoading(false)
        })
    }

    const handleDelete = async (roleId: string) => {
        if (!confirm('Yakin ingin menghapus role ini?')) return
        startTransition(async () => {
            const result = await deleteRole(roleId)
            if (result.success) {
                toast.success('Role berhasil dihapus')
                loadRoles()
            } else {
                toast.error(result.error)
            }
        })
    }

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {loading ? (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                    Memuat data...
                </div>
            ) : roles.length === 0 ? (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                    Tidak ada role
                </div>
            ) : (
                roles.map((role) => (
                    <Card key={role.id}>
                        <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                    <Shield className="h-5 w-5 text-primary" />
                                    <CardTitle className="text-lg">{role.name}</CardTitle>
                                </div>
                                {!role.isSystem && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem asChild>
                                                <Link href={`/admin/roles/${role.id}`} className="flex items-center cursor-pointer">
                                                    <Edit className="mr-2 h-4 w-4" />
                                                    Edit
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="text-destructive"
                                                onClick={() => handleDelete(role.id)}
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Hapus
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                            </div>
                            <CardDescription>{role.description || 'Tidak ada deskripsi'}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                                <div className="flex items-center gap-1">
                                    <Users className="h-4 w-4" />
                                    <span>{role._count.users} pengguna</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Key className="h-4 w-4" />
                                    <span>{role.permissions?.length || 0} permission</span>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {role.permissions?.slice(0, 4).map((rp) => (
                                    <Badge key={rp.permission.id} variant="secondary" className="text-xs">
                                        {rp.permission.name}
                                    </Badge>
                                ))}
                                {(role.permissions?.length || 0) > 4 && (
                                    <Badge variant="secondary" className="text-xs">
                                        +{(role.permissions?.length || 0) - 4} lainnya
                                    </Badge>
                                )}
                            </div>
                            {role.isSystem && (
                                <Badge variant="outline" className="mt-3">
                                    Role Sistem
                                </Badge>
                            )}
                        </CardContent>
                    </Card>
                ))
            )}
        </div>
    )
}
