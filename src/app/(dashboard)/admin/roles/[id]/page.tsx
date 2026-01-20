'use client'

import { useState, useTransition, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Shield, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import Link from 'next/link'
import { getRoleById, updateRole, getPermissions } from '@/actions/roles'

interface Permission {
    id: string
    name: string
    module: string
}

export default function EditRolePage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params)
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [isPending, startTransition] = useTransition()
    const [permissions, setPermissions] = useState<Permission[]>([])

    // Form state
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([])
    const [isSystem, setIsSystem] = useState(false)

    useEffect(() => {
        loadData()
    }, [resolvedParams.id])

    const loadData = async () => {
        setLoading(true)
        const [roleResult, permsResult] = await Promise.all([
            getRoleById(resolvedParams.id),
            getPermissions()
        ])

        if (permsResult.success && permsResult.data) {
            setPermissions(permsResult.data)
        }

        if (roleResult.success && roleResult.data) {
            const role = roleResult.data
            setName(role.name)
            setDescription(role.description || '')
            setIsSystem(role.isSystem)
            setSelectedPermissionIds(role.permissionIds)
        } else {
            toast.error(roleResult.error || 'Role tidak ditemukan')
            router.push('/admin/roles')
        }
        setLoading(false)
    }

    const handlePermissionToggle = (permissionId: string, checked: boolean) => {
        if (checked) {
            setSelectedPermissionIds([...selectedPermissionIds, permissionId])
        } else {
            setSelectedPermissionIds(selectedPermissionIds.filter(id => id !== permissionId))
        }
    }

    // Group permissions by module
    const groupedPermissions = permissions.reduce((acc, permission) => {
        const module = permission.module
        if (!acc[module]) acc[module] = []
        acc[module].push(permission)
        return acc
    }, {} as Record<string, Permission[]>)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!name) {
            toast.error('Nama role harus diisi')
            return
        }

        startTransition(async () => {
            const result = await updateRole(resolvedParams.id, {
                name,
                description,
                permissionIds: selectedPermissionIds
            })

            if (result.success) {
                toast.success('Role berhasil diupdate')
                router.push('/admin/roles')
            } else {
                toast.error(result.error || 'Gagal mengupdate role')
            }
        })
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/admin/roles">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Edit Role</h1>
                    <p className="text-muted-foreground">
                        Ubah role dan hak akses
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Role Info */}
                    <Card className="lg:col-span-1 h-fit">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="h-5 w-5" />
                                Informasi Role
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nama Role *</Label>
                                <Input
                                    id="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Contoh: HR Admin"
                                    disabled={isPending || isSystem}
                                />
                                {isSystem && (
                                    <p className="text-xs text-muted-foreground">
                                        Nama role sistem tidak dapat diubah
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">Deskripsi</Label>
                                <Textarea
                                    id="description"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Deskripsi singkat role ini..."
                                    rows={4}
                                    disabled={isPending}
                                />
                            </div>
                            <div className="pt-4 flex flex-col gap-2">
                                <Button type="submit" disabled={isPending}>
                                    {isPending ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Menyimpan...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="mr-2 h-4 w-4" />
                                            Simpan Perubahan
                                        </>
                                    )}
                                </Button>
                                <Button type="button" variant="outline" asChild disabled={isPending}>
                                    <Link href="/admin/roles">Batal</Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Permissions */}
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle>Permissions</CardTitle>
                            <CardDescription>
                                Pilih hak akses untuk role ini
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-6">
                                {Object.entries(groupedPermissions).map(([module, perms]) => (
                                    <div key={module} className="space-y-3">
                                        <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                                            {module.replace(/_/g, ' ')}
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {perms.map((permission) => (
                                                <div key={permission.id} className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-muted/50">
                                                    <Checkbox
                                                        id={`perm-${permission.id}`}
                                                        checked={selectedPermissionIds.includes(permission.id)}
                                                        onCheckedChange={(checked) => handlePermissionToggle(permission.id, checked as boolean)}
                                                        disabled={isPending}
                                                    />
                                                    <label
                                                        htmlFor={`perm-${permission.id}`}
                                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer w-full"
                                                    >
                                                        {permission.name}
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </form>
        </div>
    )
}
