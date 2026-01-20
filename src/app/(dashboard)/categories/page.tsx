import { Metadata } from 'next'
import { CategoriesClient } from './categories-client'
import { getCategories } from '@/actions/categories'
import { requirePermission } from '@/lib/auth'
import { PERMISSIONS } from '@/lib/permissions'

export const metadata: Metadata = {
    title: 'Kategori Surat | E-Surat',
    description: 'Manajemen kategori surat dinas'
}

export default async function CategoriesPage() {
    await requirePermission(PERMISSIONS.CATEGORY_VIEW)

    const { data: categories, canManage } = await getCategories()

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Kategori Surat</h2>
                    <p className="text-muted-foreground">
                        Daftar klasifikasi surat dinas.
                    </p>
                </div>
            </div>

            <CategoriesClient initialCategories={categories || []} canManage={!!canManage} />
        </div>
    )
}
