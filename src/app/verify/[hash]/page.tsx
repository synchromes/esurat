import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { CheckCircle2, XCircle, FileText, Calendar, User, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default async function VerifyPage({
    params
}: {
    params: Promise<{ hash: string }>
}) {
    const { hash } = await params

    const letter = await prisma.letter.findUnique({
        where: { qrHash: hash },
        include: {
            creator: { select: { name: true } },
            approver: { select: { name: true } },
            signer: { select: { name: true } },
            category: { select: { name: true, code: true } }
        }
    })

    if (!letter) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-red-50 p-4">
                <Card className="max-w-md w-full">
                    <CardContent className="pt-6 text-center">
                        <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                            <XCircle className="h-8 w-8 text-red-500" />
                        </div>
                        <h1 className="text-2xl font-bold text-red-600">Dokumen Tidak Valid</h1>
                        <p className="text-muted-foreground mt-2">
                            QR Code tidak ditemukan dalam sistem. Dokumen ini mungkin palsu atau belum terdaftar.
                        </p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const isValid = letter.status === 'SIGNED' || letter.status === 'PENDING_SIGN'

    return (
        <div className={`min-h-screen flex items-center justify-center p-4 ${isValid
                ? 'bg-gradient-to-br from-green-50 via-white to-green-50'
                : 'bg-gradient-to-br from-yellow-50 via-white to-yellow-50'
            }`}>
            <Card className="max-w-lg w-full">
                <CardHeader className="text-center pb-2">
                    <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-4 ${isValid ? 'bg-green-100' : 'bg-yellow-100'
                        }`}>
                        {isValid ? (
                            <ShieldCheck className={`h-10 w-10 text-green-500`} />
                        ) : (
                            <FileText className={`h-10 w-10 text-yellow-500`} />
                        )}
                    </div>
                    <CardTitle className={`text-2xl ${isValid ? 'text-green-600' : 'text-yellow-600'}`}>
                        {isValid ? 'Dokumen Terverifikasi' : 'Dokumen Dalam Proses'}
                    </CardTitle>
                    <CardDescription>
                        {isValid
                            ? 'Dokumen ini sah dan terdaftar dalam sistem E-Surat Digital TVRI'
                            : 'Dokumen ini terdaftar namun belum selesai diproses'
                        }
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Document Info */}
                    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                        <div className="flex items-start gap-3">
                            <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Judul Dokumen</p>
                                <p className="font-semibold">{letter.title}</p>
                            </div>
                        </div>

                        {letter.letterNumber && (
                            <div className="flex items-start gap-3">
                                <Badge variant="outline" className="mt-0.5">No.</Badge>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Nomor Surat</p>
                                    <p className="font-semibold">{letter.letterNumber}</p>
                                </div>
                            </div>
                        )}

                        {letter.category && (
                            <div className="flex items-start gap-3">
                                <div className="h-5 w-5" />
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Kategori</p>
                                    <p>{letter.category.code} - {letter.category.name}</p>
                                </div>
                            </div>
                        )}

                        <div className="flex items-start gap-3">
                            <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Tanggal Dibuat</p>
                                <p>{new Date(letter.createdAt).toLocaleDateString('id-ID', {
                                    weekday: 'long',
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric'
                                })}</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Dibuat oleh</p>
                                <p>{letter.creator.name}</p>
                            </div>
                        </div>

                        {letter.approver && (
                            <div className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Disetujui oleh</p>
                                    <p>{letter.approver.name}</p>
                                    {letter.approvedAt && (
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(letter.approvedAt).toLocaleDateString('id-ID')}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {letter.signer && (
                            <div className="flex items-start gap-3">
                                <ShieldCheck className="h-5 w-5 text-muted-foreground mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Ditandatangani oleh</p>
                                    <p>{letter.signer.name}</p>
                                    {letter.signedAt && (
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(letter.signedAt).toLocaleDateString('id-ID')}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Status Badge */}
                    <div className="flex justify-center">
                        <Badge
                            variant={letter.status === 'SIGNED' ? 'default' : 'secondary'}
                            className="text-sm px-4 py-1"
                        >
                            Status: {
                                letter.status === 'SIGNED' ? 'Selesai' :
                                    letter.status === 'PENDING_SIGN' ? 'Menunggu Tanda Tangan' :
                                        letter.status === 'PENDING_APPROVAL' ? 'Menunggu Persetujuan' :
                                            letter.status
                            }
                        </Badge>
                    </div>

                    {/* Footer */}
                    <div className="text-center text-xs text-muted-foreground pt-4 border-t">
                        <p>E-Surat Digital TVRI</p>
                        <p>Diverifikasi pada {new Date().toLocaleString('id-ID')}</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
