'use client'

import { Suspense } from 'react'
import { Shield, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RolesList } from './roles-list'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'

export default function RolesPage() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Shield className="h-8 w-8" />
                        Kelola Role
                    </h1>
                    <p className="text-muted-foreground">
                        Kelola role dan permission sistem
                    </p>
                </div>
                <Button asChild>
                    <Link href="/admin/roles/create">
                        <Plus className="mr-2 h-4 w-4" />
                        Tambah Role
                    </Link>
                </Button>
            </div>

            {/* Roles List */}
            <Suspense fallback={<RolesListSkeleton />}>
                <RolesList />
            </Suspense>
        </div>
    )
}

function RolesListSkeleton() {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                    <CardContent className="p-6 space-y-4">
                        <Skeleton className="h-6 w-24" />
                        <Skeleton className="h-4 w-full" />
                        <div className="flex gap-2">
                            <Skeleton className="h-5 w-20" />
                            <Skeleton className="h-5 w-20" />
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
