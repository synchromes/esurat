import { redirect } from 'next/navigation'
import { Settings as SettingsIcon, Save } from 'lucide-react'

import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/permissions'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { SettingsForm } from './settings-form'
// remove unused updateSettings import since it's used in client component now, or keep if server action is okay to pass?
// Actually updateSettings is used in settings-form, so we don't need it here.

export const metadata = {
    title: 'Pengaturan | E-Surat',
    description: 'Konfigurasi sistem',
}

export default async function SettingsPage() {
    const session = await auth()
    if (!session) redirect('/login')

    // Check permission
    const hasPermission = await prisma.rolePermission.count({
        where: {
            role: { users: { some: { userId: session.user.id } } },
            permission: { name: PERMISSIONS.SETTINGS_EDIT }
        }
    })

    if (!hasPermission) {
        redirect('/dashboard')
    }

    // Load settings
    const settings = await prisma.setting.findMany({
        orderBy: { key: 'asc' }
    })

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4">
                <h1 className="text-2xl font-bold tracking-tight">Pengaturan Sistem</h1>
                <p className="text-muted-foreground">
                    Konfigurasi variabel global sistem
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <SettingsIcon className="h-5 w-5" />
                        Daftar Variabel
                    </CardTitle>
                    <CardDescription>
                        Kelola key dan value konfigurasi aplikasi
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <SettingsForm settings={settings} />
                </CardContent>
            </Card>
        </div>
    )
}
