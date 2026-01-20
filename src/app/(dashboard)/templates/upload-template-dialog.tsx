'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Upload, Loader2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { createTemplate } from '@/actions/templates'

export function UploadTemplateDialog() {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!file || !title) return

        try {
            setIsLoading(true)
            const formData = new FormData()
            formData.append('file', file)
            formData.append('title', title)
            formData.append('description', description)

            const result = await createTemplate(formData)

            if (result.success) {
                toast.success('Template berhasil diunggah')
                setOpen(false)
                setTitle('')
                setDescription('')
                setFile(null)
                router.refresh()
            } else {
                toast.error(result.error)
            }
        } catch (error) {
            toast.error('Terjadi kesalahan')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Tambah Template
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Unggah Template Baru</DialogTitle>
                    <DialogDescription>
                        Unggah file template surat (PDF atau Word) untuk dibagikan.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Nama Template</Label>
                        <Input
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Contoh: Surat Tugas Luar Kota"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Deskripsi (Opsional)</Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Deskripsi singkat penggunaan template ini..."
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="file">File Template</Label>
                        <div className="border border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors relative">
                            <input
                                type="file"
                                id="file"
                                accept=".pdf,.doc,.docx"
                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                required
                            />
                            {file ? (
                                <div className="flex items-center justify-center gap-2 text-sm text-foreground font-medium">
                                    <FileText className="h-4 w-4" />
                                    <span className="truncate max-w-[200px]">{file.name}</span>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                                    <Upload className="h-6 w-6" />
                                    <span className="text-xs">Klik untuk pilih file (PDF/Word)</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={isLoading || !file || !title}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Unggah
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
