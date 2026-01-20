'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import {
    Inbox,
    Send,
    CheckCircle2,
    Clock,
    Eye,
    AlertCircle,
    FileText,
    Loader2
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { markDispositionAsRead, markDispositionAsCompleted } from '@/actions/dispositions'

type DispositionRecipient = {
    id: string
    status: string
    readAt: Date | null
    completedAt: Date | null
    response: string | null
    user?: { id: string; name: string }
}

type DispositionInstruction = {
    instruction: { id: string; name: string }
}

type Disposition = {
    id: string
    number: string | null
    urgency: string
    notes: string | null
    createdAt: Date
    letter: {
        id: string
        title: string
        letterNumber: string | null
    }
    fromUser: { id: string; name: string }
    recipients: DispositionRecipient[]
    instructions: DispositionInstruction[]
}

interface DispositionsClientProps {
    receivedDispositions: Disposition[]
    sentDispositions: Disposition[]
    pendingNumberDispositions: Disposition[]
    stats: {
        pending: number
        read: number
        completed: number
        total: number
    }
    canCreate: boolean
    canSetNumber: boolean
    canViewAll?: boolean
    allDispositions?: Disposition[]
}

const urgencyConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    BIASA: { label: 'Biasa', variant: 'secondary' },
    SEGERA: { label: 'Segera', variant: 'default' },
    PENTING: { label: 'Penting', variant: 'destructive' },
    RAHASIA: { label: 'Rahasia', variant: 'outline' }
}

const statusConfig: Record<string, { label: string; icon: typeof Clock }> = {
    PENDING: { label: 'Belum Dibaca', icon: Clock },
    READ: { label: 'Sudah Dibaca', icon: Eye },
    COMPLETED: { label: 'Selesai', icon: CheckCircle2 }
}

export function DispositionsClient({
    receivedDispositions,
    sentDispositions,
    pendingNumberDispositions,
    stats,
    canCreate,
    canSetNumber,
    canViewAll,
    allDispositions = []
}: DispositionsClientProps) {
    const [isPending, startTransition] = useTransition()
    const [selectedDisposition, setSelectedDisposition] = useState<Disposition | null>(null)
    const [showCompleteDialog, setShowCompleteDialog] = useState(false)
    const [response, setResponse] = useState('')

    const handleMarkAsRead = (disposition: Disposition) => {
        startTransition(async () => {
            const result = await markDispositionAsRead(disposition.id)
            if (result.success) {
                toast.success('Disposisi ditandai sebagai dibaca')
            } else {
                toast.error(result.error)
            }
        })
    }

    const handleMarkAsCompleted = () => {
        if (!selectedDisposition) return

        startTransition(async () => {
            const result = await markDispositionAsCompleted(selectedDisposition.id, response)
            if (result.success) {
                toast.success('Disposisi ditandai sebagai selesai')
                setShowCompleteDialog(false)
                setResponse('')
                setSelectedDisposition(null)
            } else {
                toast.error(result.error)
            }
        })
    }

    const getMyRecipientStatus = (disposition: Disposition): DispositionRecipient | undefined => {
        // Find the recipient record for the current context (first one for received)
        return disposition.recipients[0]
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Disposisi</h1>
                <p className="text-muted-foreground">
                    Kelola disposisi surat masuk dan keluar
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs sm:text-sm font-medium">Total</CardTitle>
                        <Inbox className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs sm:text-sm font-medium">Belum Dibaca</CardTitle>
                        <Clock className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-500">{stats.pending}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs sm:text-sm font-medium">Sudah Dibaca</CardTitle>
                        <Eye className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-500">{stats.read}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs sm:text-sm font-medium">Selesai</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-500">{stats.completed}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="received" className="space-y-4">
                <div className="w-full overflow-x-auto pb-2">
                    <TabsList className="w-full justify-start h-auto p-1">
                        {canViewAll && (
                            <TabsTrigger value="all" className="gap-2 flex-shrink-0">
                                <FileText className="h-4 w-4" />
                                Semua
                            </TabsTrigger>
                        )}
                        <TabsTrigger value="received" className="gap-2 flex-shrink-0">
                            <Inbox className="h-4 w-4" />
                            Diterima
                            {stats.pending > 0 && (
                                <Badge variant="destructive" className="ml-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center">
                                    {stats.pending}
                                </Badge>
                            )}
                        </TabsTrigger>
                        {canCreate && (
                            <TabsTrigger value="sent" className="gap-2 flex-shrink-0">
                                <Send className="h-4 w-4" />
                                Dikirim
                            </TabsTrigger>
                        )}
                        {canSetNumber && (
                            <TabsTrigger value="pending" className="gap-2 flex-shrink-0">
                                <Clock className="h-4 w-4" />
                                Penomoran
                                {pendingNumberDispositions.length > 0 && (
                                    <Badge variant="destructive" className="ml-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center">
                                        {pendingNumberDispositions.length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                        )}
                    </TabsList>
                </div>

                {/* Received Dispositions */}
                <TabsContent value="received">
                    <Card>
                        <CardHeader>
                            <CardTitle>Disposisi Diterima</CardTitle>
                            <CardDescription>
                                Daftar disposisi yang ditujukan kepada Anda
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {receivedDispositions.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <Inbox className="h-12 w-12 text-muted-foreground" />
                                    <p className="mt-2 text-muted-foreground">Belum ada disposisi</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>No. Disposisi</TableHead>
                                            <TableHead>Surat</TableHead>
                                            <TableHead>Dari</TableHead>
                                            <TableHead>Sifat</TableHead>
                                            <TableHead>Instruksi</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Tanggal</TableHead>
                                            <TableHead className="text-right">Aksi</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {receivedDispositions.map((disposition) => {
                                            const myStatus = getMyRecipientStatus(disposition)
                                            const status = myStatus?.status || 'PENDING'
                                            const StatusIcon = statusConfig[status]?.icon || Clock

                                            return (
                                                <TableRow key={disposition.id}>
                                                    <TableCell className="font-medium">
                                                        {disposition.number}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Link
                                                            href={`/letters/${disposition.letter.id}`}
                                                            className="hover:underline flex items-center gap-1"
                                                        >
                                                            <FileText className="h-3 w-3" />
                                                            {disposition.letter.title}
                                                        </Link>
                                                    </TableCell>
                                                    <TableCell>{disposition.fromUser.name}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={urgencyConfig[disposition.urgency]?.variant}>
                                                            {urgencyConfig[disposition.urgency]?.label}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="max-w-[200px]">
                                                        <div className="text-xs text-muted-foreground truncate">
                                                            {disposition.instructions.map(i => i.instruction.name).join(', ')}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-1">
                                                            <StatusIcon className="h-3 w-3" />
                                                            <span className="text-xs">{statusConfig[status]?.label}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        {format(new Date(disposition.createdAt), 'dd MMM yyyy', { locale: id })}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            {status === 'PENDING' && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => handleMarkAsRead(disposition)}
                                                                    disabled={isPending}
                                                                >
                                                                    <Eye className="h-3 w-3 mr-1" />
                                                                    Baca
                                                                </Button>
                                                            )}
                                                            {(status === 'PENDING' || status === 'READ') && (
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        setSelectedDisposition(disposition)
                                                                        setShowCompleteDialog(true)
                                                                    }}
                                                                    disabled={isPending}
                                                                >
                                                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                                                    Selesai
                                                                </Button>
                                                            )}
                                                            <Button size="sm" variant="ghost" asChild>
                                                                <Link href={`/dispositions/${disposition.id}`}>
                                                                    Detail
                                                                </Link>
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>


                {canCreate && (
                    <TabsContent value="sent">
                        <Card>
                            <CardHeader>
                                <CardTitle>Disposisi Dikirim</CardTitle>
                                <CardDescription>
                                    Daftar disposisi yang Anda buat
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {sentDispositions.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <Send className="h-12 w-12 text-muted-foreground" />
                                        <p className="mt-2 text-muted-foreground">Belum ada disposisi dikirim</p>
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>No. Disposisi</TableHead>
                                                <TableHead>Surat</TableHead>
                                                <TableHead>Penerima</TableHead>
                                                <TableHead>Sifat</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Tanggal</TableHead>
                                                <TableHead className="text-right">Aksi</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {sentDispositions.map((disposition) => {
                                                const completedCount = disposition.recipients.filter(r => r.status === 'COMPLETED').length
                                                const totalRecipients = disposition.recipients.length

                                                return (
                                                    <TableRow key={disposition.id}>
                                                        <TableCell className="font-medium">
                                                            {disposition.number || '-'}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Link
                                                                href={`/letters/${disposition.letter.id}`}
                                                                className="hover:underline flex items-center gap-1"
                                                            >
                                                                <FileText className="h-3 w-3" />
                                                                {disposition.letter.title}
                                                            </Link>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="text-sm">
                                                                {disposition.recipients.map(r => r.user?.name).join(', ')}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant={urgencyConfig[disposition.urgency]?.variant}>
                                                                {urgencyConfig[disposition.urgency]?.label}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <span className="text-sm">
                                                                {completedCount}/{totalRecipients} selesai
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-sm text-muted-foreground">
                                                            {format(new Date(disposition.createdAt), 'dd MMM yyyy', { locale: id })}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button size="sm" variant="ghost" asChild>
                                                                <Link href={`/dispositions/${disposition.id}`}>
                                                                    Detail
                                                                </Link>
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}

                {/* Pending Number Dispositions */}
                {canSetNumber && (
                    <TabsContent value="pending">
                        <Card>
                            <CardHeader>
                                <CardTitle>Perlu Penomoran</CardTitle>
                                <CardDescription>
                                    Daftar disposisi yang perlu diberi nomor
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {pendingNumberDispositions.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <Clock className="h-12 w-12 text-muted-foreground" />
                                        <p className="mt-2 text-muted-foreground">Tidak ada disposisi yang perlu penomoran</p>
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Surat</TableHead>
                                                <TableHead>Dari</TableHead>
                                                <TableHead>Sifat</TableHead>
                                                <TableHead>Instruksi</TableHead>
                                                <TableHead>Tanggal</TableHead>
                                                <TableHead className="text-right">Aksi</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {pendingNumberDispositions.map((disposition) => (
                                                <TableRow key={disposition.id}>
                                                    <TableCell>
                                                        <Link
                                                            href={`/letters/${disposition.letter.id}`}
                                                            className="hover:underline flex items-center gap-1"
                                                        >
                                                            <FileText className="h-3 w-3" />
                                                            {disposition.letter.title}
                                                        </Link>
                                                    </TableCell>
                                                    <TableCell>{disposition.fromUser.name}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={urgencyConfig[disposition.urgency]?.variant}>
                                                            {urgencyConfig[disposition.urgency]?.label}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="max-w-[200px]">
                                                        <div className="text-xs text-muted-foreground truncate">
                                                            {disposition.instructions.map(i => i.instruction.name).join(', ')}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        {format(new Date(disposition.createdAt), 'dd MMM yyyy', { locale: id })}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button size="sm" asChild>
                                                            <Link href={`/dispositions/${disposition.id}`}>
                                                                Isi Nomor
                                                            </Link>
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}
                {/* All Dispositions */}
                {canViewAll && (
                    <TabsContent value="all">
                        <Card>
                            <CardHeader>
                                <CardTitle>Semua Disposisi</CardTitle>
                                <CardDescription>
                                    Daftar seluruh disposisi dalam sistem
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {allDispositions.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <Inbox className="h-12 w-12 text-muted-foreground" />
                                        <p className="mt-2 text-muted-foreground">Belum ada data disposisi</p>
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>No. Disposisi</TableHead>
                                                <TableHead>Surat</TableHead>
                                                <TableHead>Dari</TableHead>
                                                <TableHead>Kepada</TableHead>
                                                <TableHead>Sifat</TableHead>
                                                <TableHead>Tanggal</TableHead>
                                                <TableHead className="text-right">Aksi</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {allDispositions.map((disposition) => (
                                                <TableRow key={disposition.id}>
                                                    <TableCell className="font-medium">
                                                        {disposition.number || '-'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Link
                                                            href={`/letters/${disposition.letter.id}`}
                                                            className="hover:underline flex items-center gap-1"
                                                        >
                                                            <FileText className="h-3 w-3" />
                                                            {disposition.letter.title}
                                                        </Link>
                                                    </TableCell>
                                                    <TableCell>{disposition.fromUser.name}</TableCell>
                                                    <TableCell>
                                                        <div className="text-sm max-w-[200px] truncate">
                                                            {disposition.recipients.map(r => r.user?.name).join(', ')}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={urgencyConfig[disposition.urgency]?.variant}>
                                                            {urgencyConfig[disposition.urgency]?.label}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        {format(new Date(disposition.createdAt), 'dd MMM yyyy', { locale: id })}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button size="sm" variant="ghost" asChild>
                                                            <Link href={`/dispositions/${disposition.id}`}>
                                                                Detail
                                                            </Link>
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}
            </Tabs>

            {/* Complete Dialog */}
            <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Selesaikan Disposisi</DialogTitle>
                        <DialogDescription>
                            Tandai disposisi ini sebagai selesai. Anda dapat menambahkan catatan/tanggapan.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">Catatan/Tanggapan (opsional)</label>
                            <Textarea
                                value={response}
                                onChange={(e) => setResponse(e.target.value)}
                                placeholder="Tuliskan tanggapan Anda..."
                                rows={4}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>
                            Batal
                        </Button>
                        <Button onClick={handleMarkAsCompleted} disabled={isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Selesaikan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    )
}
