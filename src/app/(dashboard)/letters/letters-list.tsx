'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
    FileText,
    Clock,
    CheckCircle2,
    XCircle,
    PenTool,
    Eye,
    Search,
    Filter
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { getLetters } from '@/actions/letters'
import { cn } from '@/lib/utils'

type Letter = {
    id: string
    title: string
    letterNumber: string | null
    status: string
    priority: string
    createdAt: Date
    category: { id: string; name: string; color: string; code: string } | null
    creator: { id: string; name: string; email: string }
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
    LOW: { label: 'Rendah', color: 'text-gray-500' },
    NORMAL: { label: 'Normal', color: 'text-blue-500' },
    HIGH: { label: 'Tinggi', color: 'text-orange-500' },
    URGENT: { label: 'Urgent', color: 'text-red-500' }
}

export function LettersList({
    searchParamsPromise
}: {
    searchParamsPromise: Promise<{ page?: string; status?: string; search?: string }>
}) {
    const router = useRouter()
    const urlSearchParams = useSearchParams()
    const [isPending, startTransition] = useTransition()

    const [letters, setLetters] = useState<Letter[]>([])
    const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 })
    const [searchValue, setSearchValue] = useState('')
    const [statusFilter, setStatusFilter] = useState('ALL')

    useEffect(() => {
        const loadData = async () => {
            const params = await searchParamsPromise
            const page = parseInt(params.page || '1')
            const status = params.status || 'ALL'
            const search = params.search || ''

            setSearchValue(search)
            setStatusFilter(status)

            startTransition(async () => {
                const result = await getLetters({ page, status, search, limit: 10 })
                if (result.success && result.data) {
                    setLetters(result.data as Letter[])
                    setPagination(result.pagination!)
                }
            })
        }
        loadData()
    }, [searchParamsPromise])

    const updateFilters = (newParams: Record<string, string>) => {
        const params = new URLSearchParams(urlSearchParams.toString())
        Object.entries(newParams).forEach(([key, value]) => {
            if (value && value !== 'ALL') {
                params.set(key, value)
            } else {
                params.delete(key)
            }
        })
        params.set('page', '1') // Reset to first page on filter change
        router.push(`/letters?${params.toString()}`)
    }

    return (
        <div className="space-y-4">
            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Cari judul atau nomor surat..."
                                value={searchValue}
                                onChange={(e) => setSearchValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        updateFilters({ search: searchValue })
                                    }
                                }}
                                className="pl-9"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Select value={statusFilter} onValueChange={(value) => updateFilters({ status: value })}>
                                <SelectTrigger className="w-[180px]">
                                    <Filter className="mr-2 h-4 w-4" />
                                    <SelectValue placeholder="Filter Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">Semua Status</SelectItem>
                                    <SelectItem value="DRAFT">Draft</SelectItem>
                                    <SelectItem value="PENDING_APPROVAL">Menunggu Persetujuan</SelectItem>
                                    <SelectItem value="PENDING_SIGN">Menunggu TTD</SelectItem>
                                    <SelectItem value="SIGNED">Selesai</SelectItem>
                                    <SelectItem value="REJECTED">Ditolak</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button
                                variant="outline"
                                onClick={() => updateFilters({ search: searchValue })}
                                disabled={isPending}
                            >
                                Cari
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Letters Table */}
            <Card>
                <CardContent className="p-0">
                    {isPending ? (
                        <div className="p-8 text-center text-muted-foreground">
                            Memuat data...
                        </div>
                    ) : letters.length === 0 ? (
                        <div className="p-8 text-center">
                            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
                            <p className="mt-2 text-muted-foreground">Tidak ada surat ditemukan</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {letters.map((letter) => {
                                const status = statusConfig[letter.status] || statusConfig.DRAFT
                                const priority = priorityConfig[letter.priority] || priorityConfig.NORMAL
                                const StatusIcon = status.icon

                                return (
                                    <div
                                        key={letter.id}
                                        className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 hover:bg-muted/50 transition-colors border-b last:border-0"
                                    >
                                        {/* Mobile: Row 1 - Icon & Title */}
                                        <div className="flex items-start gap-3 flex-1 min-w-0 w-full">
                                            <div className="flex-shrink-0 mt-1">
                                                <StatusIcon className="h-5 w-5 text-muted-foreground" />
                                            </div>
                                            <div className="min-w-0 flex-1 space-y-1">
                                                <div className="flex items-start justify-between gap-2">
                                                    <Link
                                                        href={`/letters/${letter.id}`}
                                                        className="font-medium hover:underline line-clamp-2"
                                                    >
                                                        {letter.title}
                                                    </Link>
                                                    {/* Mobile: Actions (Eye) */}
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 sm:hidden shrink-0" asChild>
                                                        <Link href={`/letters/${letter.id}`}>
                                                            <Eye className="h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                </div>

                                                {letter.category && (
                                                    <Badge
                                                        variant="outline"
                                                        style={{ borderColor: letter.category.color, color: letter.category.color }}
                                                        className="text-[10px] h-5"
                                                    >
                                                        {letter.category.code}
                                                    </Badge>
                                                )}

                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground mt-1">
                                                    <span>{letter.letterNumber || 'No. -'}</span>
                                                    <span className="hidden sm:inline">•</span>
                                                    <span className={cn("block sm:inline w-full sm:w-auto", priority.color)}>{priority.label}</span>
                                                    <span className="hidden sm:inline">•</span>
                                                    <span className="block sm:inline w-full sm:w-auto">
                                                        {new Date(letter.createdAt).toLocaleDateString('id-ID', {
                                                            day: 'numeric',
                                                            month: 'short',
                                                            year: 'numeric'
                                                        })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Desktop: Actions & Status */}
                                        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto mt-2 sm:mt-0">
                                            <Badge variant={status.variant} className="text-xs whitespace-nowrap">
                                                {status.label}
                                            </Badge>
                                            <Button variant="ghost" size="icon" className="hidden sm:inline-flex" asChild>
                                                <Link href={`/letters/${letter.id}`}>
                                                    <Eye className="h-4 w-4" />
                                                </Link>
                                            </Button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                        Menampilkan {letters.length} dari {pagination.total} surat
                    </p>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={pagination.page <= 1}
                            onClick={() => {
                                const params = new URLSearchParams(urlSearchParams.toString())
                                params.set('page', String(pagination.page - 1))
                                router.push(`/letters?${params.toString()}`)
                            }}
                        >
                            Sebelumnya
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={pagination.page >= pagination.totalPages}
                            onClick={() => {
                                const params = new URLSearchParams(urlSearchParams.toString())
                                params.set('page', String(pagination.page + 1))
                                router.push(`/letters?${params.toString()}`)
                            }}
                        >
                            Selanjutnya
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
