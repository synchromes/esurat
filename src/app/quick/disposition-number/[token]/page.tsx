'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
    verifySetNumberMagicLink,
    getSetNumberData,
    setDispositionNumberWithToken
} from '@/actions/quick-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'

export default function SetDispositionNumberPage() {
    const params = useParams()
    const router = useRouter()
    const token = params.token as string

    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [data, setData] = useState<any>(null)

    // Form state
    const [dispositionNumber, setDispositionNumber] = useState('')

    useEffect(() => {
        const init = async () => {
            if (!token) return

            // Verify token first
            const verifyRes = await verifySetNumberMagicLink(token)
            if (!verifyRes.success) {
                setError(verifyRes.error || 'Link tidak valid')
                setLoading(false)
                return
            }

            // Get data
            const dataRes = await getSetNumberData(token)
            if (!dataRes.success) {
                setError(dataRes.error || 'Gagal memuat data')
            } else {
                setData(dataRes.data)
            }
            setLoading(false)
        }

        init()
    }, [token])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!dispositionNumber.trim()) {
            toast.error('Nomor disposisi harus diisi')
            return
        }

        setSubmitting(true)
        try {
            const result = await setDispositionNumberWithToken(token, dispositionNumber)
            if (result.success) {
                setSuccess(true)
                toast.success('Nomor berhasil disimpan')
            } else {
                toast.error(result.error || 'Gagal menyimpan nomor')
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
                    <p>Nomor disposisi telah disimpan.</p>
                    <p className="text-sm">Notifikasi telah dikirim ke pembuat disposisi untuk proses tanda tangan.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4 max-w-md mx-auto">
            <Card>
                <CardHeader>
                    <CardTitle>Set Nomor Disposisi</CardTitle>
                    <CardDescription>
                        Lengkapi nomor agenda untuk disposisi surat
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        <div className="p-3 bg-muted rounded-lg text-sm space-y-2">
                            <div>
                                <span className="text-muted-foreground">Judul Surat:</span>
                                <p className="font-medium">{data?.letter.title}</p>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Nomor Surat:</span>
                                <p className="font-medium">{data?.letter.letterNumber || '-'}</p>
                            </div>
                            <div>
                                <span className="text-muted-foreground">ID Disposisi:</span>
                                <p className="font-mono text-xs">{data?.disposition.id}</p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="number">Nomor Agenda Disposisi</Label>
                                <Input
                                    id="number"
                                    placeholder="Contoh: 001/DISP/I/2026"
                                    value={dispositionNumber}
                                    onChange={(e) => setDispositionNumber(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <Button type="submit" className="w-full" disabled={submitting}>
                                {submitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Menyimpan...
                                    </>
                                ) : (
                                    'Simpan Nomor'
                                )}
                            </Button>
                        </form>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
