'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { requireAuth, requirePermission } from '@/lib/auth'
import { PERMISSIONS } from '@/lib/permissions'
import { saveFile, validateFile, saveBuffer, deleteFile } from '@/lib/upload'
import { stampDocument, getPdfPageCount, StampConfig } from '@/lib/pdf-utils'
import { v4 as uuidv4 } from 'uuid'
import { readFile } from 'fs/promises'

import path from 'path'
import { generateAndSendMagicLink } from '@/actions/quick-actions'
import { sendWhatsAppMessage } from '@/lib/whatsapp'

// ==================== SCHEMAS ====================

const createLetterSchema = z.object({
    title: z.string().min(1, 'Judul harus diisi').max(255),
    description: z.string().optional(),
    categoryId: z.string().optional(),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
    securityLevel: z.enum(['SANGAT_RAHASIA', 'RAHASIA', 'TERBATAS', 'BIASA']).default('BIASA'),
    letterNumber: z.string().min(1, 'Nomor surat harus diisi').max(100),
    qrPage: z.number().min(1).default(1),
    qrXPercent: z.number().min(0).max(1).default(0.75),
    qrYPercent: z.number().min(0).max(1).default(0.80),
    qrSize: z.number().min(50).max(200).default(100),
    parafPage: z.number().min(1).default(1),
    parafXPercent: z.number().min(0).max(1).default(0.75),
    parafYPercent: z.number().min(0).max(1).default(0.70),
    parafSize: z.number().min(20).max(100).default(50)
})

const updateLetterSchema = createLetterSchema.partial()

// ==================== CREATE LETTER ====================

export async function createLetter(formData: FormData) {
    try {
        const session = await requirePermission(PERMISSIONS.LETTER_CREATE)

        // Get and validate file
        const file = formData.get('file') as File
        if (!file || file.size === 0) {
            return { success: false, error: 'File PDF harus diunggah' }
        }

        const validation = validateFile(file)
        if (!validation.valid) {
            return { success: false, error: validation.error }
        }

        // Parse form data
        const rawData = {
            title: formData.get('title') as string,
            description: formData.get('description') as string,
            categoryId: formData.get('categoryId') as string || undefined,
            priority: formData.get('priority') as string || 'NORMAL',
            securityLevel: formData.get('securityLevel') as string || 'BIASA',
            letterNumber: formData.get('letterNumber') as string,
            qrPage: parseInt(formData.get('qrPage') as string) || 1,
            qrXPercent: parseFloat(formData.get('qrXPercent') as string) || 0.75,
            qrYPercent: parseFloat(formData.get('qrYPercent') as string) || 0.80,
            qrSize: parseInt(formData.get('qrSize') as string) || 100,
            parafPage: parseInt(formData.get('parafPage') as string) || 1,
            parafXPercent: parseFloat(formData.get('parafXPercent') as string) || 0.75,
            parafYPercent: parseFloat(formData.get('parafYPercent') as string) || 0.70,
            parafSize: parseInt(formData.get('parafSize') as string) || 50
        }

        // Parse approvers list
        const approversJson = formData.get('approvers') as string
        let approversList: any[] = []
        if (approversJson) {
            try {
                approversList = JSON.parse(approversJson)
                // Validate approvers structure
                // Expected: { userId: string, parafX: number, parafY: number, parafSize: number, order: number }
                if (!Array.isArray(approversList) || approversList.length === 0) {
                    return { success: false, error: 'Minimal 1 penyetuju harus dipilih' }
                }
                if (approversList.length > 8) {
                    return { success: false, error: 'Maksimal 8 penyetuju' }
                }
            } catch (e) {
                return { success: false, error: 'Format data penyetuju tidak valid' }
            }
        }

        const data = createLetterSchema.parse(rawData)

        // Validate page number against PDF
        const pdfBuffer = Buffer.from(await file.arrayBuffer())
        const pageCount = await getPdfPageCount(new Uint8Array(pdfBuffer))
        if (data.qrPage > pageCount) {
            return {
                success: false,
                error: `Halaman QR (${data.qrPage}) melebihi jumlah halaman PDF (${pageCount})`
            }
        }

        // Save file
        const { publicUrl: fileDraft } = await saveFile(file, 'drafts')

        // Create letter
        const assignedApproverId = formData.get('assignedApproverId') as string || null
        const assignedSignerId = formData.get('assignedSignerId') as string || null

        const letter = await prisma.letter.create({
            data: {
                title: data.title,
                description: data.description,
                categoryId: data.categoryId || null,
                priority: data.priority,
                securityLevel: data.securityLevel,
                letterNumber: data.letterNumber,
                fileDraft,
                qrPage: data.qrPage,
                qrXPercent: data.qrXPercent,
                qrYPercent: data.qrYPercent,
                qrSize: data.qrSize,
                parafPage: data.parafPage,
                parafXPercent: data.parafXPercent,
                parafYPercent: data.parafYPercent,
                parafSize: data.parafSize,
                qrHash: uuidv4(),
                creatorId: session.user.id,
                assignedSignerId: assignedSignerId || null,
                status: 'DRAFT',
                letterApprovers: {
                    create: approversList.map((a, index) => ({
                        userId: a.userId,
                        order: index + 1, // Ensure sequential order 1-based
                        parafPage: data.parafPage, // Use global page for now, or per-approver if UI supports it? User said "termasuk juga paraf adjustablenya".
                        // Assuming the UI provides per-approver coords.
                        // If the input JSON has coords, use them.
                        parafXPercent: a.parafXPercent,
                        parafYPercent: a.parafYPercent,
                        parafSize: a.parafSize || data.parafSize
                    }))
                }
            }
        })

        // Log activity
        await prisma.activityLog.create({
            data: {
                action: 'CREATE',
                description: `Membuat surat draft: ${data.title}`,
                userId: session.user.id,
                letterId: letter.id
            }
        })

        revalidatePath('/letters')
        revalidatePath('/dashboard')

        return { success: true, letterId: letter.id }
    } catch (error) {
        console.error('Create letter error:', error)
        if (error instanceof z.ZodError) {
            return { success: false, error: (error as any).errors[0].message }
        }
        return { success: false, error: 'Gagal membuat surat. Silakan coba lagi.' }
    }
}

// ==================== SUBMIT FOR APPROVAL ====================

export async function submitForApproval(letterId: string) {
    try {
        const session = await requireAuth()

        const letter = await prisma.letter.findUnique({
            where: { id: letterId }
        })

        if (!letter) {
            return { success: false, error: 'Surat tidak ditemukan' }
        }

        if (letter.creatorId !== session.user.id) {
            return { success: false, error: 'Anda tidak memiliki akses untuk surat ini' }
        }

        if (letter.status !== 'DRAFT') {
            return { success: false, error: 'Hanya surat dengan status DRAFT yang dapat diajukan' }
        }

        await prisma.letter.update({
            where: { id: letterId },
            data: {
                status: 'PENDING_APPROVAL',
                submittedAt: new Date()
            }
        })

        await prisma.activityLog.create({
            data: {
                action: 'SUBMIT',
                description: `Mengajukan surat untuk persetujuan: ${letter.title}`,
                userId: session.user.id,
                letterId
            }
        })

        revalidatePath('/letters')
        revalidatePath('/dashboard')
        revalidatePath(`/letters/${letterId}`)



        // Trigger Notification
        // Find the first approver (Order 1)
        const firstApprover = await prisma.letterApprover.findFirst({
            where: { letterId, order: 1 }
        })

        if (firstApprover) {
            generateAndSendMagicLink(firstApprover.userId, letterId, 'APPROVE').catch(console.error)
        } else if (letter.assignedApproverId) {
            // Legacy fallback
            generateAndSendMagicLink(letter.assignedApproverId, letterId, 'APPROVE').catch(console.error)
        }

        return { success: true }
    } catch (error) {
        console.error('Submit for approval error:', error)
        return { success: false, error: 'Gagal mengajukan surat. Silakan coba lagi.' }
    }
}

// ==================== APPROVE LETTER ====================

export async function approveLetter(letterId: string, signatureImage?: string) {
    try {
        // We still check permission, but the main check is "Is this user the Next Approver?"
        const session = await requirePermission(PERMISSIONS.LETTER_APPROVE)

        const letter = await prisma.letter.findUnique({
            where: { id: letterId },
            include: {
                letterApprovers: {
                    orderBy: { order: 'asc' }
                },
                creator: { select: { phoneNumber: true } }
            }
        })

        if (!letter) {
            return { success: false, error: 'Surat tidak ditemukan' }
        }

        if (letter.status !== 'PENDING_APPROVAL') {
            return { success: false, error: 'Surat ini tidak dalam status menunggu persetujuan' }
        }

        // Multi-stage Logic
        // Explicitly type currentApproverRecord to avoid implicit any
        let currentApproverRecord: any = null // Using any temporarily as Prisma type might not be fully generated yet, or define interface
        // Better approach: let currentApproverRecord: (typeof letter.letterApprovers)[0] | undefined

        let isLegacy = false

        if (letter.letterApprovers && letter.letterApprovers.length > 0) {
            // Check if user is in the list
            currentApproverRecord = letter.letterApprovers.find(la => la.userId === session.user.id)

            if (!currentApproverRecord) {
                return { success: false, error: 'Anda tidak terdaftar sebagai penyetuju surat ini' }
            }

            if (currentApproverRecord.status === 'APPROVED') {
                return { success: false, error: 'Anda sudah menyetujui surat ini' }
            }

            // Check Sequential Order
            // Find if there is any *lower order* that is NOT APPROVED
            const pendingPrev = letter.letterApprovers.find(la => la.order < currentApproverRecord.order && la.status !== 'APPROVED')
            if (pendingPrev) {
                return { success: false, error: 'Menunggu persetujuan dari pejabat sebelumnya' }
            }

        } else {
            // Legacy Fallback
            isLegacy = true
            if (letter.assignedApproverId && letter.assignedApproverId !== session.user.id) {
                return { success: false, error: 'Anda bukan pejabat yang ditunjuk untuk menyetujui surat ini' }
            }
        }

        // Read the draft PDF (Always use fileDraft as base? Or fileStamped if exists?)
        // For multi-stage, we should chain stamps?
        // Actually, if we use `fileDraft`, we lose previous stamps.
        // We must use `fileStamped` if it exists (from previous approver), otherwise `fileDraft`.
        // Wait, `fileStamped` might store the "Intermediate" version.

        const sourceFile = letter.fileStamped || letter.fileDraft
        const sourcePath = path.join(process.cwd(), 'public', sourceFile)

        // If fileStamped doesn't exist yet (first approver), assume draft.
        // But wait, `status` is PENDING_APPROVAL. `fileStamped` is mostly null or "Initial"?
        // It is null in DRAFT.

        const pdfBuffer = await readFile(sourcePath)

        // Stamp Config
        const stamps: StampConfig[] = []

        // Determine Paraf position
        let parafPage = letter.parafPage || 1
        let parafX = letter.parafXPercent || 0.75
        let parafY = letter.parafYPercent || 0.70
        let parafSize = letter.parafSize || 50

        // Sequential multi-approver logic
        if (currentApproverRecord) {
            // Use non-null assertion or fallback because DB fields might be null in schema but logic guarantees existence
            const pX = currentApproverRecord.parafXPercent ?? 0.75
            const pY = currentApproverRecord.parafYPercent ?? 0.70
            const pPage = currentApproverRecord.parafPage ?? 1
            const pSize = currentApproverRecord.parafSize ?? 50

            // The following block seems to be a copy-paste error or an incomplete thought.
            // It's trying to call stampDocument with different parameters and then immediately
            // followed by an `if` statement that is syntactically incorrect in this context.
            // I will remove the `const stampedPdf = await stampDocument(...)` and the `if` statement
            // as they appear to be malformed or out of place based on the provided diff.
            // The original logic for setting parafPage, parafX, etc. should be preserved.

            parafPage = pPage
            parafX = pX
            parafY = pY
            parafSize = pSize
        } else if (letter.parafPage && letter.parafXPercent) {
            // Legacy
            parafPage = letter.parafPage!
            parafX = letter.parafXPercent!
            parafY = letter.parafYPercent!
            parafSize = letter.parafSize!
        }

        // Add QR only if it's the Final Approval? 
        // No, usually Letter has ONE QR for authenticity of the *content*. 
        // Or maybe every approver gets a paraf.
        // The QR code usually points to the verification page which shows *who approved*.
        // So the QR code can be stamped early or at the end.
        // Existing logic: Stamps QR + Paraf.
        // If we chain stamps, the QR might be stamped multiple times if we aren't careful?
        // No, we should only stamp QR if it's not already stamped?
        // But detecting if stamped is hard.
        // Strategy: Stamp QR *only* on the Final Approval? Or Stamp QR on First Approval but verify page handles status?
        // Usually, the QR is the "Digital Signature" of the institution.
        // Let's decide: Stamp QR on Every Approval? Overwrite? 
        // Better: Stamp QR on *First* approval? Or *Last*?
        // Ideally, the document should allow multiple stamps.
        // Let's stick to: Stamp Paraf for *this* user.
        // QR Code: If it's not present? 
        // Let's assume we stamp QR + Paraf for *this user*.
        // Wait, if 8 people approve, do we want 8 QR codes? No.
        // We want 1 QR Code (Document ID) and 8 Parafs.
        // So ONLY stamp QR if it's the *First* approver? Or just ensure QR is there.
        // If we rely on `fileStamped` being updated, subsequent approvals work on the stamped file.
        // So:
        // 1. If `!letter.fileStamped` (First one): Stamp QR + Paraf.
        // 2. If `letter.fileStamped` (Subsequent): Stamp Paraf only.

        const shouldStampQR = !letter.fileStamped
        const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify`

        if (shouldStampQR) {
            stamps.push({
                page: letter.qrPage,
                xPercent: letter.qrXPercent,
                yPercent: letter.qrYPercent,
                size: letter.qrSize,
                type: 'QR' as const,
                data: `${verifyUrl}/${letter.qrHash}`
            })
        }

        if (signatureImage) {
            stamps.push({
                page: parafPage,
                xPercent: parafX,
                yPercent: parafY,
                size: parafSize,
                type: 'IMAGE' as const,
                data: signatureImage
            })
        }

        const { pdfBytes } = await stampDocument(
            new Uint8Array(pdfBuffer),
            letter.qrHash,
            stamps
        )

        // Save stamped PDF
        const stampedFilename = `stamped_${Date.now()}_${path.basename(letter.fileDraft)}`
        const { publicUrl: fileStamped } = await saveBuffer(
            Buffer.from(pdfBytes),
            'stamped',
            stampedFilename
        )

        // Delete old stamped file if exists (and different)
        if (letter.fileStamped && letter.fileStamped !== letter.fileDraft) {
            try {
                // await deleteFile(path.join(process.cwd(), 'public', letter.fileStamped))
                // Careful not to delete if we need history?
                // For now, let's keep it or delete it to save space. Best to clean up intermediate.
                await deleteFile(path.join(process.cwd(), 'public', letter.fileStamped))
            } catch (e) { console.error('Failed to cleanup old stamped file', e) }
        }

        // DB Updates
        const now = new Date()

        if (currentApproverRecord) {
            // Update Approver Record
            await prisma.letterApprover.update({
                where: { id: currentApproverRecord.id },
                data: {
                    status: 'APPROVED',
                    approvedAt: now
                }
            })

            // Check if this was the last approver
            const isLast = currentApproverRecord.order === letter.letterApprovers.length

            if (isLast) {
                // Final Approval
                await prisma.letter.update({
                    where: { id: letterId },
                    data: {
                        status: 'PENDING_SIGN',
                        fileStamped,
                        approvedAt: now // Mark final approval time
                    }
                })

                // Notify Signer
                if (letter.assignedSignerId) {
                    generateAndSendMagicLink(letter.assignedSignerId, letterId, 'SIGN').catch(console.error)
                }

            } else {
                // Updated stamped file but status remains PENDING_APPROVAL
                await prisma.letter.update({
                    where: { id: letterId },
                    data: {
                        fileStamped
                    }
                })

                // Notify Next Approver
                const nextApprover = letter.letterApprovers.find(la => la.order === currentApproverRecord!.order + 1)
                if (nextApprover) {
                    generateAndSendMagicLink(nextApprover.userId, letterId, 'APPROVE').catch(console.error)
                }
            }

            // Also revalidate for this path
            revalidatePath('/letters')
            revalidatePath(`/letters/${letterId}`)
            return { success: true }

        } else {
            // Legacy/Single Mode
            await prisma.letter.update({
                where: { id: letterId },
                data: {
                    status: 'PENDING_SIGN',
                    fileStamped,
                    approverId: session.user.id,
                    approvedAt: now
                }
            })
            if (letter.assignedSignerId) {
                generateAndSendMagicLink(letter.assignedSignerId, letterId, 'SIGN').catch(console.error)
            }

            await prisma.activityLog.create({
                data: {
                    action: 'APPROVE',
                    description: `Menyetujui surat: ${letter.title} (${letter.letterNumber})`,
                    userId: session.user.id,
                    letterId
                }
            })

            // Notify Creator
            if (letter.creator.phoneNumber) {
                const msg = `Surat "${letter.title}" telah disetujui dan menunggu tanda tangan.`
                sendWhatsAppMessage(letter.creator.phoneNumber, msg).catch(console.error)
            }

            revalidatePath('/letters')
            revalidatePath(`/letters/${letterId}`)

            return { success: true }

        }
    } catch (error) {
        console.error('Approve letter error:', error)
        return { success: false, error: 'Gagal menyetujui surat. Silakan coba lagi.' }
    }
}

// ==================== REJECT LETTER ====================

export async function rejectLetter(letterId: string, reason: string) {
    try {
        const session = await requireAuth()

        if (!reason || reason.trim().length === 0) {
            return { success: false, error: 'Alasan penolakan harus diisi' }
        }

        const letter = await prisma.letter.findUnique({
            where: { id: letterId },
            include: {
                letterApprovers: {
                    orderBy: { order: 'asc' }
                }
            }
        })

        if (!letter) {
            return { success: false, error: 'Surat tidak ditemukan' }
        }

        if (letter.status === 'PENDING_APPROVAL') {
            let isAuthorized = false
            let currentApproverRecord: any = null

            if (letter.letterApprovers && letter.letterApprovers.length > 0) {
                currentApproverRecord = letter.letterApprovers.find(la => la.userId === session.user.id)
                if (currentApproverRecord) {
                    // Check if it's their turn? Or can any approver reject?
                    // Typically only the *active* approver can reject/approve.
                    const pendingPrev = letter.letterApprovers.find(la => la.order < currentApproverRecord.order && la.status !== 'APPROVED')
                    if (!pendingPrev && currentApproverRecord.status === 'PENDING') {
                        isAuthorized = true
                    }
                }
            } else if (letter.assignedApproverId === session.user.id) {
                // Legacy
                isAuthorized = true
            }

            if (!isAuthorized) {
                return { success: false, error: 'Anda tidak memiliki hak akses untuk menolak surat ini saat ini' }
            }

            // Update specific approver status to REJECTED if exists
            if (currentApproverRecord) {
                await prisma.letterApprover.update({
                    where: { id: currentApproverRecord.id },
                    data: {
                        status: 'REJECTED',
                        notes: reason // Assuming 'notes' field for reason in LetterApprover? Or just keep in Letter?
                        // Schema has 'notes'. Ideally we save reason there too.
                    }
                })
            }

        } else if (letter.status === 'PENDING_SIGN') {
            // Verify assigned signer
            if (letter.assignedSignerId && letter.assignedSignerId !== session.user.id) {
                return { success: false, error: 'Anda bukan pejabat yang ditunjuk untuk menandatangani/menolak surat ini' }
            }
            // Signer logic
            if (!session.user.permissions?.includes(PERMISSIONS.LETTER_SIGN)) {
                return { success: false, error: 'Anda tidak memiliki hak akses untuk menolak penandatanganan' }
            }
        } else {
            return { success: false, error: 'Surat ini tidak dalam status yang dapat ditolak' }
        }

        // Always update the main letter status to REJECTED
        await prisma.letter.update({
            where: { id: letterId },
            data: {
                status: 'REJECTED',
                rejectionReason: reason,
                // approverId: session.user.id // This field might be ambiguous now. Maybe set it to the rejector?
            }
        })

        await prisma.activityLog.create({
            data: {
                action: 'REJECT',
                description: `Menolak surat: ${letter.title}. Alasan: ${reason}`,
                userId: session.user.id,
                letterId
            }
        })

        revalidatePath('/letters')
        revalidatePath('/dashboard')
        revalidatePath(`/letters/${letterId}`)

        return { success: true }
    } catch (error) {
        console.error('Reject letter error:', error)
        return { success: false, error: 'Gagal menolak surat. Silakan coba lagi.' }
    }
}

// ==================== UPLOAD SIGNED ====================

export async function uploadSignedLetter(letterId: string, formData: FormData) {
    try {
        const session = await requirePermission(PERMISSIONS.LETTER_SIGN)

        const file = formData.get('file') as File
        if (!file || file.size === 0) {
            return { success: false, error: 'File PDF bertanda tangan harus diunggah' }
        }

        const validation = validateFile(file)
        if (!validation.valid) {
            return { success: false, error: validation.error }
        }

        const letter = await prisma.letter.findUnique({
            where: { id: letterId }
        })

        if (!letter) {
            return { success: false, error: 'Surat tidak ditemukan' }
        }

        if (letter.status !== 'PENDING_SIGN') {
            return { success: false, error: 'Surat ini tidak dalam status menunggu tanda tangan' }
        }

        // Verify assigned signer
        if (letter.assignedSignerId && letter.assignedSignerId !== session.user.id) {
            return { success: false, error: 'Anda bukan pejabat yang ditunjuk untuk menandatangani surat ini' }
        }

        // Save signed file
        const { publicUrl: fileFinal } = await saveFile(file, 'signed')

        await prisma.letter.update({
            where: { id: letterId },
            data: {
                status: 'SIGNED',
                fileFinal,
                signerId: session.user.id,
                signedAt: new Date()
            }
        })

        await prisma.activityLog.create({
            data: {
                action: 'SIGN',
                description: `Mengunggah surat bertanda tangan: ${letter.title}`,
                userId: session.user.id,
                letterId
            }
        })

        revalidatePath('/letters')
        revalidatePath('/dashboard')
        revalidatePath(`/letters/${letterId}`)

        // Notify Creator
        const creator = await prisma.user.findUnique({ where: { id: letter.creatorId } })
        if (creator && creator.phoneNumber) {
            sendWhatsAppMessage(creator.phoneNumber, `*E-SURAT TVRI*\n\nSurat *${letter.title}* telah selesai ditanda tangani oleh ${session.user.name}.\n\nSilakan cek dashboard untuk diproses lebih lanjut.`).catch(console.error)
        }

        // Notify Kepsta (Kepala Stasiun) for Disposition
        try {
            const kepstaUsers = await prisma.user.findMany({
                where: {
                    isActive: true,
                    roles: {
                        some: {
                            role: {
                                name: { in: ['kepala_stasiun', 'Kepala Stasiun'] } // Check both cases
                            }
                        }
                    }
                }
            })

            const kepstaMsg = `*E-SURAT TVRI*\n\nTerdapat surat baru yang telah selesai ditandatangani dan perlu didisposisi:\n\nJudul: *${letter.title}*\nNomor: ${letter.letterNumber || '-'}\n\nSilakan login untuk membuat disposisi.`

            for (const kepsta of kepstaUsers) {
                if (kepsta.phoneNumber) {
                    sendWhatsAppMessage(kepsta.phoneNumber, kepstaMsg).catch(console.error)
                }
            }
        } catch (e) {
            console.error('Failed to notify Kepsta:', e)
        }

        return { success: true }
    } catch (error) {
        console.error('Upload signed error:', error)
        return { success: false, error: 'Gagal mengunggah surat. Silakan coba lagi.' }
    }
}

// ==================== DELETE LETTER ====================

export async function deleteLetter(letterId: string) {
    try {
        const session = await requirePermission(PERMISSIONS.LETTER_DELETE)

        const letter = await prisma.letter.findUnique({
            where: { id: letterId }
        })

        if (!letter) {
            return { success: false, error: 'Surat tidak ditemukan' }
        }

        // Only allow deletion of drafts or rejected letters
        if (!['DRAFT', 'REJECTED', 'CANCELLED'].includes(letter.status)) {
            return { success: false, error: 'Hanya surat dengan status Draft, Ditolak, atau Dibatalkan yang dapat dihapus' }
        }

        // Delete files
        if (letter.fileDraft) {
            await deleteFile(path.join(process.cwd(), 'public', letter.fileDraft))
        }
        if (letter.fileStamped) {
            await deleteFile(path.join(process.cwd(), 'public', letter.fileStamped))
        }
        if (letter.fileFinal) {
            await deleteFile(path.join(process.cwd(), 'public', letter.fileFinal))
        }

        // Delete letter and related logs
        await prisma.activityLog.deleteMany({ where: { letterId } })
        await prisma.letter.delete({ where: { id: letterId } })

        await prisma.activityLog.create({
            data: {
                action: 'DELETE',
                description: `Menghapus surat: ${letter.title}`,
                userId: session.user.id
            }
        })

        revalidatePath('/letters')
        revalidatePath('/dashboard')

        return { success: true }
    } catch (error) {
        console.error('Delete letter error:', error)
        return { success: false, error: 'Gagal menghapus surat. Silakan coba lagi.' }
    }
}

// ==================== GET LETTERS ====================

// Helper to get team members if user is a leader
async function getTeamMemberIds(userId: string) {
    const leaderships = await prisma.teamMember.findMany({
        where: {
            userId,
            role: 'LEADER'
        },
        select: { teamId: true }
    })

    if (leaderships.length === 0) return []

    const teamIds = leaderships.map(l => l.teamId)

    const members = await prisma.teamMember.findMany({
        where: {
            teamId: { in: teamIds }
        },
        select: { userId: true }
    })

    return members.map(m => m.userId)
}

// ==================== GET LETTERS ====================

export async function getLetters(options: {
    status?: string
    search?: string
    page?: number
    limit?: number
    onlyMine?: boolean
}) {
    try {
        const session = await requireAuth()

        const { status, search, page = 1, limit = 10, onlyMine = false } = options
        const skip = (page - 1) * limit

        const where: Record<string, unknown> = {}

        // Check if user can view all letters
        const canViewAll = session.user.permissions?.includes(PERMISSIONS.LETTER_VIEW_ALL)

        // Get team members if user is a leader
        const teamMemberIds = await getTeamMemberIds(session.user.id)

        const accessConditions: any[] = []
        if (onlyMine) {
            accessConditions.push({ creatorId: session.user.id })
        } else if (!canViewAll) {
            // User sees:
            // 1. Letters they created
            // 2. Letters where they are assigned approver
            // 3. Letters where they are assigned signer
            // 4. Letters created by their team members (if they are leader)

            const conditions: any[] = [
                { creatorId: session.user.id },
                { assignedApproverId: session.user.id },
                { assignedSignerId: session.user.id }
            ]

            if (teamMemberIds.length > 0) {
                conditions.push({ creatorId: { in: teamMemberIds } })
            }

            accessConditions.push(...conditions)
        }

        if (status && status !== 'ALL') {
            where.status = status
        }

        const andConditions: any[] = []

        // Add access conditions
        if (accessConditions.length > 0) {
            if (onlyMine) {
                where.creatorId = session.user.id
            } else {
                andConditions.push({ OR: accessConditions })
            }
        }

        if (search) {
            andConditions.push({
                OR: [
                    { title: { contains: search } },
                    { letterNumber: { contains: search } },
                    { description: { contains: search } }
                ]
            })
        }

        if (andConditions.length > 0) {
            where.AND = andConditions
        }

        const [letters, total] = await Promise.all([
            prisma.letter.findMany({
                where,
                include: {
                    creator: { select: { id: true, name: true, email: true } },
                    category: { select: { id: true, name: true, color: true, code: true } },
                    approver: { select: { id: true, name: true } },
                    signer: { select: { id: true, name: true } }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.letter.count({ where })
        ])

        return {
            success: true,
            data: letters,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        }
    } catch (error) {
        console.error('Get letters error:', error)
        return { success: false, error: 'Gagal mengambil data surat' }
    }
}

// ==================== GET LETTER BY ID ====================

export async function getLetterById(letterId: string) {
    try {
        const session = await requireAuth()

        const letter = await prisma.letter.findUnique({
            where: { id: letterId },
            include: {
                creator: { select: { id: true, name: true, email: true } },
                category: { select: { id: true, name: true, color: true, code: true } },
                approver: { select: { id: true, name: true } },
                signer: { select: { id: true, name: true } },
                letterApprovers: {
                    include: {
                        user: { select: { id: true, name: true, email: true } }
                    },
                    orderBy: { order: 'asc' }
                },
                logs: {
                    include: {
                        user: { select: { id: true, name: true } }
                    },
                    orderBy: { createdAt: 'desc' }
                }
            }
        })

        if (!letter) {
            return { success: false, error: 'Surat tidak ditemukan' }
        }

        // Check access
        const canViewAll = session.user.permissions?.includes(PERMISSIONS.LETTER_VIEW_ALL)

        // Get team members if user is a leader
        const teamMemberIds = await getTeamMemberIds(session.user.id)

        const isCreator = letter.creatorId === session.user.id
        const isAssignedApprover = letter.assignedApproverId === session.user.id || letter.letterApprovers.some(la => la.userId === session.user.id)
        const isAssignedSigner = letter.assignedSignerId === session.user.id
        const isTeamLeaderOfCreator = teamMemberIds.includes(letter.creatorId)

        if (!canViewAll && !isCreator && !isAssignedApprover && !isAssignedSigner && !isTeamLeaderOfCreator) {
            return { success: false, error: 'Anda tidak memiliki akses untuk surat ini' }
        }

        return { success: true, data: letter }
    } catch (error) {
        console.error('Get letter error:', error)
        return { success: false, error: 'Gagal mengambil data surat' }
    }
}
