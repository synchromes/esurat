import { Suspense } from 'react'
import { Users, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { TeamsList } from './teams-list'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata = {
    title: 'Kelola Tim | E-Surat Digital'
}

function TeamsListSkeleton() {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-48 rounded-lg" />
            ))}
        </div>
    )
}

export default function TeamsPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <Users className="h-8 w-8" />
                        Kelola Tim
                    </h1>
                    <p className="text-muted-foreground">
                        Kelola tim dan anggota dalam organisasi
                    </p>
                </div>
                <Button asChild>
                    <Link href="/admin/teams/create">
                        <Plus className="mr-2 h-4 w-4" />
                        Tambah Tim
                    </Link>
                </Button>
            </div>

            <Suspense fallback={<TeamsListSkeleton />}>
                <TeamsList />
            </Suspense>
        </div>
    )
}
