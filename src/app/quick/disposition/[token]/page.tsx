'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import {
    verifyDispositionMagicLink,
    getQuickDispositionData,
    createDispositionWithToken
} from '@/actions/quick-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, CheckCircle, AlertCircle, FileText, Users, ClipboardList, Send } from 'lucide-react'
import { toast } from 'sonner'

type Step = 'otp' | 'form' | 'success' | 'error'
type UrgencyType = 'BIASA' | 'SEGERA' | 'SANGAT_SEGERA' | 'RAHASIA'

interface Recipient {
    id: string
    name: string
    email: string
}

interface Instruction {
    id: string
    name: string
    description?: string | null
}

interface LetterInfo {
    id: string
    title: string
    letterNumber?: string | null
    category?: { name: string } | null
}

export default function QuickDispositionPage() {
    const params = useParams()
    const token = params.token as string

    const [step, setStep] = useState<Step>('otp')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    // OTP State
    const [otp, setOtp] = useState('')

    // Form State
    const [letter, setLetter] = useState<LetterInfo | null>(null)
    const [recipients, setRecipients] = useState<Recipient[]>([])
    const [instructions, setInstructions] = useState<Instruction[]>([])
    const [selectedRecipients, setSelectedRecipients] = useState<string[]>([])
    const [selectedInstructions, setSelectedInstructions] = useState<string[]>([])
    const [urgency, setUrgency] = useState<UrgencyType>('BIASA')
    const [notes, setNotes] = useState('')

    const handleVerifyOtp = async () => {
        if (!otp || otp.length !== 6) {
            toast.error('Masukkan kode OTP 6 digit')
            return
        }

        setIsLoading(true)
        setError('')

        try {
            const result = await verifyDispositionMagicLink(token, otp)
            if (result.success) {
                // Load form data
                const dataResult = await getQuickDispositionData(token)
                if (dataResult.success && dataResult.data) {
                    setLetter(dataResult.data.letter as LetterInfo)
                    setRecipients(dataResult.data.recipients)
                    setInstructions(dataResult.data.instructions as Instruction[])
                    setStep('form')
                } else {
                    setError(dataResult.error || 'Gagal memuat data')
                    setStep('error')
                }
            } else {
                toast.error(result.error || 'Verifikasi gagal')
            }
        } catch {
            toast.error('Terjadi kesalahan')
        } finally {
            setIsLoading(false)
        }
    }

    const handleSubmit = async () => {
        if (selectedRecipients.length === 0) {
            toast.error('Pilih minimal satu penerima')
            return
        }
        if (selectedInstructions.length === 0) {
            toast.error('Pilih minimal satu instruksi')
            return
        }

        setIsLoading(true)
        try {
            const result = await createDispositionWithToken(token, {
                recipientIds: selectedRecipients,
                instructionIds: selectedInstructions,
                urgency,
                notes: notes || undefined
            })

            if (result.success) {
                setStep('success')
            } else {
                toast.error(result.error || 'Gagal membuat disposisi')
            }
        } catch {
            toast.error('Terjadi kesalahan')
        } finally {
            setIsLoading(false)
        }
    }

    const toggleRecipient = (id: string) => {
        setSelectedRecipients(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
    }

    const toggleInstruction = (id: string) => {
        setSelectedInstructions(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
    }

    // ... (omitted)

    const urgencyOptions: Array<{ value: UrgencyType; label: string; color: string }> = [
        { value: 'BIASA', label: 'Biasa', color: 'bg-secondary/50 border-secondary' },
        { value: 'SEGERA', label: 'Segera', color: 'bg-yellow-50 border-yellow-200' },
        { value: 'SANGAT_SEGERA', label: 'Sangat Segera', color: 'bg-red-50 border-red-200' },
        { value: 'RAHASIA', label: 'Rahasia', color: 'bg-purple-50 border-purple-200' }
    ]

    // OTP Step
    if (step === 'otp') {
        return (
            <div className="p-6 space-y-6">
                <div className="text-center">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-blue-600" />
                    </div>
                    <h2 className="text-xl font-bold">Quick Disposisi</h2>
                    <p className="text-gray-500 text-sm mt-1">Masukkan kode OTP dari WhatsApp</p>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Kode OTP (6 digit)</Label>
                        <Input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                            placeholder="000000"
                            className="text-center text-2xl tracking-widest"
                        />
                    </div>

                    <Button
                        onClick={handleVerifyOtp}
                        disabled={isLoading || otp.length !== 6}
                        className="w-full"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        Verifikasi
                    </Button>
                </div>
            </div>
        )
    }

    // Form Step
    if (step === 'form') {
        return (
            <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
                {/* Letter Info */}
                <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-start gap-2">
                        <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm line-clamp-2">{letter?.title}</p>
                            <p className="text-xs text-gray-500">{letter?.letterNumber || 'No. -'}</p>
                        </div>
                    </div>
                </div>

                {/* Urgency */}
                <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Sifat
                    </Label>
                    <div className="flex gap-2 flex-wrap">
                        {urgencyOptions.map(opt => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => setUrgency(opt.value)}
                                className={`px-3 py-2 rounded-lg border-2 transition-all text-sm font-medium ${urgency === opt.value
                                    ? 'border-blue-500 ' + opt.color
                                    : 'border-transparent bg-gray-50 hover:bg-gray-100'
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Instructions */}
                <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                        <ClipboardList className="w-4 h-4" />
                        Instruksi
                    </Label>
                    <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                        {instructions.map(inst => (
                            <label
                                key={inst.id}
                                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-all text-sm ${selectedInstructions.includes(inst.id)
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 bg-white'
                                    }`}
                            >
                                <Checkbox
                                    checked={selectedInstructions.includes(inst.id)}
                                    onCheckedChange={() => toggleInstruction(inst.id)}
                                />
                                <span className="line-clamp-1">{inst.name}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Recipients */}
                <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Penerima ({selectedRecipients.length} dipilih)
                    </Label>
                    <div className="space-y-1 max-h-40 overflow-y-auto border rounded-lg p-2">
                        {recipients.map(user => (
                            <label
                                key={user.id}
                                className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-all ${selectedRecipients.includes(user.id)
                                    ? 'bg-blue-50'
                                    : 'hover:bg-gray-50'
                                    }`}
                            >
                                <Checkbox
                                    checked={selectedRecipients.includes(user.id)}
                                    onCheckedChange={() => toggleRecipient(user.id)}
                                />
                                <span className="text-sm">{user.name}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                    <Label>Catatan (opsional)</Label>
                    <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Catatan tambahan..."
                        rows={2}
                    />
                </div>

                {/* Submit */}
                <Button
                    onClick={handleSubmit}
                    disabled={isLoading || selectedRecipients.length === 0 || selectedInstructions.length === 0}
                    className="w-full"
                    size="lg"
                >
                    {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                    Buat Disposisi
                </Button>
            </div>
        )
    }

    // Success Step
    if (step === 'success') {
        return (
            <div className="p-6 text-center space-y-4">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-green-600">Disposisi Berhasil!</h2>
                <p className="text-gray-500 text-sm">
                    Disposisi telah dibuat. Silakan cek WhatsApp untuk link mengisi nomor dan TTE.
                </p>
                <Button onClick={() => window.close()} variant="outline" className="w-full">
                    Tutup
                </Button>
            </div>
        )
    }

    // Error Step
    return (
        <div className="p-6 text-center space-y-4">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-red-600">Terjadi Kesalahan</h2>
            <p className="text-gray-500 text-sm">{error || 'Link tidak valid atau sudah kadaluarsa.'}</p>
            <Button onClick={() => window.close()} variant="outline" className="w-full">
                Tutup
            </Button>
        </div>
    )
}
