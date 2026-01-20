'use client'

import { useEffect, useState, useTransition, use } from 'react'
import { useRouter } from 'next/navigation'
import {
    ArrowLeft,
    Loader2,
    Users,
    UserPlus,
    Trash2,
    Edit,
    Save,
    Crown
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import Link from 'next/link'
import {
    getTeamById,
    updateTeam,
    addTeamMember,
    removeTeamMember,
    updateTeamMemberRole,
    getUsersNotInTeam
} from '@/actions/teams'

interface TeamMember {
    userId: string
    role: string
    user: { id: string; name: string; email: string; avatar: string | null; isActive: boolean }
}

interface Team {
    id: string
    name: string
    description: string | null
    isActive: boolean
    members: TeamMember[]
}

interface AvailableUser {
    id: string
    name: string
    email: string
}

export default function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params)
    const router = useRouter()
    const [team, setTeam] = useState<Team | null>(null)
    const [loading, setLoading] = useState(true)
    const [isPending, startTransition] = useTransition()
    const [isEditing, setIsEditing] = useState(false)
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [addDialogOpen, setAddDialogOpen] = useState(false)
    const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([])
    const [selectedUserId, setSelectedUserId] = useState('')
    const [selectedRole, setSelectedRole] = useState('MEMBER')

    useEffect(() => {
        loadTeam()
    }, [resolvedParams.id])

    const loadTeam = async () => {
        setLoading(true)
        const result = await getTeamById(resolvedParams.id)
        if (result.success && result.data) {
            const teamData = result.data as Team
            setTeam(teamData)
            setName(teamData.name)
            setDescription(teamData.description || '')
        } else {
            toast.error(result.error || 'Tim tidak ditemukan')
            router.push('/admin/teams')
        }
        setLoading(false)
    }

    const loadAvailableUsers = async () => {
        const result = await getUsersNotInTeam(resolvedParams.id)
        if (result.success && result.data) {
            setAvailableUsers(result.data)
        }
    }

    const handleSave = async () => {
        startTransition(async () => {
            const result = await updateTeam(resolvedParams.id, { name, description })
            if (result.success) {
                toast.success('Tim berhasil diupdate')
                setIsEditing(false)
                loadTeam()
            } else {
                toast.error(result.error || 'Gagal mengupdate tim')
            }
        })
    }

    const handleAddMember = async () => {
        if (!selectedUserId) {
            toast.error('Pilih pengguna')
            return
        }

        startTransition(async () => {
            const result = await addTeamMember(resolvedParams.id, selectedUserId, selectedRole)
            if (result.success) {
                toast.success('Anggota berhasil ditambahkan')
                setAddDialogOpen(false)
                setSelectedUserId('')
                setSelectedRole('MEMBER')
                loadTeam()
            } else {
                toast.error(result.error || 'Gagal menambahkan anggota')
            }
        })
    }

    const handleRemoveMember = async (userId: string, userName: string) => {
        startTransition(async () => {
            const result = await removeTeamMember(resolvedParams.id, userId)
            if (result.success) {
                toast.success(`${userName} berhasil dihapus dari tim`)
                loadTeam()
            } else {
                toast.error(result.error || 'Gagal menghapus anggota')
            }
        })
    }

    const handleRoleChange = async (userId: string, newRole: string) => {
        startTransition(async () => {
            const result = await updateTeamMemberRole(resolvedParams.id, userId, newRole)
            if (result.success) {
                toast.success('Role berhasil diupdate')
                loadTeam()
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

    if (!team) return null

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/admin/teams">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div className="flex-1">
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <div
                            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold"
                        >
                            {team.name.charAt(0).toUpperCase()}
                        </div>
                        {team.name}
                    </h1>
                    <p className="text-muted-foreground">
                        {team.members.length} anggota
                    </p>
                </div>
                <Button
                    variant={isEditing ? 'default' : 'outline'}
                    onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                    disabled={isPending}
                >
                    {isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isEditing ? (
                        <>
                            <Save className="h-4 w-4 mr-2" />
                            Simpan
                        </>
                    ) : (
                        <>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                        </>
                    )}
                </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Team Info */}
                <Card>
                    <CardHeader>
                        <CardTitle>Informasi Tim</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {isEditing ? (
                            <>
                                <div className="space-y-2">
                                    <Label>Nama Tim</Label>
                                    <Input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        disabled={isPending}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Deskripsi</Label>
                                    <Textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        rows={3}
                                        disabled={isPending}
                                    />
                                </div>
                                <Button variant="ghost" onClick={() => setIsEditing(false)} disabled={isPending}>
                                    Batal
                                </Button>
                            </>
                        ) : (
                            <>
                                <div>
                                    <Label className="text-muted-foreground text-xs">Nama</Label>
                                    <p className="font-medium">{team.name}</p>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground text-xs">Deskripsi</Label>
                                    <p>{team.description || 'Tidak ada deskripsi'}</p>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground text-xs">Status</Label>
                                    <div className="mt-1">
                                        <Badge variant={team.isActive ? 'default' : 'secondary'}>
                                            {team.isActive ? 'Aktif' : 'Nonaktif'}
                                        </Badge>
                                    </div>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* Members */}
                <Card className="lg:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5" />
                                Anggota Tim
                            </CardTitle>
                            <CardDescription>
                                Kelola anggota dalam tim ini
                            </CardDescription>
                        </div>
                        <Dialog open={addDialogOpen} onOpenChange={(open) => {
                            setAddDialogOpen(open)
                            if (open) loadAvailableUsers()
                        }}>
                            <DialogTrigger asChild>
                                <Button size="sm">
                                    <UserPlus className="h-4 w-4 mr-2" />
                                    Tambah
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Tambah Anggota</DialogTitle>
                                    <DialogDescription>
                                        Pilih pengguna untuk ditambahkan ke tim
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label>Pengguna</Label>
                                        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Pilih pengguna" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableUsers.map((user) => (
                                                    <SelectItem key={user.id} value={user.id}>
                                                        {user.name} ({user.email})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Role</Label>
                                        <Select value={selectedRole} onValueChange={setSelectedRole}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="LEADER">Ketua Tim</SelectItem>
                                                <SelectItem value="MEMBER">Anggota</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                                        Batal
                                    </Button>
                                    <Button onClick={handleAddMember} disabled={isPending || !selectedUserId}>
                                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tambah'}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </CardHeader>
                    <CardContent>
                        {team.members.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <Users className="h-12 w-12 mx-auto mb-2" />
                                <p>Belum ada anggota</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {team.members.map((member) => (
                                    <div
                                        key={member.userId}
                                        className="flex items-center justify-between p-3 rounded-lg border"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-medium">
                                                {member.user.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">{member.user.name}</span>
                                                    {member.role === 'LEADER' && (
                                                        <Crown className="h-4 w-4 text-yellow-500" />
                                                    )}
                                                    {!member.user.isActive && (
                                                        <Badge variant="secondary" className="text-xs">
                                                            Nonaktif
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    {member.user.email}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Select
                                                value={member.role}
                                                onValueChange={(val) => handleRoleChange(member.userId, val)}
                                                disabled={isPending}
                                            >
                                                <SelectTrigger className="w-32 h-8">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="LEADER">Ketua Tim</SelectItem>
                                                    <SelectItem value="MEMBER">Anggota</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" disabled={isPending}>
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Hapus Anggota</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Apakah Anda yakin ingin menghapus {member.user.name} dari tim?
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Batal</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            onClick={() => handleRemoveMember(member.userId, member.user.name)}
                                                            className="bg-destructive text-destructive-foreground"
                                                        >
                                                            Hapus
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
