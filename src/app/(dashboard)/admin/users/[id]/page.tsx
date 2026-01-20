'use client'

import { useState, useTransition, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Edit, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import Link from 'next/link'
import { getUserById, updateUser } from '@/actions/users'
import { getRoles } from '@/actions/roles'

interface Role {
    id: string
    name: string
}

export default function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params)
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [isPending, startTransition] = useTransition()
    const [roles, setRoles] = useState<Role[]>([])

    // Form state
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [phoneNumber, setPhoneNumber] = useState('')
    const [password, setPassword] = useState('')
    const [isActive, setIsActive] = useState(true)
    const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([])

    useEffect(() => {
        loadData()
    }, [resolvedParams.id])

    const loadData = async () => {
        setLoading(true)
        const [userResult, rolesResult] = await Promise.all([
            getUserById(resolvedParams.id),
            getRoles()
        ])

        if (rolesResult.success && rolesResult.data) {
            setRoles(rolesResult.data as Role[])
        }

        if (userResult.success && userResult.data) {
            const user = userResult.data
            setName(user.name)
            setEmail(user.email)
            setPhoneNumber(user.phoneNumber || '')
            setIsActive(user.isActive)
            setSelectedRoleIds(user.roleIds)
        } else {
            toast.error(userResult.error || 'Pengguna tidak ditemukan')
            router.push('/admin/users')
        }
        setLoading(false)
    }

    const handleRoleToggle = (roleId: string, checked: boolean) => {
        if (checked) {
            setSelectedRoleIds([...selectedRoleIds, roleId])
        } else {
            setSelectedRoleIds(selectedRoleIds.filter(id => id !== roleId))
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!name || !email) {
            toast.error('Nama dan Email harus diisi')
            return
        }

        startTransition(async () => {
            const data: any = {
                name,
                email,
                phoneNumber,
                isActive,
                roleIds: selectedRoleIds
            }

            if (password) {
                data.password = password
            }

            const result = await updateUser(resolvedParams.id, data)

            if (result.success) {
                toast.success('Pengguna berhasil diupdate')
                router.push('/admin/users')
            } else {
                toast.error(result.error || 'Gagal mengupdate pengguna')
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
                    <Link href="/admin/users">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Edit Pengguna</h1>
                    <p className="text-muted-foreground">
                        Ubah detail dan hak akses pengguna
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <Card className="max-w-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Edit className="h-5 w-5" />
                            Informasi Pengguna
                        </CardTitle>
                        <CardDescription>
                            Kosongkan password jika tidak ingin mengubahnya
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nama Lengkap *</Label>
                                <Input
                                    id="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Nama Lengkap"
                                    disabled={isPending}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email *</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="email@example.com"
                                    disabled={isPending}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">No. HP (WhatsApp)</Label>
                                <Input
                                    id="phone"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    placeholder="08123456789"
                                    disabled={isPending}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">Password Baru</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Biarkan kosong jika tidak diubah"
                                disabled={isPending}
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <Switch
                                id="status"
                                checked={isActive}
                                onCheckedChange={setIsActive}
                                disabled={isPending}
                            />
                            <Label htmlFor="status">Akun Aktif</Label>
                        </div>

                        <div className="space-y-3">
                            <Label>Role Akses</Label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 border p-4 rounded-lg bg-muted/20">
                                {roles.map((role) => (
                                    <div key={role.id} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`role-${role.id}`}
                                            checked={selectedRoleIds.includes(role.id)}
                                            onCheckedChange={(checked) => handleRoleToggle(role.id, checked as boolean)}
                                            disabled={isPending}
                                        />
                                        <label
                                            htmlFor={`role-${role.id}`}
                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                        >
                                            {role.name}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-4 pt-4">
                            <Button type="button" variant="outline" asChild disabled={isPending}>
                                <Link href="/admin/users">Batal</Link>
                            </Button>
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
                        </div>
                    </CardContent>
                </Card>
            </form>
        </div>
    )
}
