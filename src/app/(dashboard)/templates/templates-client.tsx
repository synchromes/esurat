'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { FileText, Download, Trash2, MoreVertical, File } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { deleteTemplate } from '@/actions/templates'
import { useRouter } from 'next/navigation'
import { UploadTemplateDialog } from './upload-template-dialog'

interface Template {
    id: string
    title: string
    description: string | null
    fileUrl: string
    fileType: string
    createdAt: Date
    updatedAt: Date
    uploader: {
        name: string
    }
}

interface TemplatesClientProps {
    initialTemplates: Template[]
    canManage: boolean
}

export function TemplatesClient({ initialTemplates, canManage }: TemplatesClientProps) {
    const router = useRouter()
    const [deleteId, setDeleteId] = useState<string | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    const handleDelete = async () => {
        if (!deleteId) return
        try {
            setIsDeleting(true)
            const result = await deleteTemplate(deleteId)
            if (result.success) {
                toast.success('Template berhasil dihapus')
                router.refresh()
            } else {
                toast.error(result.error)
            }
        } catch (error) {
            toast.error('Gagal menghapus template')
        } finally {
            setIsDeleting(false)
            setDeleteId(null)
        }
    }

    return (
        <div className="space-y-6">
            {canManage && (
                <div className="flex justify-end">
                    <UploadTemplateDialog />
                </div>
            )}

            {initialTemplates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/10">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">Belum ada template</h3>
                    <p className="text-muted-foreground max-w-sm mt-1">
                        {canManage
                            ? 'Silakan unggah template surat pertama Anda.'
                            : 'Belum ada template surat yang tersedia saat ini.'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {initialTemplates.map((template) => (
                        <Card key={template.id} className="flex flex-col group hover:shadow-md transition-shadow">
                            <CardHeader className="flex-none pb-3">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "p-2 rounded-lg",
                                            template.fileType === 'PDF' ? "bg-red-100 text-red-600" :
                                                ['DOC', 'DOCX'].includes(template.fileType) ? "bg-blue-100 text-blue-600" :
                                                    "bg-primary/10 text-primary"
                                        )}>
                                            {template.fileType === 'PDF' ? (
                                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9h6m-6 4h6m-6 4h6" />
                                                </svg>
                                            ) : ['DOC', 'DOCX'].includes(template.fileType) ? (
                                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                            ) : (
                                                <File className="h-6 w-6" />
                                            )}
                                        </div>
                                        <div>
                                            <CardTitle className="text-base line-clamp-1" title={template.title}>
                                                {template.title}
                                            </CardTitle>
                                            <CardDescription className="text-xs mt-1">
                                                {format(new Date(template.createdAt), 'd MMM yyyy', { locale: idLocale })}
                                                {' • '}
                                                {template.fileType}
                                            </CardDescription>
                                        </div>
                                    </div>
                                    {canManage && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="-mr-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    className="text-destructive focus:text-destructive"
                                                    onClick={() => setDeleteId(template.id)}
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Hapus
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="flex-1 pb-3">
                                <p className="text-sm text-muted-foreground line-clamp-3">
                                    {template.description || 'Tidak ada deskripsi.'}
                                </p>
                            </CardContent>
                            <CardFooter className="pt-3 border-t bg-muted/5">
                                <Button className="w-full gap-2" variant="secondary" asChild>
                                    <a href={template.fileUrl} download target="_blank" rel="noopener noreferrer">
                                        <Download className="h-4 w-4" />
                                        Unduh Template
                                    </a>
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}

            <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Template?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tindakan ini tidak dapat dibatalkan. Template akan dihapus permanen.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault()
                                handleDelete()
                            }}
                            disabled={isDeleting}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            {isDeleting ? 'Menghapus...' : 'Hapus'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
