import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    FileText,
    Clock,
    CheckCircle2,
    XCircle,
    PenTool,
    TrendingUp,
    Users,
    FolderOpen
} from 'lucide-react'
import Link from 'next/link'

async function getDashboardStats(userId: string) {
    const [
        totalLetters,
        pendingApproval,
        approved,
        signed,
        rejected,
        recentLetters
    ] = await Promise.all([
        prisma.letter.count({ where: { creatorId: userId } }),
        prisma.letter.count({ where: { status: 'PENDING_APPROVAL' } }),
        prisma.letter.count({ where: { status: 'APPROVED' } }),
        prisma.letter.count({ where: { status: 'SIGNED' } }),
        prisma.letter.count({ where: { status: 'REJECTED' } }),
        prisma.letter.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: {
                creator: { select: { name: true } },
                category: { select: { name: true, color: true } }
            }
        })
    ])

    return {
        totalLetters,
        pendingApproval,
        approved,
        signed,
        rejected,
        recentLetters
    }
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

export default async function DashboardPage() {
    const session = await auth()
    const stats = await getDashboardStats(session!.user.id)

    const statCards = [
        { title: 'Total Surat', value: stats.totalLetters, icon: FileText, color: 'text-blue-500', bg: 'bg-blue-500/10' },
        { title: 'Menunggu Approval', value: stats.pendingApproval, icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
        { title: 'Disetujui', value: stats.approved + stats.signed, icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10' },
        { title: 'Ditolak', value: stats.rejected, icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10' }
    ]

    return (
        <div className="space-y-6">
            {/* Welcome Section */}
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">
                    Selamat Datang, {session?.user?.name?.split(' ')[0]}! 👋
                </h1>
                <p className="text-muted-foreground">
                    Berikut ringkasan dokumen dan aktivitas terbaru Anda.
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {statCards.map((stat, index) => (
                    <Card key={index} className="overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                {stat.title}
                            </CardTitle>
                            <div className={`p-2 rounded-lg ${stat.bg}`}>
                                <stat.icon className={`h-4 w-4 ${stat.color}`} />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{stat.value}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Main Content Grid */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Recent Letters */}
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Surat Terbaru
                        </CardTitle>
                        <CardDescription>
                            5 dokumen terakhir yang dibuat
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {stats.recentLetters.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                <FolderOpen className="h-12 w-12 text-muted-foreground/50" />
                                <p className="mt-2 text-sm text-muted-foreground">
                                    Belum ada surat yang dibuat
                                </p>
                                <Link
                                    href="/letters/create"
                                    className="mt-4 text-sm text-primary hover:underline"
                                >
                                    Buat surat pertama Anda →
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {stats.recentLetters.map((letter) => {
                                    const status = statusConfig[letter.status] || statusConfig.DRAFT
                                    const StatusIcon = status.icon
                                    return (
                                        <Link
                                            key={letter.id}
                                            href={`/letters/${letter.id}`}
                                            className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors"
                                        >
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className="flex-shrink-0">
                                                    <StatusIcon className="h-5 w-5 text-muted-foreground" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-medium truncate">{letter.title}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {new Date(letter.createdAt).toLocaleDateString('id-ID', {
                                                            day: 'numeric',
                                                            month: 'short',
                                                            year: 'numeric'
                                                        })}
                                                    </p>
                                                </div>
                                            </div>
                                            <Badge variant={status.variant} className="w-fit sm:translate-y-0">
                                                {status.label}
                                            </Badge>
                                        </Link>
                                    )
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            Aksi Cepat
                        </CardTitle>
                        <CardDescription>
                            Akses menu yang sering digunakan
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Link
                                href="/letters/create"
                                className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-dashed hover:border-primary hover:bg-primary/5 transition-colors"
                            >
                                <div className="p-3 rounded-full bg-primary/10">
                                    <FileText className="h-6 w-6 text-primary" />
                                </div>
                                <span className="text-sm font-medium">Buat Surat Baru</span>
                            </Link>

                            <Link
                                href="/letters"
                                className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-dashed hover:border-primary hover:bg-primary/5 transition-colors"
                            >
                                <div className="p-3 rounded-full bg-blue-500/10">
                                    <FolderOpen className="h-6 w-6 text-blue-500" />
                                </div>
                                <span className="text-sm font-medium">Lihat Semua Surat</span>
                            </Link>

                            <Link
                                href="/admin/users"
                                className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-dashed hover:border-primary hover:bg-primary/5 transition-colors"
                            >
                                <div className="p-3 rounded-full bg-green-500/10">
                                    <Users className="h-6 w-6 text-green-500" />
                                </div>
                                <span className="text-sm font-medium">Kelola Pengguna</span>
                            </Link>

                            <Link
                                href="/categories"
                                className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-dashed hover:border-primary hover:bg-primary/5 transition-colors"
                            >
                                <div className="p-3 rounded-full bg-purple-500/10">
                                    <FolderOpen className="h-6 w-6 text-purple-500" />
                                </div>
                                <span className="text-sm font-medium">Kategori Surat</span>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
