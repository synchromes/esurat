import { notFound } from 'next/navigation'
import { getLetterById } from '@/actions/letters'
import { LetterDetail } from './letter-detail'

export default async function LetterDetailPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    const result = await getLetterById(id)

    if (!result.success || !result.data) {
        notFound()
    }

    return <LetterDetail letter={result.data} />
}
