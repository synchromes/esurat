import { QuickSignWrapper } from '@/components/quick/QuickSignWrapper'

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params
    return <QuickSignWrapper token={token} />
}
