import { QuickApproveWrapper } from '@/components/quick/QuickApproveWrapper'

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params
    return <QuickApproveWrapper token={token} />
}
