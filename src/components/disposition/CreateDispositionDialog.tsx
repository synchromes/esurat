'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    Inbox,
    Loader2,
    Users,
    AlertTriangle,
    Check
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
    createDisposition,
    getDispositionInstructions,
    getEligibleRecipients,
    DispositionUrgency
} from '@/actions/dispositions'

interface CreateDispositionDialogProps {
    letterId: string
    letterTitle: string
}

type Instruction = {
    id: string
    name: string
    sortOrder: number
}

type Recipient = {
    id: string
    name: string
    email: string
    roles: string[]
}

const urgencyOptions = [
    { value: 'BIASA', label: 'Biasa' },
    { value: 'SEGERA', label: 'Segera' },
    { value: 'SANGAT_SEGERA', label: 'Sangat Segera' },
    { value: 'RAHASIA', label: 'Rahasia' },
]

export function CreateDispositionDialog({ letterId, letterTitle }: CreateDispositionDialogProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    const [instructions, setInstructions] = useState<Instruction[]>([])
    const [recipients, setRecipients] = useState<Recipient[]>([])

    const [selectedRecipients, setSelectedRecipients] = useState<string[]>([])
    const [selectedInstructions, setSelectedInstructions] = useState<string[]>([])
    const [urgency, setUrgency] = useState<DispositionUrgency>('BIASA')
    const [notes, setNotes] = useState('')

    // Load data when dialog opens
    useEffect(() => {
        if (open) {
            setIsLoading(true)
            Promise.all([
                getDispositionInstructions(),
                getEligibleRecipients()
            ]).then(([instrResult, recipResult]) => {
                if (instrResult.success) {
                    setInstructions(instrResult.data || [])
                }
                if (recipResult.success) {
                    setRecipients(recipResult.data || [])
                }
                setIsLoading(false)
            })
        }
    }, [open])

    const handleSubmit = () => {
        if (selectedRecipients.length === 0) {
            toast.error('Pilih minimal satu penerima')
            return
        }

        if (selectedInstructions.length === 0) {
            toast.error('Pilih minimal satu instruksi')
            return
        }

        startTransition(async () => {
            const result = await createDisposition({
                letterId,
                recipientIds: selectedRecipients,
                instructionIds: selectedInstructions,
                urgency,
                notes: notes || undefined
            })

            if (result.success) {
                toast.success('Disposisi berhasil dibuat')
                setOpen(false)
                setSelectedRecipients([])
                setSelectedInstructions([])
                setUrgency('BIASA')
                setNotes('')
                router.refresh()
            } else {
                toast.error(result.error)
            }
        })
    }

    const toggleRecipient = (recipientId: string) => {
        setSelectedRecipients(prev =>
            prev.includes(recipientId)
                ? prev.filter(id => id !== recipientId)
                : [...prev, recipientId]
        )
    }

    const toggleInstruction = (instructionId: string) => {
        setSelectedInstructions(prev =>
            prev.includes(instructionId)
                ? prev.filter(id => id !== instructionId)
                : [...prev, instructionId]
        )
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Inbox className="mr-2 h-4 w-4" />
                    Buat Disposisi
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Buat Disposisi</DialogTitle>
                    <DialogDescription>
                        Disposisikan surat &quot;{letterTitle}&quot;
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Urgency */}
                        <div className="space-y-2">
                            <Label>Sifat</Label>
                            <Select value={urgency} onValueChange={(val) => setUrgency(val as DispositionUrgency)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih sifat" />
                                </SelectTrigger>
                                <SelectContent>
                                    {urgencyOptions.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Recipients */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                Penerima
                            </Label>
                            <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                                {recipients.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Tidak ada penerima tersedia</p>
                                ) : (
                                    recipients.map(recipient => (
                                        <div key={recipient.id} className="flex items-center gap-2">
                                            <Checkbox
                                                id={`recipient-${recipient.id}`}
                                                checked={selectedRecipients.includes(recipient.id)}
                                                onCheckedChange={() => toggleRecipient(recipient.id)}
                                            />
                                            <label
                                                htmlFor={`recipient-${recipient.id}`}
                                                className="text-sm cursor-pointer flex-1 flex items-center justify-between"
                                            >
                                                <span>{recipient.name}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {recipient.roles.join(', ')}
                                                </span>
                                            </label>
                                        </div>
                                    ))
                                )}
                            </div>
                            {selectedRecipients.length > 0 && (
                                <p className="text-xs text-muted-foreground">
                                    {selectedRecipients.length} penerima dipilih
                                </p>
                            )}
                        </div>

                        {/* Instructions */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <Check className="h-4 w-4" />
                                Instruksi
                            </Label>
                            <div className="border rounded-md p-3 max-h-64 overflow-y-auto">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {instructions.map(instruction => (
                                        <div key={instruction.id} className="flex items-center gap-2">
                                            <Checkbox
                                                id={`instruction-${instruction.id}`}
                                                checked={selectedInstructions.includes(instruction.id)}
                                                onCheckedChange={() => toggleInstruction(instruction.id)}
                                            />
                                            <label
                                                htmlFor={`instruction-${instruction.id}`}
                                                className="text-sm cursor-pointer"
                                            >
                                                {instruction.name}
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                            <Label>Catatan (opsional)</Label>
                            <Textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Catatan tambahan untuk disposisi..."
                                rows={3}
                            />
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Batal
                    </Button>
                    <Button onClick={handleSubmit} disabled={isPending || isLoading}>
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Buat Disposisi
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
