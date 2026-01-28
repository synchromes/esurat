'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
    verifyUploadDispositionMagicLink,
    uploadSignedDispositionWithToken
} from '@/actions/quick-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Loader2, CheckCircle2, AlertCircle, Download, Upload } from 'lucide-react'
import { toast } from 'sonner'

export default function UploadDispositionPage() {
    const params = useParams()
    const router = useRouter()
    const token = params.token as string

    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [data, setData] = useState<any>(null)
    const [file, setFile] = useState<File | null>(null)

    useEffect(() => {
        const init = async () => {
            if (!token) return

            // Verify token & get data
            const res = await verifyUploadDispositionMagicLink(token)
            if (!res.success) {
                setError(res.error || 'Link tidak valid')
            } else {
                setData(res.data)
            }
            setLoading(false)
        }

        init()
    }, [token])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!file) {
            toast.error('Silakan pilih file PDF')
            return
        }

        setSubmitting(true)
        try {
            const formData = new FormData()
            formData.append('file', file)

            const result = await uploadSignedDispositionWithToken(token, formData)
            if (result.success) {
                setSuccess(true)
                toast.success('File berhasil diunggah')
            } else {
                toast.error(result.error || 'Gagal mengunggah file')
            }
        } catch (err) {
            toast.error('Terjadi kesalahan sistem')
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="p-4 text-center">
                <div className="bg-red-50 text-red-600 p-4 rounded-lg flex flex-col items-center gap-2">
                    <AlertCircle className="w-8 h-8" />
                    <p className="font-medium">{error}</p>
                </div>
            </div>
        )
    }

    if (success) {
        return (
            <div className="p-4 text-center">
                <div className="bg-green-50 text-green-600 p-8 rounded-lg flex flex-col items-center gap-4">
                    <CheckCircle2 className="w-12 h-12" />
                    <h2 className="text-xl font-bold">Berhasil!</h2>
                    <p>Disposisi telah diunggah dan dikirim ke penerima.</p>
                </div>
            </div>
        )
    }

    const downloadUrl = `/api/dispositions/${data?.disposition?.id}/pdf`

    return (
        <div className="p-4 max-w-md mx-auto">
            <Card>
                <CardHeader>
                    <CardTitle>Unggah Disposisi</CardTitle>
                    <CardDescription>
                        Download, Tanda Tangani, dan Unggah kembali
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        <div className="p-3 bg-muted rounded-lg text-sm space-y-2">
                            <div>
                                <span className="text-muted-foreground">Judul Surat:</span>
                                <p className="font-medium">{data?.magicLink?.letter?.title}</p>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Nomor Disposisi:</span>
                                <p className="font-medium">{data?.disposition?.number || '-'}</p>
                            </div>
                        </div>

                        <div className="border-b pb-6 space-y-4">
                            <h3 className="font-medium text-sm">Langkah 1: Download Lembar Disposisi</h3>
                            <Button variant="outline" className="w-full" asChild>
                                <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                                    <Download className="mr-2 h-4 w-4" />
                                    Download PDF
                                </a>
                            </Button>
                        </div>

                        <div className="space-y-4">
                            <h3 className="font-medium text-sm">Langkah 2: Unggah PDF Bertanda Tangan</h3>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="file">File PDF</Label>
                                    <Input
                                        id="file"
                                        type="file"
                                        accept=".pdf"
                                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                                    />
                                </div>

                                <Button type="submit" className="w-full" disabled={submitting || !file}>
                                    {submitting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Mengunggah...
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="mr-2 h-4 w-4" />
                                            Selesai & Kirim
                                        </>
                                    )}
                                </Button>
                            </form>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
