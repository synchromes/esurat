import { getDispositionById } from '@/actions/dispositions'
import { notFound, redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { PrintDispatcher } from './print-dispatcher'
import { DispositionSheet } from '@/components/disposition/DispositionSheet'
import QRCode from 'qrcode'

import prisma from '@/lib/prisma'
import fs from 'fs'
import path from 'path'

export default async function PrintDispositionPage({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<{ mode?: string, secret?: string }> }) {
    const resolvedParams = await params
    const resolvedSearchParams = await searchParams
    const secret = resolvedSearchParams.secret
    const renderSecret = process.env.RENDER_SECRET || 'secret-render-key'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Read Logo as Base64
    const logoPath = path.join(process.cwd(), 'public', 'logo.png')
    let logoDataUrl = '/logo.png'
    try {
        if (fs.existsSync(logoPath)) {
            const logoBuffer = fs.readFileSync(logoPath)
            logoDataUrl = `data:image/png;base64,${logoBuffer.toString('base64')}`
        }
    } catch (e) {
        console.error('Error reading logo:', e)
    }

    let dispositionData = null

    // Check if authorized via secret (Machine to Machine)
    if (secret && secret === renderSecret) {
        dispositionData = await prisma.disposition.findUnique({
            where: { id: resolvedParams.id },
            include: {
                letter: {
                    select: {
                        id: true,
                        title: true,
                        letterNumber: true,
                        description: true,
                        status: true,
                        creator: { select: { name: true } }
                    }
                },
                fromUser: { select: { id: true, name: true, email: true } },
                recipients: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                teamMemberships: {
                                    include: {
                                        team: true
                                    }
                                }
                            }
                        }
                    }
                },
                instructions: {
                    include: {
                        instruction: { select: { id: true, name: true } }
                    },
                    orderBy: {
                        instruction: { sortOrder: 'asc' }
                    }
                }
            }
        })
    } else {
        // Authenticated User Access
        try {
            await requireAuth()
        } catch {
            redirect('/login')
        }

        const result = await getDispositionById(resolvedParams.id)
        if (result.success) {
            dispositionData = result.data
        }
    }

    if (!dispositionData) {
        notFound()
    }

    const qrLink = `${appUrl}/verify/disposition/${(dispositionData as any).qrHash || (dispositionData as any).id}`
    const qrDataUrl = await QRCode.toDataURL(qrLink, {
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 150
    })

    const isPdfMode = (await searchParams).mode === 'pdf'

    return (
        <div className="min-h-screen bg-white">
            <PrintDispatcher />
            <div className={`p-8 ${isPdfMode ? 'p-0 m-0 overflow-hidden' : 'print:p-0'}`}>
                {/* Scale down slightly to fit A4 perfectly with margins if needed */}
                <div style={isPdfMode ? { zoom: 0.85 } : {}}>
                    <DispositionSheet disposition={dispositionData} qrDataUrl={qrDataUrl} logoUrl={logoDataUrl} />
                </div>
            </div>
            {/* Helper message only visible on screen and if not PDF mode */}
            {!isPdfMode && (
                <div className="fixed bottom-4 right-4 bg-black/80 text-white px-4 py-2 rounded-full text-sm print:hidden">
                    Tekan Ctrl+P untuk mencetak jika dialog tidak muncul
                </div>
            )}
        </div>
    )
}
