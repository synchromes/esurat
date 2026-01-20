import { Metadata } from 'next'
import { TemplatesClient } from './templates-client'
import { getTemplates } from '@/actions/templates'
import { requirePermission } from '@/lib/auth'
import { PERMISSIONS } from '@/lib/permissions'

export const metadata: Metadata = {
    title: 'Template Surat | E-Surat',
    description: 'Kumpulan template surat dinas'
}

export default async function TemplatesPage() {
    // Ensure user has permission to view
    await requirePermission(PERMISSIONS.TEMPLATE_VIEW)

    const { data: templates, canManage } = await getTemplates()

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Template Surat</h2>
                    <p className="text-muted-foreground">
                        Unduh template surat dinas untuk memudahkan pembuatan dokumen.
                    </p>
                </div>
            </div>

            <TemplatesClient initialTemplates={templates || []} canManage={!!canManage} />
        </div>
    )
}
