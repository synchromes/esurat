'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import Link from 'next/link'
import { createTeam } from '@/actions/teams'

export default function CreateTeamPage() {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!name.trim()) {
            toast.error('Nama tim harus diisi')
            return
        }

        startTransition(async () => {
            const result = await createTeam({ name, description })

            if (result.success) {
                toast.success('Tim berhasil dibuat')
                router.push('/admin/teams')
            } else {
                toast.error(result.error || 'Gagal membuat tim')
            }
        })
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/admin/teams">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Buat Tim Baru</h1>
                    <p className="text-muted-foreground">
                        Tambahkan tim baru untuk mengelola anggota
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <Card className="max-w-xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Informasi Tim
                        </CardTitle>
                        <CardDescription>
                            Masukkan detail tim yang akan dibuat
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nama Tim *</Label>
                            <Input
                                id="name"
                                placeholder="Contoh: Tim Pengembangan"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                disabled={isPending}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Deskripsi</Label>
                            <Textarea
                                id="description"
                                placeholder="Deskripsi singkat tentang tim ini..."
                                rows={3}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                disabled={isPending}
                            />
                        </div>

                        <div className="flex gap-4 pt-4">
                            <Button type="button" variant="outline" asChild disabled={isPending}>
                                <Link href="/admin/teams">Batal</Link>
                            </Button>
                            <Button type="submit" disabled={isPending}>
                                {isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Menyimpan...
                                    </>
                                ) : (
                                    'Simpan Tim'
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </form>
        </div>
    )
}
