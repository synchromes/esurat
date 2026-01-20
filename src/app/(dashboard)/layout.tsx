import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { Sidebar, Header } from '@/components/layout'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await auth()

    if (!session?.user) {
        redirect('/login')
    }

    return (
        <div className="min-h-screen bg-background">
            <Sidebar />
            <div className="lg:pl-64 pl-0 transition-all duration-300">
                <Header />
                <main className="p-4 md:p-6 lg:p-8">
                    {children}
                </main>
            </div>
        </div>
    )
}
