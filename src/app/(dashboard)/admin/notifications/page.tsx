import { Metadata } from 'next'
import NotificationsClient from './notifications-client'

export const metadata: Metadata = {
    title: 'Pengaturan Notifikasi | E-Surat',
    description: 'Kelola WhatsApp multi-session dan Telegram bot monitoring'
}

export default function NotificationsPage() {
    return (
        <div className="container mx-auto py-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold">Pengaturan Notifikasi</h1>
                <p className="text-muted-foreground">
                    Kelola WhatsApp multi-session dan integrasi Telegram Bot untuk monitoring
                </p>
            </div>
            <NotificationsClient />
        </div>
    )
}
