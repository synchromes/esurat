import { Suspense } from 'react'
import Link from 'next/link'
import { Plus, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LettersList } from './letters-list'
import { LettersListSkeleton } from './letters-skeleton'

export default function LettersPage({
    searchParams
}: {
    searchParams: Promise<{ page?: string; status?: string; search?: string }>
}) {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <FileText className="h-8 w-8" />
                        Daftar Surat
                    </h1>
                    <p className="text-muted-foreground">
                        Kelola semua surat dan dokumen Anda
                    </p>
                </div>
                <Button asChild className="w-fit">
                    <Link href="/letters/create">
                        <Plus className="mr-2 h-4 w-4" />
                        Buat Surat Baru
                    </Link>
                </Button>
            </div>

            {/* Letters List */}
            <Suspense fallback={<LettersListSkeleton />}>
                <LettersList searchParamsPromise={searchParams} />
            </Suspense>
        </div>
    )
}
