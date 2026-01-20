import { getDispositionById } from '@/actions/dispositions'
import { DispositionDetailClient } from './disposition-detail-client' // We'll create this next
import { notFound, redirect } from 'next/navigation'
import { requirePermission, auth } from '@/lib/auth'
import { PERMISSIONS, hasPermission } from '@/lib/permissions'

export default async function DispositionDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = await params
    try {
        await requirePermission(PERMISSIONS.DISPOSITION_VIEW)
    } catch {
        redirect('/dashboard')
    }

    const result = await getDispositionById(resolvedParams.id)

    if (!result.success || !result.data) {
        notFound()
    }

    const session = await auth()
    const canSetNumber = await hasPermission(session?.user?.id as string, PERMISSIONS.DISPOSITION_SET_NUMBER)

    return <DispositionDetailClient disposition={result.data as any} canSetNumber={canSetNumber} />
}
