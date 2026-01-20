'use client'

import { useState, useRef } from 'react'
import { QuickAccessAuth } from './QuickAccessAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, CheckCircle2, AlertTriangle, Download, XCircle } from 'lucide-react'
import SignatureCanvas from 'react-signature-canvas'
import { approveWithToken, rejectWithToken } from '@/actions/quick-actions' // Ensure this exists
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface QuickApproveWrapperProps {
    token: string
}

export function QuickApproveWrapper({ token }: QuickApproveWrapperProps) {
    const [verifiedData, setVerifiedData] = useState<any>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const [rejectReason, setRejectReason] = useState('')
    const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false)
    const sigPad = useRef<any>(null)
    const router = useRouter()

    if (!verifiedData) {
        return <QuickAccessAuth token={token} onVerified={setVerifiedData} />
    }

    if (isSuccess) {
        return (
            <div className="p-8 text-center space-y-4">
                <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-green-700">Berhasil Disetujui!</h2>
                <p className="text-gray-600">Terima kasih, surat telah berhasil diparaf dan diteruskan ke penanda tangan.</p>
            </div>
        )
    }

    const { letter } = verifiedData

    const handleClear = () => {
        sigPad.current?.clear()
    }

    const handleApprove = async () => {
        if (sigPad.current?.isEmpty()) {
            toast.error('Harap bubuhkan paraf anda')
            return
        }

        setIsSubmitting(true)
        try {
            const signatureData = sigPad.current.getTrimmedCanvas().toDataURL('image/png')
            const result = await approveWithToken(token, signatureData)

            if (result.success) {
                toast.success('Surat berhasil disetujui')
                setIsSuccess(true)
            } else {
                toast.error(result.error || 'Gagal menyetujui surat')
            }
        } catch (error) {
            toast.error('Terjadi kesalahan')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleReject = async () => {
        if (!rejectReason || rejectReason.trim().length === 0) {
            toast.error('Alasan penolakan harus diisi')
            return
        }

        setIsSubmitting(true)
        try {
            const result = await rejectWithToken(token, rejectReason)

            if (result.success) {
                toast.success('Surat berhasil ditolak')
                setIsRejectDialogOpen(false)
                // Redirect or show rejection state? 
                // Showing success state but maybe different message
                setIsSuccess(true) // Reusing success state for simplicity or customized below
            } else {
                toast.error(result.error || 'Gagal menolak surat')
            }
        } catch (error) {
            toast.error('Terjadi kesalahan')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="space-y-6 p-4">
            <div className="text-center space-y-2">
                <Badge variant="outline" className="mb-2">Permintaan Persetujuan</Badge>
                <h3 className="font-semibold text-lg leading-tight">{letter.title}</h3>
                <p className="text-sm text-muted-foreground">{letter.letterNumber || 'Nomor belum digenerate'}</p>
            </div>

            <div className="flex flex-col gap-3">
                <Button variant="outline" className="w-full justify-start h-auto py-3" onClick={() => window.open(letter.fileDraft, '_blank')}>
                    <FileText className="mr-2 h-5 w-5 text-blue-500" />
                    <div className="text-left">
                        <div className="font-medium">Lihat Draft Surat</div>
                        <div className="text-xs text-muted-foreground">Klik untuk membuka PDF</div>
                    </div>
                </Button>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Bubuhkan Paraf</CardTitle>
                    <CardDescription>Paraf digital Anda akan ditempel pada surat.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md bg-white touch-none">
                        <SignatureCanvas
                            ref={sigPad}
                            penColor="black"
                            canvasProps={{
                                className: 'w-full h-40 rounded-md',
                                style: { width: '100%', height: '160px' }
                            }}
                        />
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleClear} className="mt-2 text-xs text-muted-foreground">
                        Hapus / Ulangi
                    </Button>
                </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
                <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="destructive" className="w-full h-12 text-lg font-medium" disabled={isSubmitting}>
                            <XCircle className="w-5 h-5 mr-2" />
                            Tolak
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Tolak Surat</DialogTitle>
                            <DialogDescription>
                                Masukkan alasan penolakan surat ini. Pembuat surat akan menerima notifikasi.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-2 py-4">
                            <Label htmlFor="reason">Alasan Penolakan</Label>
                            <Textarea
                                id="reason"
                                placeholder="Contoh: Format tidak sesuai, data kurang lengkap..."
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                            />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>Batal</Button>
                            <Button variant="destructive" onClick={handleReject} disabled={isSubmitting}>
                                {isSubmitting ? 'Memproses...' : 'Tolak Surat'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Button className="w-full h-12 text-lg font-medium" onClick={handleApprove} disabled={isSubmitting}>
                    {isSubmitting ? 'Memproses...' : 'Setujui & Paraf'}
                </Button>
            </div>
        </div>
    )
}
