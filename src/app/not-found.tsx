import Link from 'next/link'
import { FileQuestion, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-muted/10 p-4">
            <div className="text-center space-y-6 max-w-md">
                <div className="flex justify-center">
                    <div className="bg-primary/10 p-6 rounded-full">
                        <FileQuestion className="h-16 w-16 text-primary" />
                    </div>
                </div>

                <div className="space-y-2">
                    <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl text-primary">404</h1>
                    <h2 className="text-2xl font-bold">Halaman Tidak Ditemukan</h2>
                    <p className="text-muted-foreground">
                        Maaf, halaman yang Anda cari tidak dapat ditemukan atau telah dipindahkan.
                    </p>
                </div>

                <div className="flex justify-center gap-4">
                    <Button asChild size="lg">
                        <Link href="/dashboard">
                            <Home className="mr-2 h-4 w-4" />
                            Kembali ke Dashboard
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    )
}
