
import prisma from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { CheckCircle2, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'

export default async function VerifyDispositionPage({ params }: { params: Promise<{ hash: string }> }) {
    const { hash } = await params

    // Find disposition by hash or id (fallback)
    const disposition = await prisma.disposition.findFirst({
        where: {
            OR: [
                { qrHash: hash },
                { id: hash } // Fallback logic
            ]
        },
        include: {
            letter: {
                select: {
                    title: true,
                    letterNumber: true,
                    creator: { select: { name: true } }
                }
            },
            fromUser: { select: { name: true, id: true } }
        }
    })

    if (!disposition) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <Card className="w-full max-w-md border-red-200">
                    <CardHeader className="text-center pb-2">
                        <XCircle className="mx-auto h-12 w-12 text-red-500 mb-2" />
                        <CardTitle className="text-red-700">Disposisi Tidak Valid</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center text-muted-foreground">
                        <p>Data disposisi tidak ditemukan dalam sistem kami.</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const isValid = disposition.status === 'SUBMITTED' // Only submitted (signed) are valid? But standard workflow says PENDING_SIGN -> SUBMITTED.
    // If user scans draft, it might exist but not signed yet?
    // User said "disposisi ini telah ditanda tangani secara elektronik".
    // So if status is NOT Submitted, maybe show "Belum Ditandatangani"?

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <Card className="w-full max-w-lg shadow-lg">
                <CardHeader className="text-center border-b pb-6">
                    <img src="/logo.png" alt="TVRI" className="h-12 object-contain mx-auto mb-4" />
                    <CardTitle className="text-xl">Verifikasi Disposisi Digital</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    {isValid ? (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                            <div>
                                <h3 className="font-semibold text-green-800">Dokumen Valid & Terverifikasi</h3>
                                <p className="text-sm text-green-700 mt-1">
                                    Disposisi ini telah ditandatangani secara elektronik dan tercatat resmi dalam sistem E-Surat TVRI Stasiun Kalimantan Barat.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-yellow-50 border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                            <CheckCircle2 className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                            <div>
                                <h3 className="font-semibold text-yellow-800">Dokumen Terdaftar (Draft)</h3>
                                <p className="text-sm text-yellow-700 mt-1">
                                    Disposisi ini terdaftar namun belum berstatus final (Tanda Tangan Elektronik belum selesai atau masih dalam proses).
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-2 text-sm">
                            <span className="text-muted-foreground">Nomor</span>
                            <span className="col-span-2 font-medium">{disposition.number}</span>

                            <span className="text-muted-foreground">Tanggal</span>
                            <span className="col-span-2 font-medium">
                                {format(new Date(disposition.createdAt), 'dd MMMM yyyy', { locale: id })}
                            </span>

                            <span className="text-muted-foreground">Dari</span>
                            <span className="col-span-2 font-medium">{disposition.fromUser.name}</span>

                            <span className="text-muted-foreground">Perihal Surat</span>
                            <span className="col-span-2 font-medium">{disposition.letter.title}</span>
                        </div>

                        <Separator />

                        <div className="text-center text-xs text-muted-foreground">
                            Scan QR Code ini mengarahkan Anda ke halaman verifikasi resmi E-Surat TVRI.
                            <br />
                            ID: {disposition.id}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
