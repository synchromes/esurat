'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    ArrowLeft,
    FileText,
    Clock,
    CheckCircle2,
    XCircle,
    PenTool,
    Download,
    Upload,
    Send,
    Trash2,
    Eye,
    AlertCircle,
    History,
    Loader2,
    QrCode,
    Eraser,
    RotateCw,
    FileType
} from 'lucide-react'
import { cn } from '@/lib/utils' // Import cn utility
import SignatureCanvas from 'react-signature-canvas'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
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
import {
    submitForApproval,
    approveLetter,
    rejectLetter,
    uploadSignedLetter,
    deleteLetter
} from '@/actions/letters'
import dynamic from 'next/dynamic'

const PreviewPDF = dynamic(() => import('@/components/letter/PreviewPDF').then(mod => mod.PreviewPDF), {
    ssr: false,
    loading: () => <p>Loading PDF Viewer...</p>
})

import { useSession } from 'next-auth/react'
import { PERMISSIONS } from '@/lib/permissions'
import { CreateDispositionDialog } from '@/components/disposition/CreateDispositionDialog'

type LetterData = {
    id: string
    title: string
    description: string | null
    letterNumber: string | null
    status: string
    priority: string
    securityLevel: string
    fileDraft: string
    fileStamped: string | null
    fileFinal: string | null
    qrHash: string
    qrPage: number
    qrXPercent: number | null
    qrYPercent: number | null
    qrSize: number | null
    parafPage: number | null
    parafXPercent: number | null
    parafYPercent: number | null
    parafSize: number | null
    rejectionReason: string | null
    createdAt: Date
    submittedAt: Date | null
    approvedAt: Date | null
    signedAt: Date | null
    creator: { id: string; name: string; email: string }
    approver: { id: string; name: string } | null
    signer: { id: string; name: string } | null
    assignedApproverId: string | null
    assignedSignerId: string | null
    category: { id: string; name: string; color: string; code: string } | null
    letterApprovers: {
        id: string
        order: number
        status: string
        approvedAt: Date | null
        user: { id: string; name: string; email: string }
    }[]
    dispositions: {
        id: string
        status: string
        createdAt: Date
        urgency: string
        number: string | null
        fromUser: { name: string }
    }[]
    logs: {
        id: string
        action: string
        description: string
        createdAt: Date
        user: { id: string; name: string }
    }[]
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ComponentType<{ className?: string }> }> = {
    DRAFT: { label: 'Draft', variant: 'secondary', icon: FileText },
    PENDING_APPROVAL: { label: 'Menunggu Persetujuan', variant: 'default', icon: Clock },
    APPROVED: { label: 'Disetujui', variant: 'outline', icon: CheckCircle2 },
    PENDING_SIGN: { label: 'Menunggu TTD', variant: 'default', icon: PenTool },
    SIGNED: { label: 'Selesai', variant: 'outline', icon: CheckCircle2 },
    REJECTED: { label: 'Ditolak', variant: 'destructive', icon: XCircle },
    CANCELLED: { label: 'Dibatalkan', variant: 'secondary', icon: XCircle }
}

const priorityConfig: Record<string, { label: string; color: string }> = {
    LOW: { label: 'Biasa', color: 'text-gray-500' },
    NORMAL: { label: 'Segera', color: 'text-blue-500' },
    HIGH: { label: 'Sangat Segera', color: 'text-orange-500' },
    URGENT: { label: 'Urgent', color: 'text-red-500' }
}

const securityConfig: Record<string, { label: string; badge: string }> = {
    BIASA: { label: 'Biasa (B)', badge: 'bg-green-100 text-green-800 border-green-200' },
    TERBATAS: { label: 'Terbatas (T)', badge: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    RAHASIA: { label: 'Rahasia (R)', badge: 'bg-orange-100 text-orange-800 border-orange-200' },
    SANGAT_RAHASIA: { label: 'Sangat Rahasia (SR)', badge: 'bg-red-100 text-red-800 border-red-200' }
}

export function LetterDetail({ letter }: { letter: LetterData }) {
    const router = useRouter()
    const { data: session } = useSession()
    const [isPending, startTransition] = useTransition()
    const [rejectReason, setRejectReason] = useState('')
    const [signedFile, setSignedFile] = useState<File | null>(null)
    const [showRejectDialog, setShowRejectDialog] = useState(false)

    const [showSignDialog, setShowSignDialog] = useState(false)
    const [signature, setSignature] = useState<string | null>(null)
    const sigCanvas = useRef<SignatureCanvas>(null)
    const [showApproveDialog, setShowApproveDialog] = useState(false)
    const [aspectRatio, setAspectRatio] = useState(210 / 297) // Default Portrait
    const [isDetecting, setIsDetecting] = useState(true)
    const [isLandscape, setIsLandscape] = useState(false) // Keep for toggle wording if needed, or deduce from aspect


    const fileUrl = letter.fileFinal || letter.fileStamped || letter.fileDraft
    const targetPage = letter.qrPage || 1

    // Auto-detect orientation
    useEffect(() => {
        const detectOrientation = async () => {
            if (!fileUrl) return

            try {
                setIsDetecting(true)
                // Dynamic import to avoid SSR DOMMatrix error
                const { pdfjs } = await import('react-pdf')
                pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

                const loadingTask = pdfjs.getDocument(fileUrl)
                const pdf = await loadingTask.promise
                const page = await pdf.getPage(targetPage)
                const viewport = page.getViewport({ scale: 1 })

                const ratio = viewport.width / viewport.height
                setAspectRatio(ratio)
                setIsLandscape(ratio > 1)
            } catch (error) {
                console.error('Error detecting PDF orientation:', error)
            } finally {
                setIsDetecting(false)
            }
        }

        detectOrientation()
    }, [fileUrl, targetPage])

    const status = statusConfig[letter.status] || statusConfig.DRAFT
    const priority = priorityConfig[letter.priority] || priorityConfig.NORMAL
    const security = securityConfig[letter.securityLevel] || securityConfig.BIASA
    const StatusIcon = status.icon

    const userPermissions = session?.user?.permissions || []
    const isCreator = session?.user?.id === letter.creator.id
    const isAssignedApprover = letter.assignedApproverId === session?.user?.id // Legacy support
    const isAssignedSigner = letter.assignedSignerId === session?.user?.id

    // Multi-stage approval logic
    const currentApprover = letter.letterApprovers?.find((la: any) => la.user.id === session?.user?.id)
    const isNextApprover = !!currentApprover &&
        currentApprover.status === 'PENDING' &&
        letter.letterApprovers
            .filter((la: any) => la.order < currentApprover.order)
            .every((la: any) => la.status === 'APPROVED')

    const canApprove = letter.status === 'PENDING_APPROVAL' && (isNextApprover || (isAssignedApprover && (!letter.letterApprovers || letter.letterApprovers.length === 0)))
    const canSign = letter.status === 'PENDING_SIGN' && isAssignedSigner
    const canDelete = userPermissions.includes(PERMISSIONS.LETTER_DELETE) || isCreator
    const canDispose = letter.status === 'SIGNED' && userPermissions.includes(PERMISSIONS.DISPOSITION_CREATE)

    const handleSubmit = () => {
        startTransition(async () => {
            const result = await submitForApproval(letter.id)
            if (result.success) {
                toast.success('Surat berhasil diajukan untuk persetujuan')
                router.refresh()
            } else {
                toast.error(result.error)
            }
        })
    }

    const handleApprove = () => {
        let signatureData: string | undefined

        if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
            // Get base64 signature (remove the data:image/png;base64, prefix if needed by backend, 
            // but our backend handles it or expects it. 
            // stampDocument implementation split(',') so passing full data url is fine)
            signatureData = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png')
        }

        // Ideally require signature for approval if it's the approver?
        // The user asked for "Ada tanda tangan digital atau tanda tangan paraf"
        if (!signatureData) {
            toast.error('Mohon bubuhkan paraf pada area yang tersedia')
            return
        }

        startTransition(async () => {
            const result = await approveLetter(letter.id, signatureData)
            if (result.success) {
                toast.success(`Surat disetujui.`)
                router.refresh()
                setShowApproveDialog(false)
            } else {
                toast.error(result.error)
            }
        })
    }

    const clearSignature = () => {
        sigCanvas.current?.clear()
    }

    const handleReject = () => {
        if (!rejectReason.trim()) {
            toast.error('Alasan penolakan harus diisi')
            return
        }
        startTransition(async () => {
            const result = await rejectLetter(letter.id, rejectReason)
            if (result.success) {
                toast.success('Surat telah ditolak')
                setShowRejectDialog(false)
                router.refresh()
            } else {
                toast.error(result.error)
            }
        })
    }

    const handleUploadSigned = () => {
        if (!signedFile) {
            toast.error('Pilih file yang sudah ditandatangani')
            return
        }
        startTransition(async () => {
            const formData = new FormData()
            formData.append('file', signedFile)
            const result = await uploadSignedLetter(letter.id, formData)
            if (result.success) {
                toast.success('Surat bertanda tangan berhasil diunggah')
                setShowSignDialog(false)
                router.refresh()
            } else {
                toast.error(result.error)
            }
        })
    }

    const handleDelete = () => {
        startTransition(async () => {
            const result = await deleteLetter(letter.id)
            if (result.success) {
                toast.success('Surat berhasil dihapus')
                router.push('/letters')
            } else {
                toast.error(result.error)
            }
        })
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/letters">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-2xl font-bold">{letter.title}</h1>
                            <Badge variant={status.variant} className="flex items-center gap-1">
                                <StatusIcon className="h-3 w-3" />
                                {status.label}
                            </Badge>
                            <Badge variant="outline" className={priority.color}>
                                {priority.label}
                            </Badge>
                            <Badge variant="outline" className={security.badge}>
                                {security.label}
                            </Badge>
                        </div>
                        <p className="text-muted-foreground mt-1">
                            {letter.letterNumber || 'Belum ada nomor surat'}
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                    {/* Draft: Submit for approval */}
                    {letter.status === 'DRAFT' && isCreator && (
                        <Button onClick={handleSubmit} disabled={isPending}>
                            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            Ajukan Persetujuan
                        </Button>
                    )}

                    {/* Pending Approval: Approve/Reject */}
                    {letter.status === 'PENDING_APPROVAL' && canApprove && (
                        <>
                            <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
                                <DialogTrigger asChild>
                                    <Button disabled={isPending}>
                                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                        Setujui
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md">
                                    <DialogHeader>
                                        <DialogTitle>Persetujuan Surat</DialogTitle>
                                        <DialogDescription>
                                            Silakan bubuhkan paraf Anda di bawah ini sebagai tanda persetujuan.
                                            Paraf ini akan ditempatkan pada posisi yang telah ditentukan pembuat surat.
                                        </DialogDescription>
                                    </DialogHeader>

                                    <div className="border rounded-md p-1 bg-gray-50">
                                        <SignatureCanvas
                                            ref={sigCanvas}
                                            penColor="black"
                                            canvasProps={{
                                                width: 400,
                                                height: 200,
                                                className: 'sigCanvas border rounded-md w-full h-full'
                                            }}
                                            onEnd={() => setSignature(sigCanvas.current?.toDataURL() || null)}
                                        />
                                    </div>
                                    <div className="flex justify-end">
                                        <Button variant="ghost" size="sm" onClick={clearSignature} type="button">
                                            <Eraser className="w-4 h-4 mr-2" />
                                            Hapus
                                        </Button>
                                    </div>

                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
                                            Batal
                                        </Button>
                                        <Button onClick={handleApprove} disabled={isPending}>
                                            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                            Konfirmasi & Setujui
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                            <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
                                <DialogTrigger asChild>
                                    <Button variant="destructive" disabled={isPending}>
                                        <XCircle className="mr-2 h-4 w-4" />
                                        Tolak
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Tolak Surat</DialogTitle>
                                        <DialogDescription>
                                            Masukkan alasan penolakan untuk surat ini
                                        </DialogDescription>
                                    </DialogHeader>
                                    <Textarea
                                        placeholder="Alasan penolakan..."
                                        value={rejectReason}
                                        onChange={(e) => setRejectReason(e.target.value)}
                                        rows={4}
                                    />
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
                                            Batal
                                        </Button>
                                        <Button variant="destructive" onClick={handleReject} disabled={isPending}>
                                            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                            Tolak Surat
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </>
                    )}

                    {/* Pending Sign: Download stamped, Reject, Upload signed */}
                    {letter.status === 'PENDING_SIGN' && canSign && letter.fileStamped && (
                        <>
                            <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
                                <DialogTrigger asChild>
                                    <Button variant="destructive" disabled={isPending}>
                                        <XCircle className="mr-2 h-4 w-4" />
                                        Tolak
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Tolak dan Kembalikan Surat</DialogTitle>
                                        <DialogDescription>
                                            Surat akan dikembalikan ke status Ditolak. Pembuat surat perlu memperbaikinya.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <Textarea
                                        placeholder="Alasan penolakan..."
                                        value={rejectReason}
                                        onChange={(e) => setRejectReason(e.target.value)}
                                        rows={4}
                                    />
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
                                            Batal
                                        </Button>
                                        <Button variant="destructive" onClick={handleReject} disabled={isPending}>
                                            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                            Tolak Surat
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>

                            <Button variant="outline" asChild>
                                <a href={letter.fileStamped} download>
                                    <Download className="mr-2 h-4 w-4" />
                                    Unduh PDF Stamped
                                </a>
                            </Button>
                            <Dialog open={showSignDialog} onOpenChange={setShowSignDialog}>
                                <DialogTrigger asChild>
                                    <Button disabled={isPending}>
                                        <Upload className="mr-2 h-4 w-4" />
                                        Unggah TTD
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Unggah Surat Bertandatangan</DialogTitle>
                                        <DialogDescription>
                                            Unggah file PDF yang sudah ditandatangani secara manual
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                        <input
                                            type="file"
                                            accept=".pdf"
                                            onChange={(e) => setSignedFile(e.target.files?.[0] || null)}
                                            className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                                        />
                                        {signedFile && (
                                            <p className="text-sm text-muted-foreground">
                                                File: {signedFile.name}
                                            </p>
                                        )}
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setShowSignDialog(false)}>
                                            Batal
                                        </Button>

                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button disabled={isPending || !signedFile}>
                                                    Unggah
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Konfirmasi Unggah</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Apakah anda yakin dokumen ini sudah ditandatangani dengan benar?
                                                        Tindakan ini tidak dapat dibatalkan.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Periksa Lagi</AlertDialogCancel>
                                                    <AlertDialogAction onClick={handleUploadSigned}>
                                                        Ya, Unggah
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>

                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </>
                    )}

                    {/* Delete button for draft/rejected */}
                    {['DRAFT', 'REJECTED', 'CANCELLED'].includes(letter.status) && canDelete && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" disabled={isPending}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Hapus
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Hapus Surat?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Tindakan ini tidak dapat dibatalkan. Surat dan semua file terkait akan dihapus permanen.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Batal</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDelete}>Hapus</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}

                    {/* Disposition button for signed letters */}
                    {canDispose && (
                        <CreateDispositionDialog
                            letterId={letter.id}
                            letterTitle={letter.title}
                        />
                    )}
                </div>
            </div>

            {/* Rejection Notice */}
            {letter.status === 'REJECTED' && letter.rejectionReason && (
                <Card className="border-destructive">
                    <CardContent className="flex items-start gap-3 p-4">
                        <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-medium text-destructive">Surat Ditolak</p>
                            <p className="text-sm text-muted-foreground mt-1">{letter.rejectionReason}</p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Disposition Status Card */}
            {letter.status === 'SIGNED' && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Send className="h-4 w-4" />
                            Status Disposisi
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {letter.dispositions && letter.dispositions.length > 0 ? (
                            <div className="space-y-4">
                                {letter.dispositions.map((disp) => (
                                    <div key={disp.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">No: {disp.number || 'Menunggu Penomoran'}</span>
                                                <Badge
                                                    variant={
                                                        disp.status === 'COMPLETED' ? 'default' :
                                                            disp.status === 'READ' ? 'secondary' : 'outline'
                                                    }
                                                    className="text-[10px]"
                                                >
                                                    {disp.status}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                Oleh: {disp.fromUser.name} • {new Date(disp.createdAt).toLocaleDateString('id-ID')}
                                            </p>
                                        </div>
                                        <Button size="sm" variant="ghost" asChild>
                                            <Link href={`/dispositions/${disp.id}`}>
                                                Lihat
                                            </Link>
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-6 text-muted-foreground">
                                <p>Belum ada disposisi untuk surat ini</p>
                                {canDispose && (
                                    <div className="mt-2">
                                        <p className="text-sm mb-2">Silakan buat disposisi jika diperlukan</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Letter Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Informasi Surat</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <h4 className="text-sm font-medium text-muted-foreground">Deskripsi</h4>
                                <p className="mt-1">{letter.description || '-'}</p>
                            </div>
                            <Separator />
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <h4 className="text-sm font-medium text-muted-foreground">Kategori</h4>
                                    <p className="mt-1">
                                        {letter.category ? (
                                            <Badge
                                                variant="outline"
                                                style={{ borderColor: letter.category.color, color: letter.category.color }}
                                            >
                                                {letter.category.code} - {letter.category.name}
                                            </Badge>
                                        ) : '-'}
                                    </p>
                                </div>
                                <div>
                                    <h4 className="text-sm font-medium text-muted-foreground">Dibuat oleh</h4>
                                    <p className="mt-1">{letter.creator.name}</p>
                                </div>
                                <div>
                                    <h4 className="text-sm font-medium text-muted-foreground">Disetujui oleh</h4>
                                    <div className="mt-1 space-y-2">
                                        {letter.letterApprovers && letter.letterApprovers.length > 0 ? (
                                            letter.letterApprovers.map((la) => (
                                                <div key={la.id} className="flex items-center gap-2 text-sm">
                                                    <span className={cn(
                                                        "flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold",
                                                        la.status === 'APPROVED' ? "bg-green-100 text-green-700" :
                                                            la.status === 'REJECTED' ? "bg-red-100 text-red-700" :
                                                                "bg-gray-100 text-gray-500"
                                                    )}>
                                                        {la.order}
                                                    </span>
                                                    <span className={cn(
                                                        la.status === 'APPROVED' ? "text-foreground" : "text-muted-foreground"
                                                    )}>
                                                        {la.user.name}
                                                    </span>
                                                    {la.status === 'APPROVED' && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                                                    {la.status === 'REJECTED' && <XCircle className="h-3.5 w-3.5 text-red-500" />}
                                                </div>
                                            ))
                                        ) : (
                                            <p>{letter.approver?.name || '-'}</p>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-sm font-medium text-muted-foreground">Ditandatangani oleh</h4>
                                    <p className="mt-1">{letter.signer?.name || '-'}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* PDF Preview */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="flex items-center gap-2 text-base font-semibold">
                                <Eye className="h-5 w-5" />
                                Preview Dokumen
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <div className="flex justify-center p-4 bg-gray-100 rounded-lg min-h-[500px]">
                                <PreviewPDF
                                    url={letter.fileFinal || letter.fileStamped || letter.fileDraft}
                                    letter={letter}
                                />
                            </div>

                            <div className="mt-3 p-2 bg-muted rounded text-xs text-muted-foreground flex items-center gap-4 flex-wrap">
                                <span className="flex items-center gap-1">
                                    <QrCode className="h-3 w-3" />
                                    QR: Hal {letter.qrPage}, X: {((letter.qrXPercent ?? 0) * 100).toFixed(0)}%, Y: {((letter.qrYPercent ?? 0) * 100).toFixed(0)}%
                                </span>
                                <span className="flex items-center gap-1">
                                    <PenTool className="h-3 w-3 text-blue-500" />
                                    Paraf: Hal {letter.parafPage ?? 1}, X: {((letter.parafXPercent ?? 0) * 100).toFixed(0)}%, Y: {((letter.parafYPercent ?? 0) * 100).toFixed(0)}%
                                </span>
                            </div>
                            <div className="flex gap-2 mt-4">
                                {letter.fileDraft && (
                                    <Button variant="outline" size="sm" asChild>
                                        <a href={letter.fileDraft} download>
                                            <Download className="mr-2 h-4 w-4" />
                                            Draft
                                        </a>
                                    </Button>
                                )}
                                {letter.fileStamped && (
                                    <Button variant="outline" size="sm" asChild>
                                        <a href={letter.fileStamped} download>
                                            <Download className="mr-2 h-4 w-4" />
                                            Stamped
                                        </a>
                                    </Button>
                                )}
                                {letter.fileFinal && (
                                    <Button variant="outline" size="sm" asChild>
                                        <a href={letter.fileFinal} download>
                                            <Download className="mr-2 h-4 w-4" />
                                            Final
                                        </a>
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Timeline */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <History className="h-5 w-5" />
                                Riwayat
                            </CardTitle>
                            <CardDescription>
                                Log aktivitas surat
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {letter.logs.map((log, index) => (
                                    <div key={log.id} className="flex gap-3">
                                        <div className="relative">
                                            <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                                            {index < letter.logs.length - 1 && (
                                                <div className="absolute top-4 left-[3px] w-0.5 h-full bg-border" />
                                            )}
                                        </div>
                                        <div className="flex-1 pb-4">
                                            <p className="text-sm font-medium">{log.description}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {log.user.name} • {new Date(log.createdAt).toLocaleString('id-ID')}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* QR Verification */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Verifikasi QR</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                Scan QR code pada dokumen untuk memverifikasi keaslian surat.
                            </p>
                            <Button variant="outline" className="w-full mt-4" asChild>
                                <Link href={`/verify/${letter.qrHash}`} target="_blank">
                                    Halaman Verifikasi
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
