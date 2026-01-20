import { Metadata } from 'next'
import { requirePermission } from '@/lib/auth'
import { PERMISSIONS } from '@/lib/permissions'
import WhatsAppSettingsClient from './whatsapp-settings-client'

export const metadata: Metadata = {
    title: 'Whatsapp Settings | E-Surat TVRI',
    description: 'Kelola koneksi Whatsapp Gateway'
}

export default async function WhatsappSettingsPage() {
    await requirePermission(PERMISSIONS.SETTINGS_VIEW)

    return <WhatsAppSettingsClient />
}
