'use client'

import { Suspense } from 'react'
import { Users, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UsersList } from './users-list'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'

export default function UsersPage() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Users className="h-8 w-8" />
                        Kelola Pengguna
                    </h1>
                    <p className="text-muted-foreground">
                        Kelola akun pengguna dan penetapan role
                    </p>
                </div>
                <Button asChild>
                    <Link href="/admin/users/create">
                        <Plus className="mr-2 h-4 w-4" />
                        Tambah Pengguna
                    </Link>
                </Button>
            </div>

            {/* Users List */}
            <Suspense fallback={<UsersListSkeleton />}>
                <UsersList />
            </Suspense>
        </div>
    )
}

function UsersListSkeleton() {
    return (
        <Card>
            <CardContent className="p-0 divide-y">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-4">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-1/3" />
                            <Skeleton className="h-3 w-1/4" />
                        </div>
                        <Skeleton className="h-6 w-20" />
                    </div>
                ))}
            </CardContent>
        </Card>
    )
}
