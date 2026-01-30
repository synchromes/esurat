'use client'

import { useState } from 'react'
import { verifyUploadDispositionMagicLink, uploadSignedDispositionWithToken } from '@/actions/quick-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Loader2, CheckCircle2, Download, Upload, FileText, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'

interface QuickDispositionUploadWrapperProps {
    token: string
}

export function QuickDispositionUploadWrapper({ token }: QuickDispositionUploadWrapperProps) {
    const [otp, setOtp] = useState('')
    const [isVerifying, setIsVerifying] = useState(false)
    const [verifiedData, setVerifiedData] = useState<any>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [error, setError] = useState('')

    const handleVerify = async () => {
        if (!otp || otp.length < 6) {
            setError('Masukkan kode OTP 6 digit')
            return
        }

        setIsVerifying(true)
        setError('')

        try {
            const result = await verifyUploadDispositionMagicLink(token, otp)
            if (result.success) {
                setVerifiedData(result.data)
            } else {
                setError(result.error || 'Verifikasi gagal')
            }
        } catch (e) {
            setError('Terjadi kesalahan network')
        } finally {
            setIsVerifying(false)
        }
    }

    // OTP Verification Screen
    if (!verifiedData) {
        return (
            <div className="p-6 space-y-6">
                <div className="text-center space-y-2">
                    <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto">
                        <Lock className="w-6 h-6 text-blue-600" />
                    </div>
                    <h2 className="text-xl font-semibold">Verifikasi Kode OTP</h2>
                    <p className="text-sm text-gray-500">
                        Masukkan kode 6 digit yang dikirim ke WhatsApp Anda.
                    </p>
                </div>

                <div className="space-y-4">
                    <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="000000"
                        className="text-center text-2xl tracking-[0.5em] h-14 font-mono"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                    />

                    {error && (
                        <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded animate-shake">
                            {error}
                        </p>
                    )}

                    <Button
                        className="w-full h-12 text-lg"
                        onClick={handleVerify}
                        disabled={isVerifying || otp.length !== 6}
                    >
                        {isVerifying ? <Loader2 className="animate-spin mr-2" /> : 'Verifikasi Akses'}
                    </Button>
                </div>
            </div>
        )
    }

    // Success Screen
    if (isSuccess) {
        return (
            <div className="p-8 text-center space-y-4">
                <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-green-700">Berhasil Diunggah!</h2>
                <p className="text-gray-600">Disposisi yang ditandatangani telah tersimpan. Notifikasi telah dikirim ke penerima.</p>
            </div>
        )
    }

    const { magicLink, disposition } = verifiedData
    const letter = magicLink.letter

    const handleUpload = async () => {
        if (!file) {
            toast.error('Pilih file terlebih dahulu')
            return
        }

        setIsSubmitting(true)
        try {
            const formData = new FormData()
            formData.append('file', file)

            const result = await uploadSignedDispositionWithToken(token, formData)

            if (result.success) {
                toast.success('Disposisi berhasil diunggah')
                setIsSuccess(true)
            } else {
                toast.error(result.error || 'Gagal mengunggah disposisi')
            }
        } catch (error) {
            toast.error('Terjadi kesalahan')
        } finally {
            setIsSubmitting(false)
        }
    }

    // Main Upload Screen
    return (
        <div className="space-y-6 p-4">
            <div className="text-center space-y-2">
                <Badge variant="outline" className="mb-2">Upload Disposisi TTE</Badge>
                <h3 className="font-semibold text-lg leading-tight">{letter.title}</h3>
                <p className="text-sm text-muted-foreground">Nomor Disposisi: {disposition.number}</p>
            </div>

            <div className="flex flex-col gap-3">
                <Button variant="outline" className="w-full justify-start h-auto py-3" asChild>
                    <a href={`/api/dispositions/${disposition.id}/pdf`} target="_blank" rel="noopener noreferrer">
                        <FileText className="mr-2 h-5 w-5 text-blue-500" />
                        <div className="text-left">
                            <div className="font-medium">Download Lembar Disposisi</div>
                            <div className="text-xs text-muted-foreground">Unduh, tanda tangani, lalu unggah kembali</div>
                        </div>
                    </a>
                </Button>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Upload Disposisi Ditandatangani</CardTitle>
                    <CardDescription>Unggah file PDF yang sudah lengkap dengan tanda tangan Anda.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid w-full max-w-sm items-center gap-1.5">
                        <Label htmlFor="file">File PDF</Label>
                        <Input
                            id="file"
                            type="file"
                            accept=".pdf"
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                        />
                    </div>
                </CardContent>
            </Card>

            <Button className="w-full h-12 text-lg font-medium" onClick={handleUpload} disabled={isSubmitting || !file}>
                {isSubmitting ? <span className="flex items-center gap-2"><Upload className="animate-bounce w-4 h-4" /> Mengunggah...</span> : 'Kirim Disposisi'}
            </Button>
        </div>
    )
}
