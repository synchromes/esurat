'use client'

import { useState, useCallback, useRef, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import {
    FileText,
    Upload,
    X,
    ArrowLeft,
    Loader2,
    QrCode,
    Move,
    ChevronLeft,
    ChevronRight,
    UserCheck,
    PenTool,
    Pencil
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import Link from 'next/link'
import { createLetter } from '@/actions/letters'
import { getApprovers, getSigners, getCategories } from '@/actions/options'
import { getArchiveCodes } from '@/actions/archive-codes'
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'



const createLetterSchema = z.object({
    title: z.string().min(1, 'Judul harus diisi').max(255),
    description: z.string().optional(),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
    securityLevel: z.enum(['SANGAT_RAHASIA', 'RAHASIA', 'TERBATAS', 'BIASA']),
    categoryId: z.string().optional(),
    assignedApproverId: z.string().optional(),
    assignedSignerId: z.string().optional(),
    letterNumber: z.string().min(1, 'Nomor surat harus diisi')
})

type CreateLetterForm = z.infer<typeof createLetterSchema>

type UserOption = { id: string; name: string; email: string; role: string }
type CategoryOption = { id: string; name: string; code: string; color: string }
type ArchiveCodeOption = { id: string; code: string; name: string | null; description: string | null }
type ApproverItem = {
    userId: string
    tempId: string // For internal key and drag tracking
    name: string
    role: string
    parafX: number
    parafY: number
    parafSize: number
}

export default function CreateLetterPage() {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [file, setFile] = useState<File | null>(null)
    const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null)
    const [qrPosition, setQrPosition] = useState({ x: 0.75, y: 0.80 })
    const [qrSize, setQrSize] = useState(100)
    // Removed single paraf state: const [parafPosition, setParafPosition] = useState({ x: 0.75, y: 0.70 })
    // Removed single paraf state: const [parafSize, setParafSize] = useState(50)
    const [selectedApprovers, setSelectedApprovers] = useState<ApproverItem[]>([])
    const [activeParafId, setActiveParafId] = useState<string | null>(null) // For tabs/selection

    const [qrPage, setQrPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [isDragging, setIsDragging] = useState(false)
    const [isDraggingQr, setIsDraggingQr] = useState(false)
    const [draggingParafId, setDraggingParafId] = useState<string | null>(null)
    const [isLoadingPdf, setIsLoadingPdf] = useState(false)
    const [approvers, setApprovers] = useState<UserOption[]>([])
    const [signers, setSigners] = useState<UserOption[]>([])
    const [categories, setCategories] = useState<CategoryOption[]>([])
    const [archiveCodes, setArchiveCodes] = useState<ArchiveCodeOption[]>([])
    const [openArchive, setOpenArchive] = useState(false)
    const [openCategory, setOpenCategory] = useState(false) // State for Category search
    const [selectedArchive, setSelectedArchive] = useState<string>('')
    const [letterNumberPrefix, setLetterNumberPrefix] = useState('')
    const [letterNumberSuffix, setLetterNumberSuffix] = useState('')

    const containerRef = useRef<HTMLDivElement>(null)
    // A4 PDF width in points for consistent size calculation
    const PDF_A4_WIDTH = 595.28

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const animationFrameRef = useRef<number | null>(null)
    const pendingPositionRef = useRef<{ x: number; y: number } | null>(null)

    const {
        register,
        handleSubmit,
        formState: { errors },
        setValue,
        watch
    } = useForm<CreateLetterForm>({
        resolver: zodResolver(createLetterSchema),
        defaultValues: {
            title: '',
            description: '',
            priority: 'NORMAL',
            securityLevel: 'BIASA',
            categoryId: undefined,
            // assignedApproverId: undefined, // Removed form field
            assignedSignerId: undefined,
            letterNumber: ''
        }
    })

    // Update letterNumber when composite parts change
    useEffect(() => {
        if (letterNumberPrefix || selectedArchive || letterNumberSuffix) {
            const fullNumber = `${letterNumberPrefix || '...'}/${selectedArchive || '...'}/${letterNumberSuffix || '...'}`
            // We only set the value if at least one part is present. 
            // The validation will still fail if user doesn't fill enough, but at least we sync.
            // Actually, we should probably construct the cleaned version for submission?
            // User requested format: 243/KP.02.01/II.20/I/2026
            // If parts are empty, we might just leave them as empty string in join?
            // Let's use clean join.
            const parts = [
                letterNumberPrefix,
                selectedArchive,
                letterNumberSuffix
            ].filter(Boolean)

            // For now, adhere to the explicit slash format requested: Prefix / Code / Suffix
            // If prefix missing? ".../Code/Suffix"? 
            // Let's just set the raw string with slashes as that seems to be the format.
            setValue('letterNumber', `${letterNumberPrefix}/${selectedArchive}/${letterNumberSuffix}`)
        }
    }, [letterNumberPrefix, selectedArchive, letterNumberSuffix, setValue])

    // Load options on mount
    useEffect(() => {
        const loadOptions = async () => {
            const [approversData, signersData, categoriesData, archiveCodesResult] = await Promise.all([
                getApprovers(),
                getSigners(),
                getCategories(),
                getArchiveCodes()
            ])
            setApprovers(approversData)
            setSigners(signersData)
            setCategories(categoriesData)
            if (archiveCodesResult.success && archiveCodesResult.data) {
                setArchiveCodes(archiveCodesResult.data)
            }
        }
        loadOptions()
    }, [])

    // Render PDF page to canvas
    const renderPage = useCallback(async (doc: PDFDocumentProxy, pageNum: number) => {
        if (!canvasRef.current) return

        try {
            const page = await doc.getPage(pageNum)
            const canvas = canvasRef.current
            const context = canvas.getContext('2d')
            if (!context) return

            // Use parent element width (minus padding) to calculate available width
            const parentElement = containerRef.current?.parentElement
            // 32px accounts for p-4 (16px * 2)
            const availableWidth = parentElement ? parentElement.clientWidth - 48 : 600

            const viewport = page.getViewport({ scale: 1 })
            const scale = availableWidth / viewport.width

            const scaledViewport = page.getViewport({ scale })
            canvas.width = scaledViewport.width
            canvas.height = scaledViewport.height

            await page.render({
                canvasContext: context,
                viewport: scaledViewport
            } as any).promise
        } catch (error) {
            console.error('Error rendering page:', error)
        }
    }, [])

    // Load PDF and get page count
    const loadPdf = useCallback(async (pdfFile: File) => {
        setIsLoadingPdf(true)
        try {
            const pdfjsLib = await import('pdfjs-dist')
            pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

            const arrayBuffer = await pdfFile.arrayBuffer()
            const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
            setPdfDoc(doc)
            setTotalPages(doc.numPages)
            setQrPage(1)
            await renderPage(doc, 1)
        } catch (error) {
            console.error('Error loading PDF:', error)
            toast.error('Gagal memuat PDF')
        } finally {
            setIsLoadingPdf(false)
        }
    }, [renderPage])

    // Re-render when page changes
    useEffect(() => {
        if (pdfDoc && qrPage >= 1 && qrPage <= totalPages) {
            renderPage(pdfDoc, qrPage)
        }
    }, [pdfDoc, qrPage, totalPages, renderPage])

    const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile) {
            if (selectedFile.type !== 'application/pdf') {
                toast.error('Hanya file PDF yang diperbolehkan')
                return
            }
            if (selectedFile.size > 10 * 1024 * 1024) {
                toast.error('Ukuran file maksimal 10MB')
                return
            }
            setFile(selectedFile)
            await loadPdf(selectedFile)
        }
    }, [loadPdf])

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        const droppedFile = e.dataTransfer.files[0]
        if (droppedFile) {
            if (droppedFile.type !== 'application/pdf') {
                toast.error('Hanya file PDF yang diperbolehkan')
                return
            }
            if (droppedFile.size > 10 * 1024 * 1024) {
                toast.error('Ukuran file maksimal 10MB')
                return
            }
            setFile(droppedFile)
            await loadPdf(droppedFile)
        }
    }, [loadPdf])

    // Smooth drag using requestAnimationFrame
    const updateQrPosition = useCallback(() => {
        if (pendingPositionRef.current) {
            setQrPosition(pendingPositionRef.current)
            pendingPositionRef.current = null
        }
        animationFrameRef.current = null
    }, [])

    const getClientCoordinates = (e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) => {
        if ('touches' in e) {
            return {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY
            }
        }
        return {
            x: (e as MouseEvent).clientX,
            y: (e as MouseEvent).clientY
        }
    }

    const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent, type: 'QR' | 'PARAF', id?: string) => {
        // e.preventDefault() // Let event bubble for now, preventDefault on move
        e.stopPropagation()
        if (type === 'QR') setIsDraggingQr(true)
        if (type === 'PARAF' && id) {
            setDraggingParafId(id)
            setActiveParafId(id)
        }
    }, [])

    const handleContainerClick = useCallback((e: React.MouseEvent) => {
        if (isDraggingQr || draggingParafId) return
        if (!canvasRef.current) return

        const target = e.target as HTMLElement
        if (target.closest('[data-qr-element]')) return

        // Optional: Click to move active item?
        // Disabled for now to prevent accidental jumps
    }, [isDraggingQr, draggingParafId])

    useEffect(() => {
        const handleGlobalEnd = () => {
            setIsDraggingQr(false)
            setDraggingParafId(null)
        }

        const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
            if ((!isDraggingQr && !draggingParafId) || !canvasRef.current) return

            // Prevent scrolling if dragging on touch
            if (e.type === 'touchmove') {
                e.preventDefault()
            }

            const rect = canvasRef.current.getBoundingClientRect()
            const { x: clientX, y: clientY } = getClientCoordinates(e)

            const x = (clientX - rect.left) / rect.width
            const y = (clientY - rect.top) / rect.height

            // Allow dragging slightly outside but clamp to 0-1 for storage
            const clampedX = Math.max(0, Math.min(1, x))
            const clampedY = Math.max(0, Math.min(1, y))

            if (isDraggingQr) {
                setQrPosition({ x: clampedX, y: clampedY })
            } else if (draggingParafId) {
                setSelectedApprovers(prev => prev.map(item =>
                    item.tempId === draggingParafId
                        ? { ...item, parafX: clampedX, parafY: clampedY }
                        : item
                ))
            }
        }

        window.addEventListener('mouseup', handleGlobalEnd)
        window.addEventListener('mousemove', handleGlobalMove)
        window.addEventListener('touchend', handleGlobalEnd)
        window.addEventListener('touchmove', handleGlobalMove, { passive: false })

        return () => {
            window.removeEventListener('mouseup', handleGlobalEnd)
            window.removeEventListener('mousemove', handleGlobalMove)
            window.removeEventListener('touchend', handleGlobalEnd)
            window.removeEventListener('touchmove', handleGlobalMove)
        }
    }, [isDraggingQr, draggingParafId])

    const removeFile = () => {
        setFile(null)
        setPdfDoc(null)
        setQrPage(1)
        setTotalPages(1)
    }

    const goToPage = (page: number) => {
        const validPage = Math.max(1, Math.min(totalPages, page))
        setQrPage(validPage)
    }

    const onSubmit = async (data: CreateLetterForm) => {
        if (!file) {
            toast.error('Silakan unggah file PDF terlebih dahulu')
            return
        }

        startTransition(async () => {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('title', data.title)
            formData.append('description', data.description || '')
            formData.append('priority', data.priority)
            formData.append('securityLevel', data.securityLevel)
            formData.append('categoryId', data.categoryId || '')
            formData.append('qrPage', String(qrPage))
            formData.append('qrXPercent', String(qrPosition.x))
            formData.append('qrYPercent', String(qrPosition.y))
            formData.append('qrSize', String(qrSize))
            // FormData for parafs is handled via 'approvers' JSON
            // Reconstruct approvers list for JSON, we use the selectedApprovers state
            const finalApprovers = selectedApprovers.map(a => ({
                userId: a.userId,
                parafXPercent: a.parafX,
                parafYPercent: a.parafY,
                parafSize: a.parafSize,
                // Order is implicit by index in selectedApprovers
            }))

            formData.append('approvers', JSON.stringify(finalApprovers))
            formData.append('parafPage', String(qrPage)) // Still need global page or per-item? Plan said global for simplicity or specific. Backend handles `a.parafPage`? Our type has `parafPage`? No, we used global `qrPage` for all. Let's assume all on same page for now, or add `parafPage` to ApproverItem if we want multi-page. 
            // The user didn't explicitly ask for multi-page parafs, but it's good to implicitly use current qrPage? 
            // Wait, if user changes page, qrPosition might move?
            // Let's assume all parafs are on the `qrPage`.

            // formData.append('assignedApproverId', data.assignedApproverId || '') // Removed
            formData.append('assignedSignerId', data.assignedSignerId || '')
            formData.append('letterNumber', data.letterNumber)

            const result = await createLetter(formData)

            if (result.success) {
                toast.success('Surat berhasil dibuat!')
                router.push(`/letters/${result.letterId}`)
            } else {
                toast.error(result.error || 'Gagal membuat surat')
            }
        })
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/letters">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Buat Surat Baru</h1>
                    <p className="text-muted-foreground">
                        Unggah dokumen PDF dan tentukan posisi QR Code
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)}>
                <div className="flex flex-col-reverse lg:grid lg:grid-cols-2 gap-6">
                    {/* Left Column (Bottom on Mobile) - Form */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <FileText className="h-5 w-5" />
                                    Informasi Surat
                                </CardTitle>
                                <CardDescription>
                                    Masukkan detail dokumen yang akan dibuat
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="title">Judul Surat *</Label>
                                    <Input
                                        id="title"
                                        placeholder="Contoh: Surat Keterangan Kerja"
                                        {...register('title')}
                                        disabled={isPending}
                                    />
                                    {errors.title && (
                                        <p className="text-sm text-destructive">{errors.title.message}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="description">Deskripsi</Label>
                                    <Textarea
                                        id="description"
                                        placeholder="Deskripsi singkat tentang surat ini..."
                                        rows={3}
                                        {...register('description')}
                                        disabled={isPending}
                                    />
                                </div>


                                <div className="space-y-2">
                                    <Label>Nomor Surat</Label>
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                        {/* Prefix / Nomor Urut */}
                                        <div className="flex items-center gap-2 w-full sm:w-auto">
                                            <Input
                                                placeholder="No. Urut"
                                                className="w-full sm:w-[100px]"
                                                value={letterNumberPrefix}
                                                onChange={(e) => setLetterNumberPrefix(e.target.value)}
                                                disabled={isPending}
                                            />
                                            <span className="text-muted-foreground font-semibold sm:hidden">/</span>
                                            <span className="text-muted-foreground font-semibold hidden sm:inline">/</span>
                                        </div>

                                        {/* Archive Code Picker */}
                                        <div className="flex items-center gap-2 w-full sm:w-auto">
                                            <Popover open={openArchive} onOpenChange={setOpenArchive}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        aria-expanded={openArchive}
                                                        className="w-full sm:w-[250px] justify-between px-3"
                                                        disabled={isPending}
                                                    >
                                                        <span className="truncate">
                                                            {selectedArchive || "Kode Arsip..."}
                                                        </span>
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[300px] sm:w-[400px] p-0">
                                                    <Command>
                                                        <CommandInput placeholder="Cari kode arsip..." />
                                                        <CommandList>
                                                            <CommandEmpty>Kode tidak ditemukan.</CommandEmpty>
                                                            <CommandGroup>
                                                                {archiveCodes.slice(0, 100).map((code) => (
                                                                    <CommandItem
                                                                        key={code.code}
                                                                        value={`${code.code} ${code.name}`}
                                                                        onSelect={() => {
                                                                            setSelectedArchive(code.code)
                                                                            setOpenArchive(false)
                                                                        }}
                                                                    >
                                                                        <Check
                                                                            className={cn(
                                                                                "mr-2 h-4 w-4",
                                                                                selectedArchive === code.code ? "opacity-100" : "opacity-0"
                                                                            )}
                                                                        />
                                                                        <div className="flex flex-col">
                                                                            <span className="font-medium">{code.code}</span>
                                                                            <span className="text-xs text-muted-foreground truncate">{code.name}</span>
                                                                        </div>
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                            <span className="text-muted-foreground font-semibold sm:hidden">/</span>
                                            <span className="text-muted-foreground font-semibold hidden sm:inline">/</span>
                                        </div>

                                        {/* Suffix / Lanjutan */}
                                        <Input
                                            placeholder="Lanjutan (Mis: II.20/I/2026)"
                                            className="w-full sm:flex-1"
                                            value={letterNumberSuffix}
                                            onChange={(e) => setLetterNumberSuffix(e.target.value)}
                                            disabled={isPending}
                                        />
                                    </div>
                                    <Input
                                        type="hidden"
                                        {...register('letterNumber')}
                                    />
                                    {errors.letterNumber && (
                                        <p className="text-sm text-destructive">{errors.letterNumber.message}</p>
                                    )}
                                    <p className="text-xs text-muted-foreground">
                                        Format: [No. Urut] / [Kode Arsip] / [Lanjutan]
                                    </p>
                                    <div className="text-xs bg-muted p-2 rounded text-muted-foreground">
                                        Preview: <span className="font-medium font-mono text-foreground">
                                            {letterNumberPrefix ? `${letterNumberPrefix}` : '...'}
                                            /
                                            {selectedArchive || '...'}
                                            /
                                            {letterNumberSuffix ? `${letterNumberSuffix}` : '...'}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Kategori</Label>
                                        <Popover open={openCategory} onOpenChange={setOpenCategory}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    aria-expanded={openCategory}
                                                    className="w-full justify-between"
                                                    disabled={isPending}
                                                >
                                                    <span className="truncate">
                                                        {watch('categoryId')
                                                            ? categories.find((cat) => cat.id === watch('categoryId'))?.name
                                                            : "Pilih kategori..."}
                                                    </span>
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[400px] p-0">
                                                <Command>
                                                    <CommandInput placeholder="Cari kategori..." />
                                                    <CommandList>
                                                        <CommandEmpty>Kategori tidak ditemukan.</CommandEmpty>
                                                        <CommandGroup>
                                                            {categories.map((cat) => (
                                                                <CommandItem
                                                                    key={cat.id}
                                                                    value={`${cat.code} ${cat.name}`}
                                                                    onSelect={() => {
                                                                        setValue('categoryId', cat.id)
                                                                        setOpenCategory(false)
                                                                    }}
                                                                >
                                                                    <Check
                                                                        className={cn(
                                                                            "mr-2 h-4 w-4",
                                                                            watch('categoryId') === cat.id ? "opacity-100" : "opacity-0"
                                                                        )}
                                                                    />
                                                                    <div className="flex flex-col">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                                                                            <span className="font-medium">{cat.name}</span>
                                                                        </div>
                                                                        <span className="text-xs text-muted-foreground">{cat.name}</span>
                                                                    </div>
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Prioritas</Label>
                                        <Select
                                            defaultValue="NORMAL"
                                            onValueChange={(value) => setValue('priority', value as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT')}
                                            disabled={isPending}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Pilih prioritas" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="LOW">Biasa</SelectItem>
                                                <SelectItem value="NORMAL">Segera</SelectItem>
                                                <SelectItem value="HIGH">Sangat Segera</SelectItem>
                                                {/* <SelectItem value="URGENT">Urgent</SelectItem> */}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Klasifikasi Surat</Label>
                                    <Select
                                        defaultValue="BIASA"
                                        onValueChange={(value) => setValue('securityLevel', value as any)}
                                        disabled={isPending}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Pilih tingkat keamanan" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="BIASA">Biasa (B)</SelectItem>
                                            <SelectItem value="TERBATAS">Terbatas (T)</SelectItem>
                                            <SelectItem value="RAHASIA">Rahasia (R)</SelectItem>
                                            <SelectItem value="SANGAT_RAHASIA">Sangat Rahasia (SR)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Approver & Signer Selection */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <UserCheck className="h-5 w-5" />
                                    Alur Persetujuan
                                </CardTitle>
                                <CardDescription>
                                    Tentukan siapa yang akan menyetujui dan menandatangani surat
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <UserCheck className="h-4 w-4 text-blue-500" />
                                        Daftar Penyetuju (Urut dari Pertama)
                                    </Label>

                                    <div className="space-y-2 mb-4">
                                        {selectedApprovers.map((approver, index) => (
                                            <div key={approver.tempId} className="flex items-center gap-2 p-2 border rounded bg-muted/20">
                                                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                                                    {index + 1}
                                                </div>
                                                <div className="flex-1 overflow-hidden">
                                                    <p className="font-medium text-sm truncate">{approver.name}</p>
                                                    <p className="text-xs text-muted-foreground truncate">{approver.role}</p>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                    onClick={() => setSelectedApprovers(prev => prev.filter(a => a.tempId !== approver.tempId))}
                                                    disabled={isPending}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}

                                        {selectedApprovers.length === 0 && (
                                            <div className="text-center p-4 border border-dashed rounded text-muted-foreground text-sm">
                                                Belum ada penyetuju dipilih
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-2">
                                        <Select
                                            onValueChange={(userId) => {
                                                const user = approvers.find(u => u.id === userId)
                                                if (user) {
                                                    // Add to list
                                                    if (selectedApprovers.length >= 8) {
                                                        toast.error('Maksimal 8 penyetuju')
                                                        return
                                                    }
                                                    if (selectedApprovers.find(a => a.userId === userId)) {
                                                        toast.error('User ini sudah dipilih')
                                                        return
                                                    }
                                                    const newApprover: ApproverItem = {
                                                        userId: user.id,
                                                        tempId: Math.random().toString(36).substring(7),
                                                        name: user.name,
                                                        role: user.role,
                                                        parafX: 0.75, // Default pos
                                                        parafY: 0.70 - (selectedApprovers.length * 0.1), // Stagger positions
                                                        parafSize: 50
                                                    }
                                                    setSelectedApprovers(prev => [...prev, newApprover])
                                                    setActiveParafId(newApprover.tempId)
                                                }
                                            }}
                                            disabled={isPending || selectedApprovers.length >= 8}
                                        >
                                            <SelectTrigger className="flex-1">
                                                <SelectValue placeholder="Tambah Penyetuju..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {approvers.map((user) => (
                                                    <SelectItem key={user.id} value={user.id} disabled={selectedApprovers.some(a => a.userId === user.id)}>
                                                        <span className="flex items-center gap-2">
                                                            <span className="font-medium">{user.name}</span>
                                                            <span className="text-muted-foreground text-xs">({user.role})</span>
                                                        </span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-2">
                                        Maksimal 8 penyetuju. Urutan menentukan alur persetujuan.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <PenTool className="h-4 w-4 text-green-500" />
                                        Yang Menandatangani
                                    </Label>
                                    <Select
                                        onValueChange={(value) => setValue('assignedSignerId', value)}
                                        disabled={isPending}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Pilih yang akan menandatangani" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {signers.map((user) => (
                                                <SelectItem key={user.id} value={user.id}>
                                                    <span className="flex items-center gap-2">
                                                        <span className="font-medium">{user.name}</span>
                                                        <span className="text-muted-foreground text-xs">({user.role})</span>
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        Orang yang akan menandatangani surat setelah disetujui
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Right Column (Top on Mobile) - Upload & Preview */}
                    </div>

                    {/* Right Column - Upload & Preview */}
                    <div className="space-y-6">
                        {/* File Upload */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Upload className="h-5 w-5" />
                                    Unggah Dokumen
                                </CardTitle>
                                <CardDescription>
                                    Unggah file PDF (maksimal 10MB)
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {!file ? (
                                    <div
                                        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}`}
                                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                                        onDragLeave={() => setIsDragging(false)}
                                        onDrop={handleDrop}
                                    >
                                        <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                                        <p className="mt-2 text-sm text-muted-foreground">
                                            Seret dan lepas file PDF di sini, atau
                                        </p>
                                        <label htmlFor="file-upload">
                                            <Button type="button" variant="outline" className="mt-2" asChild>
                                                <span>Pilih File</span>
                                            </Button>
                                            <input
                                                id="file-upload"
                                                type="file"
                                                accept=".pdf"
                                                className="hidden"
                                                onChange={handleFileChange}
                                                disabled={isPending}
                                            />
                                        </label>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between p-4 border rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <FileText className="h-8 w-8 text-red-500" />
                                            <div>
                                                <p className="font-medium truncate max-w-[200px]">{file.name}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {(file.size / 1024 / 1024).toFixed(2)} MB • {isLoadingPdf ? 'Membaca...' : `${totalPages} halaman`}
                                                </p>
                                            </div>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={removeFile}
                                            disabled={isPending}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                        <Card className="h-full">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <QrCode className="h-5 w-5" />
                                    Posisi Tanda Tangan
                                </CardTitle>
                                <CardDescription>
                                    Atur posisi QR Code (tanda tangan) dan Paraf (inisial)
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="h-[calc(100vh-12rem)] min-h-[500px] flex flex-col">
                                {file ? (
                                    <>
                                        <div className="mb-4 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    type="button"
                                                    onClick={() => goToPage(qrPage - 1)}
                                                    disabled={qrPage <= 1}
                                                >
                                                    <ChevronLeft className="h-4 w-4" />
                                                </Button>
                                                <span className="text-sm font-medium">
                                                    Hal {qrPage} dari {totalPages}
                                                </span>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    type="button"
                                                    onClick={() => goToPage(qrPage + 1)}
                                                    disabled={qrPage >= totalPages}
                                                >
                                                    <ChevronRight className="h-4 w-4" />
                                                </Button>
                                            </div>

                                            <Tabs defaultValue="qr" className="w-[300px]">
                                                <TabsList className="grid w-full grid-cols-2">
                                                    <TabsTrigger value="qr">QR Code</TabsTrigger>
                                                    <TabsTrigger value="paraf">Paraf</TabsTrigger>
                                                </TabsList>
                                                <TabsContent value="qr" className="space-y-2">
                                                    <div className="flex items-center gap-4">
                                                        <Label className="whitespace-nowrap">Ukuran</Label>
                                                        <Slider
                                                            value={[qrSize]}
                                                            onValueChange={(vals) => setQrSize(vals[0])}
                                                            min={50}
                                                            max={200}
                                                            step={10}
                                                        />
                                                        <span className="w-12 text-sm text-right">{qrSize}px</span>
                                                    </div>
                                                </TabsContent>
                                                <TabsContent value="paraf" className="space-y-4">
                                                    {selectedApprovers.length > 0 ? (
                                                        <>
                                                            <div className="flex flex-wrap gap-2 mb-2">
                                                                {selectedApprovers.map((approver, idx) => (
                                                                    <Button
                                                                        key={approver.tempId}
                                                                        variant={activeParafId === approver.tempId ? "default" : "outline"}
                                                                        size="sm"
                                                                        onClick={() => setActiveParafId(approver.tempId)}
                                                                        className="text-xs"
                                                                    >
                                                                        #{idx + 1}
                                                                    </Button>
                                                                ))}
                                                            </div>
                                                            {activeParafId && (() => {
                                                                const activeItem = selectedApprovers.find(a => a.tempId === activeParafId)
                                                                if (!activeItem) return null
                                                                return (
                                                                    <div className="flex items-center gap-4">
                                                                        <Label className="whitespace-nowrap">Ukuran #{selectedApprovers.indexOf(activeItem) + 1}</Label>
                                                                        <Slider
                                                                            value={[activeItem.parafSize]}
                                                                            onValueChange={(vals) => {
                                                                                setSelectedApprovers(prev => prev.map(a => a.tempId === activeParafId ? { ...a, parafSize: vals[0] } : a))
                                                                            }}
                                                                            min={20}
                                                                            max={100}
                                                                            step={5}
                                                                        />
                                                                        <span className="w-12 text-sm text-right">{activeItem.parafSize}px</span>
                                                                    </div>
                                                                )
                                                            })()}
                                                        </>
                                                    ) : (
                                                        <div className="text-sm text-muted-foreground text-center py-2">
                                                            Belum ada penyetuju
                                                        </div>
                                                    )}
                                                </TabsContent>
                                            </Tabs>
                                        </div>

                                        <div className="relative flex-1 bg-muted/20 border rounded-lg overflow-auto flex flex-col items-center p-4">
                                            {isLoadingPdf ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                    <p className="text-sm text-muted-foreground">Memuat PDF...</p>
                                                </div>
                                            ) : (
                                                <div
                                                    ref={containerRef}
                                                    className="relative shadow-lg"
                                                    onClick={handleContainerClick}
                                                >
                                                    <canvas ref={canvasRef} className="block max-w-full h-auto" />

                                                    {/* QR Code Draggable */}
                                                    <div
                                                        data-qr-element
                                                        className={cn(
                                                            "absolute cursor-move group border-2 border-primary bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-md transition-shadow hover:shadow-xl",
                                                            isDraggingQr && "ring-2 ring-primary ring-offset-2 z-50"
                                                        )}
                                                        style={{
                                                            left: `${qrPosition.x * 100}%`,
                                                            top: `${qrPosition.y * 100}%`,
                                                            width: `${(qrSize / PDF_A4_WIDTH) * 100}%`,
                                                            aspectRatio: '1',
                                                            transform: 'translate(-50%, -50%)',
                                                        }}
                                                        onMouseDown={(e) => handleDragStart(e, 'QR')}
                                                        onTouchStart={(e) => handleDragStart(e, 'QR')}
                                                    >
                                                        <QrCode className="w-1/2 h-1/2 text-primary" />
                                                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                                            QR Code (Kepsta)
                                                        </div>
                                                    </div>

                                                    {/* Paraf Draggables */}
                                                    {selectedApprovers.map((approver, index) => (
                                                        <div
                                                            key={approver.tempId}
                                                            className={cn(
                                                                "absolute cursor-move group border-2 flex items-center justify-center shadow-md transition-shadow hover:shadow-xl",
                                                                activeParafId === approver.tempId ? "border-blue-500 bg-blue-50/80 z-40" : "border-gray-400 bg-white/60 z-30",
                                                                draggingParafId === approver.tempId && "ring-2 ring-blue-500 ring-offset-2 scale-105"
                                                            )}
                                                            style={{
                                                                left: `${approver.parafX * 100}%`,
                                                                top: `${approver.parafY * 100}%`,
                                                                width: `${(approver.parafSize / PDF_A4_WIDTH) * 100}%`,
                                                                aspectRatio: '1',
                                                                transform: 'translate(-50%, -50%)'
                                                            }}
                                                            onMouseDown={(e) => handleDragStart(e, 'PARAF', approver.tempId)}
                                                            onTouchStart={(e) => handleDragStart(e, 'PARAF', approver.tempId)}
                                                            onClick={(e) => { e.stopPropagation(); setActiveParafId(approver.tempId) }}
                                                        >
                                                            <div className="flex flex-col items-center justify-center">
                                                                <Pencil className={cn("w-4 h-4", activeParafId === approver.tempId ? "text-blue-500" : "text-gray-500")} />
                                                                <span className="text-[10px] font-bold mt-1 bg-white/90 px-1 rounded">#{index + 1}</span>
                                                            </div>

                                                            {/* Tooltip on hover */}
                                                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                                                Paraf {index + 1}: {approver.name.split(' ')[0]}
                                                            </div>
                                                        </div>
                                                    ))}

                                                </div>
                                            )}
                                        </div>


                                    </>
                                ) : (
                                    <div className="border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/50 py-32">
                                        <div className="text-center text-muted-foreground">
                                            <FileText className="h-12 w-12 mx-auto" />
                                            <p className="mt-2 text-sm">
                                                Unggah file PDF untuk melihat preview
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end gap-4 mt-6">
                    <Button type="button" variant="outline" asChild disabled={isPending}>
                        <Link href="/letters">Batal</Link>
                    </Button>
                    <Button type="submit" disabled={isPending || !file}>
                        {isPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Menyimpan...
                            </>
                        ) : (
                            <>
                                <FileText className="mr-2 h-4 w-4" />
                                Simpan Draft
                            </>
                        )}
                    </Button>
                </div>
            </form >
        </div >
    )
}
