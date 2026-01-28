'use client'

import { useState, useEffect } from 'react'
import {
    getSessions, startSession, stopSession, deleteSession, getSessionStatus, getQRImage, sendTargetedTestMessage,
    getGlobalSettings, saveGlobalSettings, testConnectionGlobal
} from '@/actions/whatsapp-settings'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, QrCode, MessageSquare, RefreshCw, Save, CheckCircle, XCircle, Globe } from 'lucide-react'
import Image from 'next/image'

interface SessionData {
    name: string
    status: string
    isLoading: boolean
}

export default function WhatsAppSettingsClient() {
    // Global Config State
    const [apiUrl, setApiUrl] = useState('')
    const [apiKey, setApiKey] = useState('')
    const [defaultSession, setDefaultSession] = useState('')
    const [isConfigLoading, setIsConfigLoading] = useState(true)
    const [isSavingConfig, setIsSavingConfig] = useState(false)
    const [isTestingConnection, setIsTestingConnection] = useState(false)

    // Sessions State
    const [sessions, setSessions] = useState<SessionData[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
    const [newSessionName, setNewSessionName] = useState('')
    const [isCreating, setIsCreating] = useState(false)

    // QR Dialog
    const [qrImage, setQrImage] = useState<string | null>(null)
    const [isQrDialogOpen, setIsQrDialogOpen] = useState(false)
    const [qrSessionName, setQrSessionName] = useState('')

    // Test Message Dialog
    const [isTestDialogOpen, setIsTestDialogOpen] = useState(false)
    const [testSession, setTestSession] = useState('')
    const [testPhone, setTestPhone] = useState('')
    const [testMessage, setTestMessage] = useState('')
    const [isSending, setIsSending] = useState(false)

    // Load Data
    useEffect(() => {
        fetchConfig()
        fetchSessions()
    }, [])

    const fetchConfig = async () => {
        setIsConfigLoading(true)
        try {
            const res = await getGlobalSettings()
            if (res.success && res.data) {
                setApiUrl(res.data.url)
                setDefaultSession(res.data.session)
                setApiKey(res.data.apiKey || '')
            }
        } catch (e) {
            toast.error('Gagal memuat konfigurasi')
        } finally {
            setIsConfigLoading(false)
        }
    }

    const fetchSessions = async () => {
        setIsLoading(true)
        try {
            const result = await getSessions()
            if (result.success && Array.isArray(result.data)) {
                // Initial state
                const initialSessions = result.data.map((name: any) => ({
                    name: typeof name === 'string' ? name : name.id || 'Unknown',
                    status: 'Unknown',
                    isLoading: true
                }))
                setSessions(initialSessions)

                // Fetch statuses
                initialSessions.forEach((s: any) => fetchStatus(s.name))
            } else {
                // toast.error('Gagal memuat list session')
                // Silent fail usually better here if gateway is down
            }
        } catch (error) {
            toast.error('Terjadi kesalahan memuat data')
        } finally {
            setIsLoading(false)
        }
    }

    const fetchStatus = async (sessionName: string) => {
        const result = await getSessionStatus(sessionName)
        setSessions(prev => prev.map(s =>
            s.name === sessionName
                ? { ...s, status: result.success ? result.status : 'Error', isLoading: false }
                : s
        ))
    }

    // Config Actions
    const handleSaveConfig = async () => {
        setIsSavingConfig(true)
        try {
            const res = await saveGlobalSettings(apiUrl, defaultSession, apiKey)
            if (res.success) {
                toast.success('Pengaturan disimpan')
                fetchSessions() // Retry fetching sessions with new URL
            } else {
                toast.error(res.error)
            }
        } catch (e) {
            toast.error('Error saving config')
        } finally {
            setIsSavingConfig(false)
        }
    }

    const handleTestConnection = async () => {
        setIsTestingConnection(true)
        try {
            const res = await testConnectionGlobal()
            if (res.success) {
                toast.success(res.message)
            } else {
                toast.error(res.error)
            }
        } catch (e) {
            toast.error('Error testing connection')
        } finally {
            setIsTestingConnection(false)
        }
    }

    const handleCreateSession = async () => {
        if (!newSessionName) return
        setIsCreating(true)
        try {
            const result = await startSession(newSessionName)
            if (result.success) {
                toast.success('Session dibuat')
                setIsCreateDialogOpen(false)
                setNewSessionName('')
                fetchSessions()
            } else {
                toast.error(result.error || 'Gagal membuat session')
            }
        } catch (e) {
            toast.error('Error creating session')
        } finally {
            setIsCreating(false)
        }
    }

    const handleDeleteSession = async (name: string) => {
        if (!confirm(`Hapus session ${name}?`)) return
        try {
            await deleteSession(name)
            toast.success('Session dihapus')
            fetchSessions()
        } catch (e) {
            toast.error('Gagal menghapus session')
        }
    }

    const handleStopSession = async (name: string) => {
        try {
            await stopSession(name)
            toast.success('Session dihentikan')
            fetchStatus(name)
        } catch (e) {
            toast.error('Gagal stop session')
        }
    }

    const handleViewQR = async (name: string) => {
        setQrSessionName(name)
        setQrImage(null)
        setIsQrDialogOpen(true)
        try {
            const result = await getQRImage(name)
            if (result.success && result.image) {
                setQrImage(result.image)
            } else {
                toast.error('Gagal memuat QR Code. Pastikan session dalam status SCAN_QR_CODE.')
            }
        } catch (e) {
            toast.error('Error QA')
        }
    }

    const handleSendTest = async () => {
        setIsSending(true)
        try {
            const result = await sendTargetedTestMessage(testSession, testPhone, testMessage)
            if (result.success) {
                toast.success('Pesan terkirim!')
                setIsTestDialogOpen(false)
            } else {
                toast.error(result.error || 'Gagal kirim pesan')
            }
        } catch (e) {
            toast.error('Error sending message')
        } finally {
            setIsSending(false)
        }
    }

    const openTestDialog = (name: string) => {
        setTestSession(name)
        setTestPhone('')
        setTestMessage('Tes koneksi E-Surat TVRI')
        setIsTestDialogOpen(true)
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold tracking-tight">Whatsapp Setting</h2>
                {/* <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchSessions} disabled={isLoading}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div> */}
            </div>

            {/* Global Configuration */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Globe className="h-5 w-5 text-primary" />
                        <div>
                            <CardTitle>Global Gateway Configuration</CardTitle>
                            <CardDescription>Konfigurasi koneksi ke server Whatsapp Gateway.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Gateway API URL</Label>
                            <Input
                                placeholder="https://wa.tvrikalbar.id"
                                value={apiUrl}
                                onChange={e => setApiUrl(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">URL endpoint server WA Gateway.</p>
                        </div>
                        <div className="space-y-2">
                            <Label>API Key (Header: Key)</Label>
                            <Input
                                placeholder="wa-tvri-kalbar"
                                value={apiKey}
                                onChange={e => setApiKey(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">Key untuk autentikasi ke gateway.</p>
                        </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Default Session ID</Label>
                            <Input
                                placeholder="664c55d8-2426-49d5-8e87-f7b1fc3d91f6"
                                value={defaultSession}
                                onChange={e => setDefaultSession(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">Session ID yang digunakan sistem untuk mengirim notifikasi.</p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
                        <Button variant="secondary" onClick={handleTestConnection} disabled={isTestingConnection} className="w-full sm:w-auto">
                            {isTestingConnection ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <RefreshCw className="h-4 w-4 mr-2" />
                            )}
                            Test Connection
                        </Button>
                        <Button onClick={handleSaveConfig} disabled={isSavingConfig} className="w-full sm:w-auto">
                            {isSavingConfig ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4 mr-2" />
                            )}
                            Save Configuration
                        </Button>
                    </div>

                    {/* Quick Test Notification */}
                    <div className="border-t pt-4 mt-4">
                        <h4 className="text-sm font-medium mb-3">Test Kirim Notifikasi</h4>
                        <div className="flex gap-2">
                            <Input
                                placeholder="Nomor WhatsApp (08123...)"
                                value={testPhone}
                                onChange={e => setTestPhone(e.target.value)}
                                className="max-w-xs"
                            />
                            <Button
                                variant="outline"
                                onClick={() => {
                                    if (!testPhone) {
                                        toast.error('Masukkan nomor tujuan')
                                        return
                                    }
                                    setTestSession(defaultSession)
                                    setTestMessage('🔔 Test notifikasi dari E-Surat TVRI.\n\nJika Anda menerima pesan ini, berarti sistem notifikasi sudah berfungsi dengan baik.')
                                    setIsTestDialogOpen(true)
                                }}
                                disabled={!defaultSession}
                            >
                                <MessageSquare className="h-4 w-4 mr-2" />
                                Kirim Test
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">Kirim pesan test untuk memverifikasi notifikasi berfungsi.</p>
                    </div>
                </CardContent>
            </Card>

            {/* Session Management */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Session Manager</CardTitle>
                            <CardDescription>Monitor status dan kelola session.</CardDescription>
                        </div>
                        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                            <DialogTrigger asChild>
                                <Button size="sm">
                                    <Plus className="mr-2 h-4 w-4" />
                                    New Session
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Buat Session Baru</DialogTitle>
                                    <DialogDescription>
                                        Masukkan nama session unik.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-2 py-2">
                                    <Label>Nama Session</Label>
                                    <Input
                                        value={newSessionName}
                                        onChange={e => setNewSessionName(e.target.value)}
                                        placeholder="mysession"
                                    />
                                </div>
                                <DialogFooter>
                                    <Button onClick={handleCreateSession} disabled={isCreating}>
                                        {isCreating ? 'Membuat...' : 'Buat Session'}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="mb-4 flex justify-end">
                        <Button variant="ghost" size="sm" onClick={fetchSessions} disabled={isLoading}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            Refresh List
                        </Button>
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Session Name</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sessions.length === 0 && !isLoading && (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                        Tidak ada session ditemukan atau tidak dapat terhubung ke gateway.
                                    </TableCell>
                                </TableRow>
                            )}
                            {sessions.map((session) => (
                                <TableRow key={session.name}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            {session.name}
                                            {session.name === defaultSession && (
                                                <Badge variant="outline" className="text-xs">Default</Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {session.isLoading ? (
                                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                            ) : (
                                                <Badge variant={session.status === 'CONNECTED' ? 'default' : session.status === 'SCAN_QR_CODE' ? 'secondary' : 'destructive'}>
                                                    {session.status}
                                                </Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-2">
                                            {session.status === 'SCAN_QR_CODE' && (
                                                <Button size="sm" variant="outline" onClick={() => handleViewQR(session.name)}>
                                                    <QrCode className="h-4 w-4 mr-1" /> Scan
                                                </Button>
                                            )}
                                            {session.status === 'CONNECTED' && (
                                                <Button size="sm" variant="outline" onClick={() => openTestDialog(session.name)}>
                                                    <MessageSquare className="h-4 w-4 mr-1" /> Test
                                                </Button>
                                            )}

                                            <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => handleDeleteSession(session.name)} title="Delete/Logout">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* QR Dialog */}
            <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Scan QR Code: {qrSessionName}</DialogTitle>
                    </DialogHeader>
                    <div className="flex items-center justify-center p-6">
                        {qrImage ? (
                            <div className="relative h-64 w-64">
                                <Image src={qrImage} alt="QR Code" fill className="object-contain" />
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                <Loader2 className="h-8 w-8 animate-spin" />
                                <span>Memuat QR Code...</span>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Test Message Dialog */}
            <Dialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Kirim Pesan Test</DialogTitle>
                        <DialogDescription>
                            Kirim pesan test menggunakan session <b>{testSession}</b>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Nomor Tujuan (Ex: 0812...)</Label>
                            <Input value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="08123456789" />
                        </div>
                        <div className="space-y-2">
                            <Label>Pesan</Label>
                            <Textarea value={testMessage} onChange={e => setTestMessage(e.target.value)} rows={3} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleSendTest} disabled={isSending}>
                            {isSending ? 'Mengirim...' : 'Kirim'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
