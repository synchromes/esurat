import { getMyDispositions, getSentDispositions, getDispositionStats, getPendingNumberDispositions, getAllDispositions } from '@/actions/dispositions'
import { DispositionsClient } from './dispositions-client'
import { requirePermission, auth } from '@/lib/auth'
import { PERMISSIONS, hasPermission } from '@/lib/permissions'
import { redirect } from 'next/navigation'

export default async function DispositionsPage() {
    try {
        await requirePermission(PERMISSIONS.DISPOSITION_VIEW)
    } catch {
        redirect('/dashboard')
    }

    const session = await auth()
    const canCreate = await hasPermission(session?.user?.id as string, PERMISSIONS.DISPOSITION_CREATE)
    const canSetNumber = await hasPermission(session?.user?.id as string, PERMISSIONS.DISPOSITION_SET_NUMBER)
    const canViewAll = await hasPermission(session?.user?.id as string, PERMISSIONS.DISPOSITION_VIEW_ALL)

    const [receivedResult, sentResult, pendingResult, allResult, statsResult] = await Promise.all([
        getMyDispositions(),
        canCreate ? getSentDispositions() : Promise.resolve({ success: true, data: [] }),
        canSetNumber ? getPendingNumberDispositions() : Promise.resolve({ success: true, data: [] }),
        canViewAll ? getAllDispositions() : Promise.resolve({ success: true, data: [] }),
        getDispositionStats()
    ])

    return (
        <DispositionsClient
            receivedDispositions={(receivedResult.success && receivedResult.data) ? receivedResult.data : []}
            sentDispositions={(sentResult?.success && sentResult.data) ? sentResult.data : []}
            pendingNumberDispositions={(pendingResult?.success && pendingResult.data) ? pendingResult.data : []}
            allDispositions={(allResult?.success && allResult.data) ? allResult.data : []}
            stats={(statsResult.success && statsResult.data) ? statsResult.data : { pending: 0, read: 0, completed: 0, total: 0 }}
            canCreate={canCreate}
            canSetNumber={canSetNumber}
            canViewAll={canViewAll}
        />
    )
}
