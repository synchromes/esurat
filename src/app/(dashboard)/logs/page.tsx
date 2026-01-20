import { Suspense } from 'react'
import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import {
    Activity,
    Search,
    Calendar as CalendarIcon,
    Filter
} from 'lucide-react'

import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/permissions'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'

export const metadata: Metadata = {
    title: 'Log Aktivitas | E-Surat',
    description: 'Log aktivitas sistem',
}

interface LogsPageProps {
    searchParams: {
        q?: string
        user?: string
        action?: string
        page?: string
    }
}

export default async function LogsPage({ searchParams }: LogsPageProps) {
    const session = await auth()
    if (!session) redirect('/login')

    // Check permission
    const hasLogPermission = await prisma.rolePermission.count({
        where: {
            role: { users: { some: { userId: session.user.id } } },
            permission: { name: PERMISSIONS.LOG_VIEW }
        }
    })

    if (!hasLogPermission) {
        redirect('/dashboard')
    }

    const query = searchParams.q || ''
    const page = Number(searchParams.page) || 1
    const limit = 20
    const skip = (page - 1) * limit

    // Build filter
    const where: any = {}
    if (query) {
        where.OR = [
            { description: { contains: query } },
            { user: { name: { contains: query } } },
            { action: { contains: query } }
        ]
    }

    const [logs, total] = await Promise.all([
        prisma.activityLog.findMany({
            where,
            include: {
                user: { select: { name: true, email: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip
        }),
        prisma.activityLog.count({ where })
    ])

    const totalPages = Math.ceil(total / limit)

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Log Aktivitas</h1>
                    <p className="text-muted-foreground">
                        Memantau aktivitas pengguna dalam sistem
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Activity className="h-5 w-5" />
                            Riwayat Aktivitas
                        </CardTitle>
                        <form className="flex items-center gap-2 w-full sm:w-auto">
                            <div className="relative flex-1 sm:flex-initial">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    name="q"
                                    placeholder="Cari aktivitas..."
                                    className="pl-8 w-full sm:w-[250px]"
                                    defaultValue={query}
                                />
                            </div>
                            <Button type="submit" size="icon" variant="secondary" className="shrink-0">
                                <Search className="h-4 w-4" />
                            </Button>
                        </form>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[180px]">Waktu</TableHead>
                                    <TableHead className="w-[200px]">Pengguna</TableHead>
                                    <TableHead className="w-[150px]">Aksi</TableHead>
                                    <TableHead>Deskripsi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {logs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">
                                            Tidak ada data log.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    logs.map((log) => (
                                        <TableRow key={log.id}>
                                            <TableCell className="font-mono text-xs">
                                                {format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm:ss', { locale: idLocale })}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-sm">{log.user.name}</span>
                                                    <span className="text-xs text-muted-foreground">{log.user.email}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="font-mono text-xs">
                                                    {log.action}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {log.description}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Simple Pagination */}
                    <div className="flex items-center justify-end space-x-2 py-4">
                        <div className="text-xs text-muted-foreground">
                            Halaman {page} dari {totalPages || 1}
                        </div>
                        <div className="space-x-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page <= 1}
                                asChild
                            >
                                <a href={`/logs?page=${page - 1}&q=${query}`}>Previous</a>
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page >= totalPages}
                                asChild
                            >
                                <a href={`/logs?page=${page + 1}&q=${query}`}>Next</a>
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
