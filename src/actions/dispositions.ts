'use server'

import prisma from '@/lib/prisma'
import { requireAuth, requirePermission } from '@/lib/auth'
import { PERMISSIONS, hasPermission } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'
import { generateDispositionPdf } from '@/lib/pdf-generator'
import { saveFile } from '@/lib/upload'
import { sendWhatsAppMessage } from '@/lib/whatsapp'

// ==================== TYPES ====================

export type DispositionUrgency = 'BIASA' | 'SEGERA' | 'PENTING' | 'RAHASIA'

interface CreateDispositionInput {
    letterId: string
    recipientIds: string[]
    instructionIds: string[]
    urgency: DispositionUrgency
    notes?: string
}

// ==================== HELPER FUNCTIONS ====================

async function generateDispositionNumber(): Promise<string> {
    const year = new Date().getFullYear()
    const prefix = `DISP/${year}/`

    const lastDisposition = await prisma.disposition.findFirst({
        where: {
            number: {
                startsWith: prefix
            }
        },
        orderBy: {
            number: 'desc'
        }
    })

    let nextNumber = 1
    if (lastDisposition && lastDisposition.number) {
        const lastNumber = parseInt(lastDisposition.number.split('/').pop() || '0')
        nextNumber = lastNumber + 1
    }

    return `${prefix}${nextNumber.toString().padStart(4, '0')}`
}

// ==================== INSTRUCTIONS ====================

export async function getDispositionInstructions() {
    try {
        await requireAuth()

        const instructions = await prisma.dispositionInstruction.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' }
        })

        return { success: true, data: instructions }
    } catch (error) {
        console.error('Get disposition instructions error:', error)
        return { success: false, error: 'Gagal mengambil data instruksi' }
    }
}

// ==================== CREATE DISPOSITION ====================

export async function createDisposition(input: CreateDispositionInput) {
    try {
        const session = await requirePermission(PERMISSIONS.DISPOSITION_CREATE)

        // Validate letter exists and is signed
        const letter = await prisma.letter.findUnique({
            where: { id: input.letterId }
        })

        if (!letter) {
            return { success: false, error: 'Surat tidak ditemukan' }
        }

        if (letter.status !== 'SIGNED') {
            return { success: false, error: 'Hanya surat yang sudah ditandatangani yang dapat didisposisikan' }
        }

        // Validate recipients exist
        if (input.recipientIds.length === 0) {
            return { success: false, error: 'Pilih minimal satu penerima disposisi' }
        }

        const recipients = await prisma.user.findMany({
            where: { id: { in: input.recipientIds }, isActive: true }
        })

        if (recipients.length !== input.recipientIds.length) {
            return { success: false, error: 'Beberapa penerima tidak valid' }
        }

        // Validate instructions exist
        if (input.instructionIds.length === 0) {
            return { success: false, error: 'Pilih minimal satu instruksi' }
        }

        // Create disposition with recipients and instructions (Number is NULL initially)
        const disposition = await prisma.disposition.create({
            data: {
                letterId: input.letterId,
                fromUserId: session.user.id,
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
                    include: {
                        user: { select: { id: true, name: true } }
                    }
                },
                instructions: {
                    include: {
                        instruction: true
                    }
                }
            }
        })

        // Log activity
        await prisma.activityLog.create({
            data: {
                action: 'DISPOSITION_CREATED',
                description: `Membuat draft disposisi untuk surat "${letter.title}"`,
                userId: session.user.id,
                letterId: input.letterId,
                metadata: JSON.stringify({
                    dispositionId: disposition.id,
                    recipientIds: input.recipientIds,
                    urgency: input.urgency
                })
            }
        })

        revalidatePath(`/letters/${input.letterId}`)
        revalidatePath('/dispositions')

        revalidatePath(`/letters/${input.letterId}`)
        revalidatePath('/dispositions')

        // PDF Generation MOVED to after Number is set

        return { success: true, data: disposition }
    } catch (error) {
        console.error('Create disposition error:', error)
        return { success: false, error: 'Gagal membuat disposisi' }
    }
}

// ==================== GET DISPOSITIONS ====================

export async function getDispositionsForLetter(letterId: string) {
    try {
        await requireAuth()

        const dispositions = await prisma.disposition.findMany({
            where: { letterId },
            include: {
                fromUser: { select: { id: true, name: true } },
                recipients: {
                    include: {
                        user: { select: { id: true, name: true } }
                    }
                },
                instructions: {
                    include: {
                        instruction: { select: { id: true, name: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        })

        return { success: true, data: dispositions }
    } catch (error) {
        console.error('Get dispositions for letter error:', error)
        return { success: false, error: 'Gagal mengambil data disposisi' }
    }
}

export async function getMyDispositions(status?: string) {
    try {
        const session = await requirePermission(PERMISSIONS.DISPOSITION_VIEW)

        // Check for view all permission
        const whereClause: any = {
            recipients: {
                some: {
                    userId: session.user.id
                }
            }
        }

        // If status filter is applied
        if (status && ['PENDING', 'READ', 'COMPLETED'].includes(status)) {
            whereClause.recipients.some.status = status
        }

        const dispositions = await prisma.disposition.findMany({
            where: whereClause,
            include: {
                letter: {
                    select: {
                        id: true,
                        title: true,
                        letterNumber: true,
                        status: true
                    }
                },
                fromUser: { select: { id: true, name: true } },
                recipients: {
                    where: { userId: session.user.id }, // Show only my recipient status
                    select: {
                        id: true,
                        status: true,
                        readAt: true,
                        completedAt: true,
                        response: true,
                        user: { select: { id: true, name: true } } // Select user name to show who
                    }
                },
                instructions: {
                    include: {
                        instruction: { select: { id: true, name: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        })

        return { success: true, data: dispositions }
    } catch (error) {
        console.error('Get my dispositions error:', error)
        return { success: false, error: 'Gagal mengambil data disposisi' }
    }
}

export async function getAllDispositions() {
    try {
        await requirePermission(PERMISSIONS.DISPOSITION_VIEW_ALL)

        const dispositions = await prisma.disposition.findMany({
            include: {
                letter: {
                    select: {
                        id: true,
                        title: true,
                        letterNumber: true
                    }
                },
                fromUser: { select: { id: true, name: true } },
                recipients: {
                    include: {
                        user: { select: { id: true, name: true } }
                    }
                },
                instructions: {
                    include: {
                        instruction: { select: { id: true, name: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        })

        return { success: true, data: dispositions }
    } catch (error) {
        console.error('Get all dispositions error:', error)
        return { success: false, error: 'Gagal mengambil semua data disposisi' }
    }
}

export async function getSentDispositions() {
    try {
        const session = await requirePermission(PERMISSIONS.DISPOSITION_VIEW)

        const dispositions = await prisma.disposition.findMany({
            where: { fromUserId: session.user.id },
            include: {
                letter: {
                    select: {
                        id: true,
                        title: true,
                        letterNumber: true
                    }
                },
                fromUser: { select: { id: true, name: true } },
                recipients: {
                    include: {
                        user: { select: { id: true, name: true } }
                    }
                },
                instructions: {
                    include: {
                        instruction: { select: { id: true, name: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        })

        return { success: true, data: dispositions }
    } catch (error) {
        console.error('Get sent dispositions error:', error)
        return { success: false, error: 'Gagal mengambil data disposisi terkirim' }
    }
}

export async function getPendingNumberDispositions() {
    try {
        await requirePermission(PERMISSIONS.DISPOSITION_SET_NUMBER)

        const dispositions = await prisma.disposition.findMany({
            where: { status: 'PENDING_NUMBER' },
            include: {
                letter: {
                    select: {
                        id: true,
                        title: true,
                        letterNumber: true,
                        status: true
                    }
                },
                fromUser: { select: { id: true, name: true } },
                recipients: {
                    include: {
                        user: { select: { id: true, name: true } }
                    }
                },
                instructions: {
                    include: {
                        instruction: { select: { id: true, name: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        })

        return { success: true, data: dispositions }
    } catch (error) {
        console.error('Get pending number dispositions error:', error)
        return { success: false, error: 'Gagal mengambil data disposisi' }
    }
}

// ==================== SET DISPOSITION NUMBER ====================

export async function setDispositionNumber(dispositionId: string, number: string) {
    try {
        const session = await requirePermission(PERMISSIONS.DISPOSITION_SET_NUMBER)

        const disposition = await prisma.disposition.findUnique({
            where: { id: dispositionId },
            include: {
                fromUser: true,
                letter: { select: { title: true } }
            }
        })

        if (!disposition) {
            return { success: false, error: 'Disposisi tidak ditemukan' }
        }

        // Check availability of number
        const existing = await prisma.disposition.findUnique({
            where: { number }
        })

        if (existing && existing.id !== dispositionId) {
            return { success: false, error: 'Nomor disposisi sudah digunakan' }
        }

        // Update
        await prisma.disposition.update({
            where: { id: dispositionId },
            data: {
                number,
                status: 'PENDING_SIGN'
            }
        })

        // Generate PDF
        try {
            await generateDispositionPdf(dispositionId)
        } catch (e) {
            console.error('PDF Generation Failed:', e)
            // Don't fail the request, but log it
        }

        // Notify Creator
        if (disposition.fromUser.phoneNumber) {
            const msg = `*E-SURAT TVRI*\n\nNomor disposisi untuk surat "${disposition.letter.title}" telah diisi (${number}).\n\nSilakan download dan TTE.`
            sendWhatsAppMessage(disposition.fromUser.phoneNumber, msg).catch(console.error)
        }

        revalidatePath(`/dispositions/${dispositionId}`)
        revalidatePath('/dispositions')

        return { success: true }
    } catch (error) {
        console.error('Set disposition number error:', error)
        return { success: false, error: 'Gagal mengisi nomor disposisi' }
    }
}

// ==================== UPDATE DISPOSITION STATUS ====================

export async function markDispositionAsRead(dispositionId: string) {
    try {
        const session = await requirePermission(PERMISSIONS.DISPOSITION_UPDATE)

        // Find the recipient record for this user
        const recipient = await prisma.dispositionRecipient.findFirst({
            where: {
                dispositionId,
                userId: session.user.id
            },
            include: {
                disposition: {
                    include: {
                        letter: { select: { title: true } }
                    }
                }
            }
        })

        if (!recipient) {
            return { success: false, error: 'Anda bukan penerima disposisi ini' }
        }

        if (recipient.status !== 'PENDING') {
            return { success: false, error: 'Disposisi sudah dibaca' }
        }

        await prisma.dispositionRecipient.update({
            where: { id: recipient.id },
            data: {
                status: 'READ',
                readAt: new Date()
            }
        })

        // Log activity
        await prisma.activityLog.create({
            data: {
                action: 'DISPOSITION_READ',
                description: `Membaca disposisi ${recipient.disposition.number}`,
                userId: session.user.id,
                letterId: recipient.disposition.letterId
            }
        })

        revalidatePath('/dispositions')

        return { success: true }
    } catch (error) {
        console.error('Mark disposition as read error:', error)
        return { success: false, error: 'Gagal menandai disposisi sebagai dibaca' }
    }
}

export async function markDispositionAsCompleted(dispositionId: string, response?: string) {
    try {
        const session = await requirePermission(PERMISSIONS.DISPOSITION_UPDATE)

        const recipient = await prisma.dispositionRecipient.findFirst({
            where: {
                dispositionId,
                userId: session.user.id
            },
            include: {
                disposition: true
            }
        })

        if (!recipient) {
            return { success: false, error: 'Anda bukan penerima disposisi ini' }
        }

        if (recipient.status === 'COMPLETED') {
            return { success: false, error: 'Disposisi sudah selesai' }
        }

        await prisma.dispositionRecipient.update({
            where: { id: recipient.id },
            data: {
                status: 'COMPLETED',
                completedAt: new Date(),
                readAt: recipient.readAt || new Date(), // Also mark as read if not already
                response: response || null
            }
        })

        // Log activity
        await prisma.activityLog.create({
            data: {
                action: 'DISPOSITION_COMPLETED',
                description: `Menyelesaikan disposisi ${recipient.disposition.number}`,
                userId: session.user.id,
                letterId: recipient.disposition.letterId
            }
        })

        revalidatePath('/dispositions')

        return { success: true }
    } catch (error) {
        console.error('Mark disposition as completed error:', error)
        return { success: false, error: 'Gagal menyelesaikan disposisi' }
    }
}

// ==================== STATS ====================

export async function getDispositionStats() {
    try {
        const session = await requirePermission(PERMISSIONS.DISPOSITION_VIEW)

        const [pending, read, completed] = await Promise.all([
            prisma.dispositionRecipient.count({
                where: { userId: session.user.id, status: 'PENDING' }
            }),
            prisma.dispositionRecipient.count({
                where: { userId: session.user.id, status: 'READ' }
            }),
            prisma.dispositionRecipient.count({
                where: { userId: session.user.id, status: 'COMPLETED' }
            })
        ])

        return {
            success: true,
            data: {
                pending,
                read,
                completed,
                total: pending + read + completed
            }
        }
    } catch (error) {
        console.error('Get disposition stats error:', error)
        return { success: false, error: 'Gagal mengambil statistik disposisi' }
    }
}

// ==================== GET ELIGIBLE RECIPIENTS ====================

export async function getEligibleRecipients() {
    try {
        await requireAuth()

        // Get all active users (in a real system, you might filter by role/position)
        const users = await prisma.user.findMany({
            where: { isActive: true },
            select: {
                id: true,
                name: true,
                email: true,
                roles: {
                    include: {
                        role: { select: { name: true } }
                    }
                }
            },
            orderBy: { name: 'asc' }
        })

        // Format with role info
        const formattedUsers = users.map(user => ({
            id: user.id,
            name: user.name,
            email: user.email,
            roles: user.roles.map(r => r.role.name)
        }))

        return { success: true, data: formattedUsers }
    } catch (error) {
        console.error('Get eligible recipients error:', error)
        return { success: false, error: 'Gagal mengambil daftar penerima' }
    }
}

// ==================== GET SINGLE DISPOSITION ====================

export async function getDispositionById(dispositionId: string) {
    try {
        await requireAuth()

        const disposition = await prisma.disposition.findUnique({
            where: { id: dispositionId },
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
                        user: { select: { id: true, name: true, email: true } }
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

        if (!disposition) {
            return { success: false, error: 'Disposisi tidak ditemukan' }
        }

        return { success: true, data: disposition }
    } catch (error) {
        console.error('Get disposition by id error:', error)
        return { success: false, error: 'Gagal mengambil data disposisi' }
    }
}

// ==================== UPLOAD SIGNED DISPOSITION ====================

export async function uploadSignedDisposition(dispositionId: string, formData: FormData) {
    try {
        const session = await requireAuth()
        const file = formData.get('file') as File

        if (!file) {
            return { success: false, error: 'File tidak ditemukan' }
        }

        const disposition = await prisma.disposition.findUnique({
            where: { id: dispositionId },
            include: {
                recipients: {
                    include: { user: true }
                },
                letter: true
            }
        })

        if (!disposition) {
            return { success: false, error: 'Disposisi tidak ditemukan' }
        }

        // Verify ownership (Creator or Delegated?)
        if (disposition.fromUserId !== session.user.id) {
            // Maybe allow if SUPER ADMIN? For now strict.
            return { success: false, error: 'Anda tidak memiliki hak akses' }
        }

        // Save file
        const { publicUrl } = await saveFile(file, 'signed')

        // Update DB
        await prisma.disposition.update({
            where: { id: dispositionId },
            data: {
                status: 'SUBMITTED',
                fileSigned: publicUrl,
                signedAt: new Date()
            }
        })

        // Notify Recipients
        for (const recipient of disposition.recipients) {
            if (recipient.user.phoneNumber) {
                const msg = `*E-SURAT TVRI*\n\nAnda menerima disposisi baru.\n\nSurat: ${disposition.letter.title}\nSifat: ${disposition.urgency}\n\nSilakan cek aplikasi.`
                // Fire and forget
                sendWhatsAppMessage(recipient.user.phoneNumber, msg).catch(console.error)
            }
        }

        revalidatePath('/dispositions')
        revalidatePath(`/dispositions/${dispositionId}`)

        return { success: true }
    } catch (error) {
        console.error('Upload signed disposition error:', error)
        return { success: false, error: 'Gagal mengupload file' }
    }
}
