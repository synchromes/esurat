'use client'

import { useState } from 'react'
import { QuickAccessAuth } from './QuickAccessAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, CheckCircle2, Upload, AlertTriangle } from 'lucide-react'
import { uploadSignedWithToken } from '@/actions/quick-actions'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface QuickSignWrapperProps {
    token: string
}

export function QuickSignWrapper({ token }: QuickSignWrapperProps) {
    const [verifiedData, setVerifiedData] = useState<any>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const [file, setFile] = useState<File | null>(null)

    if (!verifiedData) {
        return <QuickAccessAuth token={token} onVerified={setVerifiedData} />
    }

    if (isSuccess) {
        return (
            <div className="p-8 text-center space-y-4">
                <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-green-700">Berhasil Diunggah!</h2>
                <p className="text-gray-600">Surat yang ditandatangani telah berhasil tersimpan sistem.</p>
            </div>
        )
    }

    const { letter } = verifiedData

    const handleUpload = async () => {
        if (!file) {
            toast.error('Pilih file terlebih dahulu')
            return
        }

        setIsSubmitting(true)
        try {
            const formData = new FormData()
            formData.append('file', file)

            const result = await uploadSignedWithToken(token, formData)

            if (result.success) {
                toast.success('Surat berhasil diunggah')
                setIsSuccess(true)
            } else {
                toast.error(result.error || 'Gagal mengunggah surat')
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
                <Badge variant="outline" className="mb-2">Permintaan Tanda Tangan</Badge>
                <h3 className="font-semibold text-lg leading-tight">{letter.title}</h3>
                <p className="text-sm text-muted-foreground">{letter.letterNumber || 'Nomor belum digenerate'}</p>
            </div>

            <div className="flex flex-col gap-3">
                <Button variant="outline" className="w-full justify-start h-auto py-3" onClick={() => window.open(letter.fileStamped, '_blank')}>
                    <FileText className="mr-2 h-5 w-5 text-blue-500" />
                    <div className="text-left">
                        <div className="font-medium">Download Surat (Diparaf)</div>
                        <div className="text-xs text-muted-foreground">Unduh, tanda tangani, lalu unggah kembali</div>
                    </div>
                </Button>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Upload Surat Ditandatangani</CardTitle>
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
                {isSubmitting ? <span className="flex items-center gap-2"><Upload className="animate-bounce w-4 h-4" /> Mengunggah...</span> : 'Kirim Berkas'}
            </Button>
        </div>
    )
}
