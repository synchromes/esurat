import { QuickDispositionUploadWrapper } from '@/components/quick/QuickDispositionUploadWrapper'

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params
    return <QuickDispositionUploadWrapper token={token} />
}
