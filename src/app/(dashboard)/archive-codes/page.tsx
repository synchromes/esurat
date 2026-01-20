import { Metadata } from 'next'
import { ArchiveCodesClient } from './archive-codes-client'
import { getArchiveCodes } from '@/actions/archive-codes'
import { requirePermission } from '@/lib/auth'
import { PERMISSIONS } from '@/lib/permissions'

export const metadata: Metadata = {
    title: 'Kode Arsip | E-Surat',
    description: 'Manajemen kode klasifikasi arsip'
}

export default async function ArchiveCodesPage() {
    await requirePermission(PERMISSIONS.ARCHIVE_CODE_VIEW)

    const { data: codes, canManage } = await getArchiveCodes()

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Kode Arsip</h2>
                    <p className="text-muted-foreground">
                        Daftar kode klasifikasi arsip surat dinas.
                    </p>
                </div>
            </div>

            <ArchiveCodesClient initialCodes={codes || []} canManage={!!canManage} />
        </div>
    )
}
