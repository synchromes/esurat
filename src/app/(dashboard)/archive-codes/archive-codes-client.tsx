'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, Tag, Search, Archive } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
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
import { createArchiveCode, updateArchiveCode, deleteArchiveCode } from '@/actions/archive-codes'
import { useRouter } from 'next/navigation'

interface ArchiveCode {
    id: string
    code: string
    name: string | null
    description: string | null
}

interface ArchiveCodesClientProps {
    initialCodes: ArchiveCode[]
    canManage: boolean
}

export function ArchiveCodesClient({ initialCodes, canManage }: ArchiveCodesClientProps) {
    const router = useRouter()
    const [searchTerm, setSearchTerm] = useState('')

    // Manage Dialog State
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingCode, setEditingCode] = useState<ArchiveCode | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    // Delete Alert State
    const [deleteId, setDeleteId] = useState<string | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    // Form States
    const [code, setCode] = useState('')
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')

    const [sortBy, setSortBy] = useState<'code' | 'name'>('code')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)

    const filteredCodes = initialCodes.filter(c =>
        c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.name && c.name.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    const sortedCodes = [...filteredCodes].sort((a, b) => {
        let valA = (sortBy === 'code' ? a.code : (a.name || ''))
        let valB = (sortBy === 'code' ? b.code : (b.name || ''))

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1
        return 0
    })

    const totalPages = Math.ceil(sortedCodes.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const paginatedCodes = sortedCodes.slice(startIndex, startIndex + itemsPerPage)

    // Reset page when search/filter or itemsPerPage changes
    if (currentPage > totalPages && totalPages > 0) {
        setCurrentPage(1)
    }

    const openCreateDialog = () => {
        setEditingCode(null)
        setCode('')
        setName('')
        setDescription('')
        setIsDialogOpen(true)
    }

    const openEditDialog = (item: ArchiveCode) => {
        setEditingCode(item)
        setCode(item.code)
        setName(item.name || '')
        setDescription(item.description || '')
        setIsDialogOpen(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        const data = { code, name, description }

        try {
            let result
            if (editingCode) {
                result = await updateArchiveCode(editingCode.id, data)
            } else {
                result = await createArchiveCode(data)
            }

            if (result.success) {
                toast.success(editingCode ? 'Kode arsip diperbarui' : 'Kode arsip dibuat')
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
            const result = await deleteArchiveCode(deleteId)
            if (result.success) {
                toast.success('Kode arsip dihapus')
                router.refresh()
            } else {
                toast.error(result.error)
            }
        } catch (error) {
            toast.error('Gagal menghapus kode arsip')
        } finally {
            setIsDeleting(false)
            setDeleteId(null)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="relative w-full md:w-auto flex flex-col md:flex-row gap-2 flex-1">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Cari kode/nama..."
                            className="pl-8"
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        />
                    </div>
                    <div className="flex gap-2 items-center">
                        <select
                            className="bg-background border border-input rounded-md px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                            value={`${sortBy}-${sortOrder}`}
                            onChange={(e) => {
                                const [key, order] = e.target.value.split('-') as [string, string]
                                setSortBy(key as 'code' | 'name')
                                setSortOrder(order as 'asc' | 'desc')
                            }}
                        >
                            <option value="code-asc">Kode (A-Z)</option>
                            <option value="code-desc">Kode (Z-A)</option>
                            <option value="name-asc">Nama (A-Z)</option>
                            <option value="name-desc">Nama (Z-A)</option>
                        </select>
                        <select
                            className="bg-background border border-input rounded-md px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring w-20"
                            value={itemsPerPage}
                            onChange={(e) => {
                                setItemsPerPage(Number(e.target.value))
                                setCurrentPage(1)
                            }}
                        >
                            <option value="5">5</option>
                            <option value="10">10</option>
                            <option value="15">15</option>
                            <option value="30">30</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                        </select>
                        <span className="text-sm text-muted-foreground whitespace-nowrap">per hal.</span>
                    </div>
                </div>
                {canManage && (
                    <Button onClick={openCreateDialog}>
                        <Plus className="mr-2 h-4 w-4" />
                        Tambah Kode
                    </Button>
                )}
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[120px] cursor-pointer hover:bg-muted/50" onClick={() => { setSortBy('code'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                                Kode {sortBy === 'code' && (sortOrder === 'asc' ? '↑' : '↓')}
                            </TableHead>
                            <TableHead className="w-[200px] md:w-[30%] cursor-pointer hover:bg-muted/50" onClick={() => { setSortBy('name'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                                Nama / Judul {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                            </TableHead>
                            <TableHead className="min-w-[300px]">Keterangan</TableHead>
                            {canManage && <TableHead className="w-[80px] text-right">Aksi</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedCodes.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={canManage ? 4 : 3} className="text-center py-8 text-muted-foreground">
                                    Tidak ada data kode arsip.
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedCodes.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-mono font-medium align-top">{item.code}</TableCell>
                                    <TableCell className="align-top">
                                        <div className="line-clamp-2" title={item.name || ''}>
                                            {item.name || '-'}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground whitespace-pre-wrap text-xs align-top">
                                        <div className="line-clamp-3" title={item.description || ''}>
                                            {item.description || '-'}
                                        </div>
                                    </TableCell>
                                    {canManage && (
                                        <TableCell className="text-right align-top">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(item)}>
                                                    <Pencil className="h-4 w-4 text-muted-foreground" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => setDeleteId(item.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                    Hal {currentPage} dari {totalPages || 1} ({filteredCodes.length} data)
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                    >
                        Sebelumnya
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage >= totalPages}
                    >
                        Selanjutnya
                    </Button>
                </div>
            </div>

            {/* Create/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingCode ? 'Edit Kode Arsip' : 'Tambah Kode Arsip'}</DialogTitle>
                        <DialogDescription>
                            {editingCode ? 'Ubah informasi kode klasifikasi arsip.' : 'Buat kode klasifikasi arsip baru.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="code">Kode Klasifikasi</Label>
                            <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} required placeholder="Mis. KP.01.01" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="name">Nama / Judul (Opsional)</Label>
                            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Mis. Pengadaan Pegawai" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">Keterangan</Label>
                            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Keterangan..." className="min-h-[100px]" />
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
                        <AlertDialogTitle>Hapus Kode Arsip?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Data yang dihapus tidak dapat dikembalikan.
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
