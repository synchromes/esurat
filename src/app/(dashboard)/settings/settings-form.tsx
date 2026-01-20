'use client'

import { useTransition } from 'react'
import { Setting } from '@prisma/client'
import { updateSettings } from './actions'
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
import { Save, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export function SettingsForm({ settings }: { settings: Setting[] }) {
    const [isPending, startTransition] = useTransition()
    const router = useRouter()

    async function handleSubmit(formData: FormData) {
        startTransition(async () => {
            const result = await updateSettings(formData)
            if (result.success) {
                toast.success('Pengaturan berhasil disimpan')
                router.refresh()
            } else {
                toast.error(result.error || 'Gagal menyimpan pengaturan')
            }
        })
    }

    return (
        <form action={handleSubmit}>
            <div className="rounded-md border overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className="w-[300px] font-bold text-primary whitespace-nowrap">Key</TableHead>
                            <TableHead className="font-bold text-primary min-w-[300px]">Value</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {settings.map((setting) => (
                            <TableRow key={setting.id}>
                                <TableCell className="font-mono text-sm font-medium">
                                    {setting.key}
                                    <input type="hidden" name="keys[]" value={setting.key} />
                                </TableCell>
                                <TableCell>
                                    <Input
                                        name={`values_${setting.key}`}
                                        defaultValue={setting.value}
                                        className="max-w-xl font-mono text-sm"
                                        disabled={isPending}
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                        {settings.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={2} className="text-center h-24 text-muted-foreground">
                                    Tidak ada konfigurasi tersimpan.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex justify-end mt-6">
                <Button type="submit" disabled={isPending}>
                    {isPending ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Menyimpan...
                        </>
                    ) : (
                        <>
                            <Save className="mr-2 h-4 w-4" />
                            Simpan Perubahan
                        </>
                    )}
                </Button>
            </div>
        </form>
    )
}
