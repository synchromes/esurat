import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

export function LettersListSkeleton() {
    return (
        <div className="space-y-4">
            {/* Filter skeleton */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center">
                        <Skeleton className="h-10 flex-1" />
                        <div className="flex gap-2">
                            <Skeleton className="h-10 w-[180px]" />
                            <Skeleton className="h-10 w-20" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* List skeleton */}
            <Card>
                <CardContent className="p-0 divide-y">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-4 p-4">
                            <Skeleton className="h-5 w-5 rounded" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-2/3" />
                                <Skeleton className="h-3 w-1/3" />
                            </div>
                            <div className="flex gap-2">
                                <Skeleton className="h-6 w-20 rounded-full" />
                                <Skeleton className="h-8 w-8 rounded" />
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    )
}
