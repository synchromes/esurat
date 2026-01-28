'use client'

import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import {
    ArrowLeft,
    Printer,
    CheckCircle2,
    Clock,
    Eye
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { DispositionSheet } from '@/components/disposition/DispositionSheet'
import { Separator } from '@/components/ui/separator'
import { useSession } from 'next-auth/react'
import { useState } from 'react'
import { uploadSignedDisposition } from '@/actions/dispositions'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Upload, Download } from 'lucide-react'

interface DispositionDetailClientProps {
    disposition: any
    canSetNumber?: boolean
}

import { setDispositionNumber } from '@/actions/dispositions'

const urgencyConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    BIASA: { label: 'Biasa', variant: 'secondary' },
    SEGERA: { label: 'Segera', variant: 'default' },
    PENTING: { label: 'Penting', variant: 'destructive' },
    RAHASIA: { label: 'Rahasia', variant: 'outline' }
}

export function DispositionDetailClient({ disposition, canSetNumber }: DispositionDetailClientProps) {
    const { data: session } = useSession()
    const [isUploading, setIsUploading] = useState(false)
    const isCreator = session?.user?.id === disposition.fromUserId
    const isPendingSign = disposition.status === 'PENDING_SIGN'
    const isSubmitted = disposition.status === 'SUBMITTED'

    const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        const file = formData.get('file') as File

        if (!file || file.size === 0) {
            toast.error('Pilih file terlebih dahulu')
            return
        }

        setIsUploading(true)
        try {
            const result = await uploadSignedDisposition(disposition.id, formData)
            if (result.success) {
                toast.success('Disposisi berhasil diupload dan dikirim')
                // Router refresh usually handled by revalidatePath but let's refresh to act fast
                // router.refresh() // Need useRouter
            } else {
                toast.error(result.error || 'Gagal upload')
            }
        } catch (error) {
            toast.error('Terjadi kesalahan')
        } finally {
            setIsUploading(false)
        }
    }

    const handlePrint = () => {
        // Open print window
        const printWindow = window.open(`/print/dispositions/${disposition.id}`, '_blank')
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/dispositions">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Detail Disposisi</h1>
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <span>{disposition.number}</span>
                        <span>•</span>
                        <span>{format(new Date(disposition.createdAt), 'dd MMMM yyyy, HH:mm', { locale: id })}</span>
                    </div>
                </div>
                <div className="ml-auto flex gap-2">
                    {/* Actions based on status */}
                    {isSubmitted && disposition.fileSigned && (
                        <Button variant="outline" asChild>
                            <a href={disposition.fileSigned} target="_blank" rel="noopener noreferrer">
                                <Download className="mr-2 h-4 w-4" />
                                Download Disposisi
                            </a>
                        </Button>
                    )}

                    {/* <Button variant="outline" onClick={handlePrint}>
                        <Printer className="mr-2 h-4 w-4" />
                        Cetak Lembar Disposisi
                    </Button> */}
                    <Button asChild>
                        <Link href={`/letters/${disposition.letter.id}`}>
                            Lihat Surat
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Workflow Action Area for Number Assignment (TU Staff) */}
            {disposition.status === 'PENDING_NUMBER' && canSetNumber && (
                <Alert className="bg-blue-50 border-blue-200">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <AlertTitle className="text-blue-800">Menunggu Penomoran Disposisi</AlertTitle>
                    <AlertDescription className="text-blue-700">
                        <div className="mt-2 space-y-4">
                            <p>Disposisi ini membutuhkan nomor sebelum dapat diproses lebih lanjut.</p>
                            <form action={async (formData) => {
                                const number = formData.get('number') as string
                                if (!number) {
                                    toast.error('Nomor harus diisi')
                                    return
                                }

                                await toast.promise(setDispositionNumber(disposition.id, number), {
                                    loading: 'Menyimpan nomor...',
                                    success: 'Nomor berhasil disimpan',
                                    error: 'Gagal menyimpan nomor'
                                })
                            }} className="flex gap-2 max-w-sm items-end">
                                <div className="space-y-2 w-full">
                                    <Label>Nomor Disposisi</Label>
                                    <Input
                                        name="number"
                                        type="number"
                                        placeholder="Masukkan nomor disposisi (Angka)"
                                        required
                                        className="bg-white"
                                        pattern="[0-9]*"
                                        onKeyPress={(event) => {
                                            if (!/[0-9]/.test(event.key)) {
                                                event.preventDefault();
                                            }
                                        }}
                                    />
                                </div>
                                <Button type="submit">Simpan</Button>
                            </form>
                        </div>
                    </AlertDescription>
                </Alert>
            )}

            {/* Workflow Alert for Creator (Pending Number) */}
            {disposition.status === 'PENDING_NUMBER' && !canSetNumber && (
                <Alert className="bg-gray-50 border-gray-200">
                    <Clock className="h-4 w-4 text-gray-600" />
                    <AlertTitle className="text-gray-800">Menunggu Penomoran</AlertTitle>
                    <AlertDescription className="text-gray-600">
                        Disposisi telah dibuat dan sedang menunggu petugas Tata Usaha untuk melengkapi Nomor Disposisi. Notifikasi akan dikirim setelah nomor diisi.
                    </AlertDescription>
                </Alert>
            )}

            {/* Workflow Action Area for Creator (Pending Sign) */}
            {isCreator && isPendingSign && (
                <Alert className="bg-yellow-50 border-yellow-200">
                    <Clock className="h-4 w-4 text-yellow-600" />
                    <AlertTitle className="text-yellow-800">Menunggu Tanda Tangan Digital</AlertTitle>
                    <AlertDescription className="text-yellow-700">
                        <div className="mt-2 space-y-4">
                            <p>Disposisi ini belum ditandatangani. Silakan download konsep, tanda tangani via BSrE, dan upload kembali.</p>

                            <div className="flex gap-4 items-start">
                                <div className="space-y-2">
                                    <Label>1. Download Konsep (PDF)</Label>
                                    <Button variant="outline" className="w-full" asChild>
                                        <a href={disposition.fileDraft ? disposition.fileDraft : `/print/dispositions/${disposition.id}?mode=pdf`} target="_blank">
                                            <Download className="mr-2 h-4 w-4" />
                                            Download Konsep
                                        </a>
                                    </Button>
                                </div>
                                <div className="space-y-2 flex-1 max-w-sm">
                                    <Label>2. Upload File Signed (PDF)</Label>
                                    <form onSubmit={handleUpload} className="flex gap-2">
                                        <Input type="file" name="file" accept=".pdf" required className="bg-white" />
                                        <Button type="submit" disabled={isUploading}>
                                            {isUploading ? 'Uploading...' : 'Upload & Kirim'}
                                        </Button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid gap-6 md:grid-cols-3">
                <div className="md:col-span-2 space-y-6">
                    {/* Live Preview of the Sheet */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Preview Lembar Disposisi</CardTitle>
                        </CardHeader>
                        <CardContent className="bg-gray-50 p-6 overflow-x-auto">
                            <div className="transform scale-90 origin-top-left">
                                <DispositionSheet disposition={disposition} />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Status Penerima</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {disposition.recipients.map((recipient: any) => (
                                <div key={recipient.id} className="flex items-start justify-between border-b pb-4 last:border-0 last:pb-0">
                                    <div className="space-y-1">
                                        <p className="font-medium text-sm">{recipient.user.name}</p>
                                        <div className="flex items-center gap-2">
                                            {recipient.status === 'PENDING' && (
                                                <Badge variant="secondary" className="flex gap-1">
                                                    <Clock className="h-3 w-3" /> Belum Dibaca
                                                </Badge>
                                            )}
                                            {recipient.status === 'READ' && (
                                                <Badge variant="default" className="flex gap-1 bg-blue-500">
                                                    <Eye className="h-3 w-3" /> Dibaca
                                                </Badge>
                                            )}
                                            {recipient.status === 'COMPLETED' && (
                                                <Badge variant="default" className="flex gap-1 bg-green-500">
                                                    <CheckCircle2 className="h-3 w-3" /> Selesai
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                    {recipient.status === 'COMPLETED' && (
                                        <div className="text-right">
                                            <p className="text-xs text-muted-foreground">
                                                {format(new Date(recipient.completedAt), 'dd/MM/yy HH:mm')}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Detail</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div>
                                <p className="text-muted-foreground mb-1">Dari</p>
                                <p className="font-medium">{disposition.fromUser.name}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground mb-1">Sifat</p>
                                <Badge variant={urgencyConfig[disposition.urgency]?.variant}>
                                    {urgencyConfig[disposition.urgency]?.label}
                                </Badge>
                            </div>
                            <div>
                                <p className="text-muted-foreground mb-1">Instruksi</p>
                                <ul className="list-disc list-inside space-y-1">
                                    {disposition.instructions.map((i: any) => (
                                        <li key={i.instructionId}>{i.instruction.name}</li>
                                    ))}
                                </ul>
                            </div>
                            {disposition.notes && (
                                <div>
                                    <p className="text-muted-foreground mb-1">Catatan</p>
                                    <p className="whitespace-pre-wrap">{disposition.notes}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
