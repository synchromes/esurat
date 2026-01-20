'use client'

import { useEffect, useState, useTransition } from 'react'
import { Users, Trash2, Edit, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { getTeams, deleteTeam } from '@/actions/teams'

interface Team {
    id: string
    name: string
    description: string | null
    isActive: boolean
    _count: { members: number }
    members: Array<{
        userId: string
        role: string
        user: { id: string; name: string; email: string; avatar: string | null }
    }>
}

export function TeamsList() {
    const [teams, setTeams] = useState<Team[]>([])
    const [loading, setLoading] = useState(true)
    const [isPending, startTransition] = useTransition()

    useEffect(() => {
        loadTeams()
    }, [])

    const loadTeams = async () => {
        setLoading(true)
        const result = await getTeams()
        if (result.success && result.data) {
            setTeams(result.data as Team[])
        }
        setLoading(false)
    }

    const handleDelete = async (teamId: string, teamName: string) => {
        startTransition(async () => {
            const result = await deleteTeam(teamId)
            if (result.success) {
                toast.success(`Tim "${teamName}" berhasil dihapus`)
                loadTeams()
            } else {
                toast.error(result.error || 'Gagal menghapus tim')
            }
        })
    }

    if (loading) {
        return <div className="text-center py-8 text-muted-foreground">Memuat data...</div>
    }

    if (teams.length === 0) {
        return (
            <Card className="text-center py-12">
                <CardContent>
                    <Users className="h-12 w-12 mx-auto text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">Belum Ada Tim</h3>
                    <p className="text-muted-foreground">
                        Buat tim baru untuk mengelola anggota
                    </p>
                    <Button asChild className="mt-4">
                        <Link href="/admin/teams/create">
                            <UserPlus className="mr-2 h-4 w-4" />
                            Buat Tim
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {teams.map((team) => (
                <Card key={team.id} className="relative overflow-hidden">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold"
                                >
                                    {team.name.charAt(0).toUpperCase()}
                                </div>
                                <CardTitle className="text-lg">{team.name}</CardTitle>
                            </div>
                            <Badge variant={team.isActive ? 'default' : 'secondary'}>
                                {team.isActive ? 'Aktif' : 'Nonaktif'}
                            </Badge>
                        </div>
                        <CardDescription className="line-clamp-2">
                            {team.description || 'Tidak ada deskripsi'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Member count */}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Users className="h-4 w-4" />
                            <span>{team._count.members} anggota</span>
                        </div>

                        {/* Member avatars preview */}
                        {team.members.length > 0 && (
                            <div className="flex -space-x-2">
                                {team.members.slice(0, 5).map((member) => (
                                    <div
                                        key={member.userId}
                                        className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium border-2 border-background"
                                        title={member.user.name}
                                    >
                                        {member.user.name.charAt(0).toUpperCase()}
                                    </div>
                                ))}
                                {team._count.members > 5 && (
                                    <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-medium border-2 border-background">
                                        +{team._count.members - 5}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                            <Button variant="outline" size="sm" asChild className="flex-1">
                                <Link href={`/admin/teams/${team.id}`}>
                                    <Edit className="h-4 w-4 mr-1" />
                                    Detail
                                </Link>
                            </Button>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm" disabled={isPending}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Hapus Tim</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Apakah Anda yakin ingin menghapus tim &quot;{team.name}&quot;?
                                            Semua anggota akan dikeluarkan dari tim ini.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Batal</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={() => handleDelete(team.id, team.name)}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                            Hapus
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
