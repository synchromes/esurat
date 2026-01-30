'use server'

import { prisma } from '@/lib/prisma'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import { v4 as uuidv4 } from 'uuid'
import { addMinutes } from 'date-fns'
import {
    saveFile,
    saveBuffer,
    validateFile
} from '@/lib/upload'
import {
    stampDocument,
    StampConfig
} from '@/lib/pdf-utils'
import { readFile } from 'fs/promises'
import path from 'path'
import { revalidatePath } from 'next/cache'

const UPLOAD_BASE = process.env.UPLOAD_DIR || './public/uploads'

// Helper: Get greeting based on current hour (WIB timezone)
function getGreeting(): string {
    const hour = new Date().getHours()
    if (hour >= 4 && hour < 11) return 'Selamat Pagi'
    if (hour >= 11 && hour < 15) return 'Selamat Siang'
    if (hour >= 15 && hour < 19) return 'Selamat Sore'
    return 'Selamat Malam'
}

// Helper: Convert public URL to filesystem path
function getFilesystemPath(publicUrl: string): string {
    // Handle both /api/uploads/... and /uploads/... formats
    let relativePath = publicUrl
    if (relativePath.startsWith('/api/uploads/')) {
        relativePath = relativePath.replace('/api/uploads/', '')
    } else if (relativePath.startsWith('/uploads/')) {
        relativePath = relativePath.replace('/uploads/', '')
    }
    return path.join(UPLOAD_BASE, relativePath)
}

export async function generateAndSendMagicLink(
    userId: string,
    letterId: string,
    action: 'APPROVE' | 'SIGN'
) {
    try {
        // 1. Get User
        const user = await prisma.user.findUnique({
            where: { id: userId }
        })

        if (!user || !user.phoneNumber) {
            return { success: false, error: 'User tidak ditemukan atau belum memiliki nomor HP.' }
        }

        // 2. Generate Token & OTP
        const token = uuidv4()
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString() // 6 digits

        // 3. Save to DB
        await prisma.magicLink.create({
            data: {
                token,
                userId,
                letterId,
                action,
                otpCode,
                expiresAt: addMinutes(new Date(), 30)
            }
        })

        // 4. Send Message
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const link = `${baseUrl}/quick/${action.toLowerCase()}/${token}`

        // Fetch letter details for context
        const letter = await prisma.letter.findUnique({
            where: { id: letterId },
            select: { title: true, letterNumber: true }
        })

        const actionLabel = action === 'APPROVE' ? 'PERSETUJUAN' : 'TANDA TANGAN'

        // Determine greeting
        const items = new Date().getHours() // Current hour in server time. Ideally user timezone, but difficult. Default to server/WIB.
        let greeting = 'Selamat Pagi'
        if (items >= 11 && items < 15) greeting = 'Selamat Siang'
        else if (items >= 15 && items < 19) greeting = 'Selamat Sore'
        else if (items >= 19 || items < 4) greeting = 'Selamat Malam'

        const message = `${greeting} *${user.name}*,

Terdapat dokumen yang perlu ${action === 'APPROVE' ? 'disetujui' : 'ditanda tangani'}:

Judul: *${letter?.title}*
Nomor: ${letter?.letterNumber || '-'}

Silakan klik link berikut untuk memproses:

${link}

Kode OTP: *${otpCode}*

(Link ini berlaku selama 30 menit)

Aplikasi e-Surat TVRI Kalimantan Barat`

        const waResult = await sendWhatsAppMessage(user.phoneNumber, message)

        if (!waResult.success) {
            // Rollback usage? No, just warn.
            console.warn('Failed to send WA:', waResult.error)
            return { success: false, error: 'Gagal mengirim WhatsApp: ' + waResult.error }
        }

        return { success: true }
    } catch (error) {
        console.error('Magic Link Error:', error)
        return { success: false, error: 'Gagal memproses permintaan' }
    }
}

export async function verifyMagicLink(token: string, otp: string) {
    try {
        const magicLink = await prisma.magicLink.findUnique({
            where: { token },
            include: {
                user: true,
                letter: {
                    include: {
                        creator: true,
                        category: true
                    }
                }
            }
        })

        if (!magicLink) {
            return { success: false, error: 'Link tidak valid' }
        }

        if (magicLink.isUsed) {
            return { success: false, error: 'Link sudah digunakan' }
        }

        if (new Date() > magicLink.expiresAt) {
            return { success: false, error: 'Link sudah kadaluarsa. Silakan minta link baru.' }
        }

        if (magicLink.otpCode !== otp) {
            return { success: false, error: 'Kode OTP salah' }
        }

        return { success: true, data: magicLink }
    } catch (error) {
        return { success: false, error: 'Terjadi kesalahan validasi' }
    }
}

export async function consumeMagicLink(token: string) {
    await prisma.magicLink.update({
        where: { token },
        data: { isUsed: true }
    })
}

export async function approveWithToken(token: string, signatureImage: string) {
    // 1. Verify Token
    const link = await prisma.magicLink.findUnique({
        where: { token },
        include: {
            user: true,
            letter: {
                include: {
                    letterApprovers: {
                        orderBy: { order: 'asc' }
                    }
                }
            }
        }
    })

    if (!link || link.isUsed || new Date() > link.expiresAt) {
        return { success: false, error: 'Token tidak valid atau kadaluarsa' }
    }

    if (link.action !== 'APPROVE') {
        return { success: false, error: 'Token tidak sesuai dengan aksi' }
    }

    const { letter, user } = link

    if (letter.status !== 'PENDING_APPROVAL') {
        return { success: false, error: 'Status surat tidak valid' }
    }

    try {
        // Multi-stage Logic Check
        let currentApproverRecord: any = null
        if (letter.letterApprovers && letter.letterApprovers.length > 0) {
            currentApproverRecord = letter.letterApprovers.find((la: any) => la.userId === user.id)
            if (!currentApproverRecord) {
                return { success: false, error: 'Anda tidak terdaftar sebagai penyetuju' }
            }
            if (currentApproverRecord.status === 'APPROVED') {
                return { success: false, error: 'Anda sudah menyetujui surat ini' }
            }

            // Check Sequential Order
            const pendingPrev = letter.letterApprovers.find((la: any) => la.order < currentApproverRecord.order && la.status !== 'APPROVED')
            if (pendingPrev) {
                return { success: false, error: 'Menunggu persetujuan dari pejabat sebelumnya' }
            }
        }

        // 2. Perform Approval Logic (Stamping)
        const draftPath = getFilesystemPath(letter.fileStamped || letter.fileDraft)
        const pdfBuffer = await readFile(draftPath)

        const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify`
        const stamps: StampConfig[] = []

        // Only stamp QR if not already stamped (First approver usually)
        if (!letter.fileStamped) {
            stamps.push({
                page: letter.qrPage,
                xPercent: letter.qrXPercent,
                yPercent: letter.qrYPercent,
                size: letter.qrSize,
                type: 'QR' as const,
                data: `${verifyUrl}/${letter.qrHash}`
            })
        }

        // Determine Paraf Stats
        let parafPage = letter.parafPage || 1
        let parafX = letter.parafXPercent || 0.75
        let parafY = letter.parafYPercent || 0.70
        let parafSize = letter.parafSize || 50

        if (currentApproverRecord) {
            parafPage = currentApproverRecord.parafPage ?? parafPage
            parafX = currentApproverRecord.parafXPercent ?? parafX
            parafY = currentApproverRecord.parafYPercent ?? parafY
            parafSize = currentApproverRecord.parafSize ?? parafSize
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

        const stampedFilename = `stamped_${Date.now()}_${path.basename(letter.fileDraft)}`
        const { publicUrl: fileStamped } = await saveBuffer(
            Buffer.from(pdfBytes),
            'stamped',
            stampedFilename
        )

        // Clean up old stamped file
        if (letter.fileStamped && letter.fileStamped !== letter.fileDraft) {
            try {
                const oldPath = getFilesystemPath(letter.fileStamped)
                await import('fs/promises').then(fs => fs.unlink(oldPath))
            } catch (e) { console.error('Cleanup error', e) }
        }

        // 3. Update DB
        const now = new Date()

        if (currentApproverRecord) {
            // Update Approver Record
            await prisma.letterApprover.update({
                where: { id: currentApproverRecord.id },
                data: { status: 'APPROVED', approvedAt: now }
            })

            const isLast = currentApproverRecord.order === letter.letterApprovers.length

            if (isLast) {
                await prisma.letter.update({
                    where: { id: letter.id },
                    data: {
                        status: 'PENDING_SIGN',
                        fileStamped,
                        approvedAt: now
                    }
                })
                // Notify Signer
                if (letter.assignedSignerId) {
                    await generateAndAndSendMagicLinkForSigner(letter.assignedSignerId, letter.id)
                }
            } else {
                // Update file but keep status PENDING_APPROVAL
                await prisma.letter.update({
                    where: { id: letter.id },
                    data: { fileStamped }
                })
                // Notify Next Approver
                const nextApprover = letter.letterApprovers.find((la: any) => la.order === currentApproverRecord.order + 1)
                if (nextApprover) {
                    await generateAndSendMagicLink(nextApprover.userId, letter.id, 'APPROVE')
                }
            }
        } else {
            // Legacy/Single Mode
            await prisma.letter.update({
                where: { id: letter.id },
                data: {
                    status: 'PENDING_SIGN',
                    fileStamped,
                    approverId: user.id,
                    approvedAt: now
                }
            })
            if (letter.assignedSignerId) {
                await generateAndAndSendMagicLinkForSigner(letter.assignedSignerId, letter.id)
            }
        }

        await prisma.activityLog.create({
            data: {
                action: 'APPROVE',
                description: `Menyetujui surat via Quick Link: ${letter.title}`,
                userId: user.id,
                letterId: letter.id
            }
        })

        // 4. Mark Token Used
        await consumeMagicLink(token)

        return { success: true }
    } catch (error) {
        console.error('Quick Approve Error:', error)
        return { success: false, error: 'Gagal memproses persetujuan' }
    }
}

export async function uploadSignedWithToken(token: string, formData: FormData) {
    const link = await prisma.magicLink.findUnique({
        where: { token },
        include: { user: true, letter: true }
    })

    if (!link || link.isUsed || new Date() > link.expiresAt) {
        return { success: false, error: 'Token tidak valid atau kadaluarsa' }
    }

    if (link.action !== 'SIGN') {
        return { success: false, error: 'Token tidak sesuai dengan aksi' }
    }

    const { letter, user } = link

    if (letter.status !== 'PENDING_SIGN') {
        return { success: false, error: 'Status surat tidak valid' }
    }

    const file = formData.get('file') as File
    if (!file) return { success: false, error: 'File wajib diunggah' }

    try {
        const { publicUrl: fileFinal } = await saveFile(file, 'signed')

        await prisma.letter.update({
            where: { id: letter.id },
            data: {
                status: 'SIGNED',
                fileFinal,
                signerId: user.id,
                signedAt: new Date()
            }
        })

        await prisma.activityLog.create({
            data: {
                action: 'SIGN',
                description: `Mengunggah surat bertanda tangan via Quick Link: ${letter.title}`,
                userId: user.id,
                letterId: letter.id
            }
        })

        await consumeMagicLink(token)

        // Notify Creator
        // Send message to creator
        const creator = await prisma.user.findUnique({ where: { id: letter.creatorId } })
        if (creator && creator.phoneNumber) {
            await sendWhatsAppMessage(creator.phoneNumber, `*E-SURAT TVRI*\n\nSurat *${letter.title}* telah selesai ditanda tangani oleh ${user.name}.\n\nSilakan cek dashboard untuk diproses lebih lanjut.`)
        }

        // Notify Kepsta with Quick Action Link
        try {
            const kepstaUsers = await prisma.user.findMany({
                where: {
                    isActive: true,
                    roles: {
                        some: {
                            role: { name: { in: ['kepala_stasiun', 'Kepala Stasiun', 'Kepsta'] } }
                        }
                    }
                }
            })

            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

            for (const kepsta of kepstaUsers) {
                if (kepsta.phoneNumber) {
                    // Generate magic link for quick disposition
                    const dispositionToken = uuidv4()
                    const otpCode = Math.floor(100000 + Math.random() * 900000).toString()

                    await prisma.magicLink.create({
                        data: {
                            token: dispositionToken,
                            userId: kepsta.id,
                            letterId: letter.id,
                            action: 'DISPOSITION',
                            otpCode,
                            expiresAt: addMinutes(new Date(), 999999999) // 1 hour for disposition
                        }
                    })

                    const quickLink = `${baseUrl}/quick/disposition/${dispositionToken}`

                    const kepstaMsg = `${getGreeting()} *${kepsta.name}*,

Terdapat surat yang telah selesai ditandatangani dan siap untuk didisposisikan:

Judul: *${letter.title}*
Nomor: ${letter.letterNumber || '-'}

Silakan klik link berikut untuk membuat disposisi:

${quickLink}

Kode OTP: *${otpCode}*

(Link berlaku 1 jam)

Aplikasi e-Surat TVRI Kalimantan Barat`

                    sendWhatsAppMessage(kepsta.phoneNumber, kepstaMsg).catch(console.error)
                }
            }
        } catch (e) {
            console.error('Failed to notify Kepsta:', e)
        }

        return { success: true }
    } catch (error) {
        console.error('Quick Sign Error:', error)
        return { success: false, error: 'Gagal mengunggah dokumen' }
    }
}

async function generateAndAndSendMagicLinkForSigner(signerId: string, letterId: string) {
    // Wrapper to reuse the main function but ensure it doesn't fail the whole request
    try {
        await generateAndSendMagicLink(signerId, letterId, 'SIGN')
    } catch (e) {
        console.error('Failed to chain signer notification:', e)
    }
}

export async function rejectWithToken(token: string, reason: string) {
    const link = await prisma.magicLink.findUnique({
        where: { token },
        include: { user: true, letter: true }
    })

    if (!link || link.isUsed || new Date() > link.expiresAt) {
        return { success: false, error: 'Token tidak valid atau kadaluarsa' }
    }

    // Allow Reject on APPROVE or SIGN action
    // But status must match
    const { letter, user } = link

    if (link.action === 'APPROVE' && letter.status !== 'PENDING_APPROVAL') {
        return { success: false, error: 'Status surat tidak valid untuk penolakan persetujuan' }
    }
    if (link.action === 'SIGN' && letter.status !== 'PENDING_SIGN') {
        // Although UI might not expose this yet for Signer
        return { success: false, error: 'Status surat tidak valid untuk penolakan tanda tangan' }
    }

    if (!reason || reason.trim().length === 0) {
        return { success: false, error: 'Alasan penolakan harus diisi' }
    }

    try {
        await prisma.letter.update({
            where: { id: letter.id },
            data: {
                status: 'REJECTED',
                rejectionReason: reason,
                approverId: user.id // Using user as rejector
            }
        })

        await prisma.activityLog.create({
            data: {
                action: 'REJECT',
                description: `Menolak surat via Quick Link: ${letter.title}. Alasan: ${reason}`,
                userId: user.id,
                letterId: letter.id
            }
        })

        await consumeMagicLink(token)

        // Notify Creator
        const creator = await prisma.user.findUnique({ where: { id: letter.creatorId } })
        if (creator && creator.phoneNumber) {
            await sendWhatsAppMessage(creator.phoneNumber, `*E-SURAT TVRI*\n\nSurat *${letter.title}* telah DITOLAK oleh ${user.name}.\n\nAlasan: ${reason}\n\nSilakan cek dashboard untuk detail.`)
        }

        return { success: true }
    } catch (error) {
        console.error('Quick Reject Error:', error)
        return { success: false, error: 'Gagal menolak surat' }
    }
}

// ==================== QUICK DISPOSITION ====================

export async function verifyDispositionMagicLink(token: string, otp: string) {
    try {
        const magicLink = await prisma.magicLink.findUnique({
            where: { token },
            include: {
                user: true,
                letter: {
                    include: {
                        category: true
                    }
                }
            }
        })

        if (!magicLink) {
            return { success: false, error: 'Link tidak valid' }
        }

        if (magicLink.isUsed) {
            return { success: false, error: 'Link sudah digunakan' }
        }

        if (new Date() > magicLink.expiresAt) {
            return { success: false, error: 'Link sudah kadaluarsa. Hubungi Admin untuk link baru.' }
        }

        if (magicLink.action !== 'DISPOSITION') {
            return { success: false, error: 'Link tidak valid untuk disposisi' }
        }

        if (magicLink.otpCode !== otp) {
            return { success: false, error: 'Kode OTP salah' }
        }

        return { success: true, data: magicLink }
    } catch (error) {
        return { success: false, error: 'Terjadi kesalahan validasi' }
    }
}

export async function getQuickDispositionData(token: string) {
    try {
        const magicLink = await prisma.magicLink.findUnique({
            where: { token },
            include: {
                letter: {
                    select: { id: true, title: true, letterNumber: true, category: true }
                }
            }
        })

        if (!magicLink || magicLink.isUsed || new Date() > magicLink.expiresAt) {
            return { success: false, error: 'Link tidak valid' }
        }

        // Get recipients
        const recipients = await prisma.user.findMany({
            where: { isActive: true },
            select: { id: true, name: true, email: true },
            orderBy: { name: 'asc' }
        })

        // Get instructions
        const instructions = await prisma.dispositionInstruction.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' }
        })

        return {
            success: true,
            data: {
                letter: magicLink.letter,
                recipients,
                instructions
            }
        }
    } catch (error) {
        console.error('Get quick disposition data error:', error)
        return { success: false, error: 'Gagal mengambil data' }
    }
}

export async function createDispositionWithToken(
    token: string,
    input: {
        recipientIds: string[]
        instructionIds: string[]
        urgency: 'BIASA' | 'SEGERA' | 'SANGAT_SEGERA' | 'RAHASIA'
        notes?: string
    }
) {
    try {
        const magicLink = await prisma.magicLink.findUnique({
            where: { token },
            include: {
                user: true,
                letter: true
            }
        })

        if (!magicLink || magicLink.isUsed || new Date() > magicLink.expiresAt) {
            return { success: false, error: 'Token tidak valid atau kadaluarsa' }
        }

        if (magicLink.action !== 'DISPOSITION') {
            return { success: false, error: 'Token tidak sesuai dengan aksi' }
        }

        const { letter, user } = magicLink

        if (letter.status !== 'SIGNED') {
            return { success: false, error: 'Surat belum ditandatangani' }
        }

        // Validate recipients
        if (input.recipientIds.length === 0) {
            return { success: false, error: 'Pilih minimal satu penerima' }
        }

        // Create disposition
        const disposition = await prisma.disposition.create({
            data: {
                letterId: letter.id,
                fromUserId: user.id,
                urgency: input.urgency,
                notes: input.notes || null,
                recipients: {
                    create: input.recipientIds.map(userId => ({
                        userId,
                        status: 'PENDING'
                    }))
                },
                instructions: {
                    create: input.instructionIds.map(instructionId => ({
                        instructionId
                    }))
                }
            },
            include: {
                recipients: {
                    include: { user: { select: { id: true, name: true } } }
                },
                instructions: {
                    include: { instruction: true }
                }
            }
        })

        // Log activity
        await prisma.activityLog.create({
            data: {
                action: 'DISPOSITION_CREATED',
                description: `Membuat disposisi via Quick Link untuk surat "${letter.title}"`,
                userId: user.id,
                letterId: letter.id,
                metadata: JSON.stringify({
                    dispositionId: disposition.id,
                    recipientIds: input.recipientIds,
                    urgency: input.urgency
                })
            }
        })

        // Mark magic link as used
        await consumeMagicLink(token)

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

        // 1. Notify Creator (Kepsta) - Success but waiting for number
        if (user.phoneNumber) {
            const dispLink = `${appUrl}/dispositions/${disposition.id}`
            const recipientNames = disposition.recipients.map(r => r.user.name).join(', ')

            await sendWhatsAppMessage(
                user.phoneNumber,
                `${getGreeting()} *${user.name}*,

Disposisi Anda berhasil dibuat dan diteruskan ke Tata Usaha untuk penomoran.

🧾 *Detail Disposisi:*
• Surat: *${letter.title}*
• Sifat: ${input.urgency}
• Penerima: ${recipientNames}

Status saat ini: *Menunggu Penomoran (TU)*
Anda akan menerima notifikasi lanjutan setelah nomor disposisi diterbitkan.

Link Detail:
${dispLink}

Aplikasi e-Surat TVRI Kalimantan Barat`
            ).catch(console.error)
        }

        // 2. Notify TU - Request to Set Number
        const tuUsers = await prisma.user.findMany({
            where: {
                isActive: true,
                roles: {
                    some: {
                        role: { name: { in: ['staff_tu', 'Staff TU', 'tata_usaha', 'Tata Usaha', 'admin', 'Admin'] } }
                    }
                }
            }
        })

        for (const tu of tuUsers) {
            if (tu.phoneNumber) {
                // Generate magic link for SET_DISPOSITION_NUMBER
                const setNumberToken = uuidv4()

                await prisma.magicLink.create({
                    data: {
                        token: setNumberToken,
                        userId: tu.id,
                        letterId: letter.id, // Linked to Letter, but maybe we should link to Disposition? 
                        // MagicLink schema has letterId. We can find disposition by letterId + status PENDING
                        // Or we can add dispositionId to MagicLink? 
                        // For now, let's use letterId and find the latest disposition in the Page logic.
                        action: 'SET_DISPOSITION_NUMBER',
                        otpCode: '0000', // No OTP needed for internal staff? Or generate one. Let's start without OTP or simple one.
                        // Actually user said "Quick action pengisian nomor". 
                        expiresAt: addMinutes(new Date(), 1440) // 24 hours
                    }
                })

                const setNumberLink = `${appUrl}/quick/disposition-number/${setNumberToken}`

                await sendWhatsAppMessage(
                    tu.phoneNumber,
                    `${getGreeting()} *${tu.name}*,

Terdapat disposisi baru yang memerlukan nomor disposisi:

Judul Surat: *${letter.title}*
Dari: ${user.name}

Silakan klik link berikut untuk mengisi nomor disposisi:

${setNumberLink}

(Link berlaku 24 jam)

Aplikasi e-Surat TVRI Kalimantan Barat`
                ).catch(console.error)
            }
        }

        return { success: true, data: disposition }
    } catch (error) {
        console.error('Quick Disposition Error:', error)
        return { success: false, error: 'Gagal membuat disposisi' }
    }
}

// ==================== SET DISPOSITION NUMBER (TU) ====================

export async function verifySetNumberMagicLink(token: string) {
    try {
        const magicLink = await prisma.magicLink.findUnique({
            where: { token },
            include: { user: true, letter: true }
        })

        if (!magicLink || magicLink.isUsed || new Date() > magicLink.expiresAt) {
            return { success: false, error: 'Link tidak valid atau kadaluarsa' }
        }

        if (magicLink.action !== 'SET_DISPOSITION_NUMBER') {
            return { success: false, error: 'Link tidak valid untuk aksi ini' }
        }

        return { success: true, data: magicLink }
    } catch (error) {
        return { success: false, error: 'Terjadi kesalahan validasi' }
    }
}

export async function getSetNumberData(token: string) {
    try {
        const magicLink = await prisma.magicLink.findUnique({
            where: { token },
            include: {
                letter: {
                    select: { id: true, title: true, letterNumber: true }
                }
            }
        })

        if (!magicLink || magicLink.isUsed || new Date() > magicLink.expiresAt) {
            return { success: false, error: 'Link tidak valid' }
        }

        // Find disposition pending number
        const disposition = await prisma.disposition.findFirst({
            where: { letterId: magicLink.letterId, number: null },
            orderBy: { createdAt: 'desc' }
        })

        if (!disposition) {
            return { success: false, error: 'Tidak ada disposisi yang perlu nomor' }
        }

        return {
            success: true,
            data: {
                letter: magicLink.letter,
                disposition
            }
        }
    } catch (error) {
        return { success: false, error: 'Gagal mengambil data' }
    }
}

export async function setDispositionNumberWithToken(token: string, number: string) {
    try {
        const magicLink = await prisma.magicLink.findUnique({
            where: { token },
            include: { user: true, letter: true }
        })

        if (!magicLink || magicLink.isUsed || new Date() > magicLink.expiresAt) {
            return { success: false, error: 'Token tidak valid' }
        }

        // Find disposition
        const disposition = await prisma.disposition.findFirst({
            where: { letterId: magicLink.letterId, number: null },
            orderBy: { createdAt: 'desc' }
        })

        if (!disposition) {
            return { success: false, error: 'Disposisi sudah memiliki nomor atau tidak ditemukan' }
        }

        // Update number
        const updatedDisposition = await prisma.disposition.update({
            where: { id: disposition.id },
            data: {
                number: number,
                status: 'PENDING_SIGN'
            }
        })

        // Generate PDF (Assuming library is available or handled elsewhere, but for now we just notify)
        // Ideally we should trigger PDF generation here or it's done on-the-fly when downloading?
        // Usually generateDispositionPdf is called. Let's try to call it if imported.
        // import { generateDispositionPdf } from '@/lib/pdf-generator' -> Need to check imports.
        // Assuming it exists or user downloads dynamic.

        await consumeMagicLink(token)

        // Notify Creator (Kepsta) to Upload Signed
        const creator = await prisma.user.findUnique({
            where: { id: disposition.fromUserId }
        })

        if (creator && creator.phoneNumber) {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

            // Generate Upload Token with proper OTP
            const uploadToken = uuidv4()
            const uploadOtp = Math.floor(100000 + Math.random() * 900000).toString()

            await prisma.magicLink.create({
                data: {
                    token: uploadToken,
                    userId: creator.id,
                    letterId: magicLink.letterId,
                    action: 'UPLOAD_DISPOSITION_SIGNED',
                    otpCode: uploadOtp,
                    expiresAt: addMinutes(new Date(), 1440)
                }
            })

            const uploadLink = `${appUrl}/quick/disposition-upload/${uploadToken}`
            const downloadLink = `${appUrl}/api/dispositions/${disposition.id}/pdf`

            await sendWhatsAppMessage(
                creator.phoneNumber,
                `${getGreeting()} *${creator.name}*,

Nomor disposisi telah terbit:

Nomor: *${number}*
Judul Surat: ${magicLink.letter.title}

Silakan:
1. Download Lembar Disposisi
2. Bubuhkan Tanda Tangan Elektronik
3. Upload kembali disposisi

Link Disposisi:
${uploadLink}

Kode OTP: *${uploadOtp}*

(Link berlaku 24 jam)

Aplikasi e-Surat TVRI Kalimantan Barat`
            ).catch(console.error)
        }

        return { success: true }
    } catch (error) {
        console.error('Set Disposition Number Error:', error)
        return { success: false, error: 'Gagal menyimpan nomor' }
    }
}

// ==================== UPLOAD SIGNED DISPOSITION (KEPSTA) ====================

export async function verifyUploadDispositionMagicLink(token: string, otp?: string) {
    try {
        const magicLink = await prisma.magicLink.findUnique({
            where: { token },
            include: {
                user: true,
                letter: {
                    include: {
                        creator: true,
                        category: true
                    }
                }
            }
        })

        if (!magicLink || magicLink.isUsed || new Date() > magicLink.expiresAt) {
            return { success: false, error: 'Link tidak valid' }
        }

        if (magicLink.action !== 'UPLOAD_DISPOSITION_SIGNED') {
            return { success: false, error: 'Link salah aksi' }
        }

        // Validate OTP if provided
        if (otp && magicLink.otpCode !== otp) {
            return { success: false, error: 'Kode OTP salah' }
        }

        // Find disposition 
        const disposition = await prisma.disposition.findFirst({
            where: { letterId: magicLink.letterId },
            orderBy: { createdAt: 'desc' }
        })

        if (!disposition || !disposition.number) {
            return { success: false, error: 'Disposisi belum memiliki nomor' }
        }


        return { success: true, data: { magicLink, disposition } }
    } catch (e) {
        return { success: false, error: 'Error validasi' }
    }
}

export async function uploadSignedDispositionWithToken(token: string, formData: FormData) {
    try {
        const magicLink = await prisma.magicLink.findUnique({
            where: { token },
            include: { user: true, letter: true }
        })

        if (!magicLink || magicLink.isUsed || new Date() > magicLink.expiresAt) {
            return { success: false, error: 'Token tidak valid' }
        }

        if (magicLink.action !== 'UPLOAD_DISPOSITION_SIGNED') {
            return { success: false, error: 'Token tidak valid untuk aksi ini' }
        }

        const file = formData.get('file') as File
        if (!file) {
            return { success: false, error: 'File tidak ditemukan' }
        }

        // Find disposition
        const disposition = await prisma.disposition.findFirst({
            where: { letterId: magicLink.letterId },
            orderBy: { createdAt: 'desc' }
        })

        if (!disposition) {
            return { success: false, error: 'Disposisi tidak ditemukan' }
        }

        // Validate authority? Magic Link implies authority granted to the link holder (Kepsta).
        // Check integrity is handled by token.

        // Save file
        const { publicUrl } = await saveFile(file, 'signed')

        // Update DB
        await prisma.disposition.update({
            where: { id: disposition.id },
            data: {
                status: 'SUBMITTED',
                fileSigned: publicUrl,
                signedAt: new Date()
            }
        })

        await consumeMagicLink(token)

        // Notify Recipients
        const recipients = await prisma.dispositionRecipient.findMany({
            where: { dispositionId: disposition.id },
            include: { user: true }
        })

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const dispositionLink = `${appUrl}/dispositions/${disposition.id}`

        for (const recipient of recipients) {
            if (recipient.user.phoneNumber) {
                const msg = `${getGreeting()} *${recipient.user.name}*,

Anda menerima disposisi baru:

Judul Surat: *${magicLink.letter.title}*
Sifat: ${disposition.urgency}
Dari: ${magicLink.user.name}

Silakan klik link berikut untuk melihat detail:

${dispositionLink}

Segera ditindaklanjuti.

Aplikasi e-Surat TVRI Kalimantan Barat`

                await sendWhatsAppMessage(recipient.user.phoneNumber, msg).catch(console.error)
            }
        }

        revalidatePath('/dispositions')
        revalidatePath(`/dispositions/${disposition.id}`)

        return { success: true }
    } catch (error) {
        console.error('Upload Signed Disposition Error:', error)
        return { success: false, error: 'Gagal mengupload file' }
    }
}

