'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, Tag, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from '@/components/ui/card'
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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { createCategory, updateCategory, deleteCategory } from '@/actions/categories'
import { useRouter } from 'next/navigation'

interface Category {
    id: string
    name: string
    code: string
    description: string | null
    color: string
}

interface CategoriesClientProps {
    initialCategories: Category[]
    canManage: boolean
}

export function CategoriesClient({ initialCategories, canManage }: CategoriesClientProps) {
    const router = useRouter()
    const [searchTerm, setSearchTerm] = useState('')

    // Manage Dialog State
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingCategory, setEditingCategory] = useState<Category | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    // Delete Alert State
    const [deleteId, setDeleteId] = useState<string | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    // Form States
    const [name, setName] = useState('')
    const [code, setCode] = useState('')
    const [description, setDescription] = useState('')
    const [color, setColor] = useState('#3B82F6')

    const filteredCategories = initialCategories.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.code.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const openCreateDialog = () => {
        setEditingCategory(null)
        setName('')
        setCode('')
        setDescription('')
        setColor('#3B82F6')
        setIsDialogOpen(true)
    }

    const openEditDialog = (category: Category) => {
        setEditingCategory(category)
        setName(category.name)
        setCode(category.code)
        setDescription(category.description || '')
        setColor(category.color)
        setIsDialogOpen(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        const data = { name, code, description, color }

        try {
            let result
            if (editingCategory) {
                result = await updateCategory(editingCategory.id, data)
            } else {
                result = await createCategory(data)
            }

            if (result.success) {
                toast.success(editingCategory ? 'Kategori diperbarui' : 'Kategori dibuat')
                setIsDialogOpen(false)
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

    const handleDelete = async () => {
        if (!deleteId) return
        try {
            setIsDeleting(true)
            const result = await deleteCategory(deleteId)
            if (result.success) {
                toast.success('Kategori dihapus')
                router.refresh()
            } else {
                toast.error(result.error)
            }
        } catch (error) {
            toast.error('Gagal menghapus kategori')
        } finally {
            setIsDeleting(false)
            setDeleteId(null)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Cari kategori..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                {canManage && (
                    <Button onClick={openCreateDialog}>
                        <Plus className="mr-2 h-4 w-4" />
                        Tambah Kategori
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCategories.map((category) => (
                    <Card key={category.id} className="relative overflow-hidden group">
                        <div
                            className="absolute left-0 top-0 bottom-0 w-1.5"
                            style={{ backgroundColor: category.color }}
                        />
                        <CardHeader className="pl-6 pb-2">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded border">
                                            {category.code}
                                        </span>
                                    </div>
                                    <CardTitle className="text-lg">{category.name}</CardTitle>
                                </div>
                                {canManage && (
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm rounded-md p-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(category)}>
                                            <Pencil className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => setDeleteId(category.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="pl-6 text-sm text-muted-foreground">
                            {category.description || 'Tidak ada deskripsi.'}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Create/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingCategory ? 'Edit Kategori' : 'Tambah Kategori'}</DialogTitle>
                        <DialogDescription>
                            {editingCategory ? 'Ubah informasi kategori surat.' : 'Buat kategori surat baru.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nama Kategori</Label>
                                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Mis. Undangan" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="code">Kode</Label>
                                <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} required placeholder="Mis. 005" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="color">Warna Label</Label>
                            <div className="flex gap-2">
                                <Input id="color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-12 p-1 h-10" />
                                <Input value={color} onChange={(e) => setColor(e.target.value)} className="flex-1" placeholder="#RRGGBB" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">Deskripsi</Label>
                            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Keterangan kategori..." />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
                            <Button type="submit" disabled={isLoading}>{isLoading ? 'Menyimpan...' : 'Simpan'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Alert */}
            <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Kategori?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Kategori yang dihapus tidak dapat dikembalikan. Kategori tidak bisa dihapus jika masih digunakan oleh surat.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={(e) => { e.preventDefault(); handleDelete(); }} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                            {isDeleting ? 'Menghapus...' : 'Hapus'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
