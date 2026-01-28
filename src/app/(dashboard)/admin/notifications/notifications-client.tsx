'use client'

import { useState, useEffect, useTransition } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import {
    MessageCircle,
    Bot,
    RefreshCw,
    Plus,
    Trash2,
    Star,
    Wifi,
    WifiOff,
    Send,
    Settings,
    Activity
} from 'lucide-react'
import {
    getWhatsAppSessions,
    createWhatsAppSession,
    updateWhatsAppSession,
    deleteWhatsAppSession,
    syncWhatsAppSessions,
    getTelegramConfig,
    saveTelegramConfig,
    testTelegramBot
} from '@/actions/notifications'

interface WhatsAppSession {
    id: string
    name: string
    phoneNumber: string | null
    status: string
    isPrimary: boolean
    priority: number
    isActive: boolean
    dailyLimit: number
    currentDailyCount: number
    totalMessagesSent: number
    lastMessageAt: Date | null
}

interface TelegramConfig {
    id: string
    botToken: string
    chatId: string
    botUsername: string | null
    isEnabled: boolean
    notifyOnSessionDisconnect: boolean
    notifyOnSessionReconnect: boolean
    notifyOnHighTraffic: boolean
    notifyOnSystemError: boolean
    notifyDailyReport: boolean
    dailyReportTime: string
}

export default function NotificationsClient() {
    const [sessions, setSessions] = useState<WhatsAppSession[]>([])
    const [telegramConfig, setTelegramConfig] = useState<TelegramConfig | null>(null)
    const [isPending, startTransition] = useTransition()
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isBotRunning, setIsBotRunning] = useState(false)
    const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null)

    // Form states
    const [newSession, setNewSession] = useState({ name: '', phoneNumber: '', dailyLimit: 1000 })
    const [tgForm, setTgForm] = useState({
        botToken: '',
        chatId: '',
        botUsername: '',
        notifyOnSessionDisconnect: true,
        notifyOnSessionReconnect: true,
        notifyOnHighTraffic: true,
        notifyOnSystemError: true,
        notifyDailyReport: true,
        dailyReportTime: '08:00'
    })

    useEffect(() => {
        loadData()

        // Cleanup polling on unmount
        return () => {
            if (pollingInterval) {
                clearInterval(pollingInterval)
            }
        }
    }, [])

    const loadData = async () => {
        const [sessionsData, tgData] = await Promise.all([
            getWhatsAppSessions(),
            getTelegramConfig()
        ])
        setSessions(sessionsData as WhatsAppSession[])
        if (tgData) {
            setTelegramConfig(tgData as TelegramConfig)
            setTgForm({
                botToken: tgData.botToken,
                chatId: tgData.chatId,
                botUsername: tgData.botUsername || '',
                notifyOnSessionDisconnect: tgData.notifyOnSessionDisconnect,
                notifyOnSessionReconnect: tgData.notifyOnSessionReconnect,
                notifyOnHighTraffic: tgData.notifyOnHighTraffic,
                notifyOnSystemError: tgData.notifyOnSystemError,
                notifyDailyReport: tgData.notifyDailyReport,
                dailyReportTime: tgData.dailyReportTime
            })
        }
    }

    const handleSync = () => {
        startTransition(async () => {
            const result = await syncWhatsAppSessions()
            if (result.success) {
                toast.success('Session status synced')
                loadData()
            } else {
                toast.error(result.error)
            }
        })
    }

    const handleAddSession = () => {
        startTransition(async () => {
            const result = await createWhatsAppSession({
                name: newSession.name,
                phoneNumber: newSession.phoneNumber || undefined,
                dailyLimit: newSession.dailyLimit
            })
            if (result.success) {
                toast.success('Session added')
                setNewSession({ name: '', phoneNumber: '', dailyLimit: 1000 })
                setIsDialogOpen(false)
                loadData()
            } else {
                toast.error(result.error)
            }
        })
    }

    const handleSetPrimary = (id: string) => {
        startTransition(async () => {
            const result = await updateWhatsAppSession(id, { isPrimary: true })
            if (result.success) {
                toast.success('Primary session updated')
                loadData()
            } else {
                toast.error(result.error)
            }
        })
    }

    const handleToggleActive = (id: string, isActive: boolean) => {
        startTransition(async () => {
            const result = await updateWhatsAppSession(id, { isActive: !isActive })
            if (result.success) {
                toast.success(`Session ${isActive ? 'disabled' : 'enabled'}`)
                loadData()
            } else {
                toast.error(result.error)
            }
        })
    }

    const handleDeleteSession = (id: string) => {
        if (!confirm('Yakin ingin menghapus session ini?')) return

        startTransition(async () => {
            const result = await deleteWhatsAppSession(id)
            if (result.success) {
                toast.success('Session deleted')
                loadData()
            } else {
                toast.error(result.error)
            }
        })
    }

    const handleSaveTelegram = () => {
        startTransition(async () => {
            const result = await saveTelegramConfig(tgForm)
            if (result.success) {
                toast.success('Telegram configuration saved')
                loadData()
            } else {
                toast.error(result.error)
            }
        })
    }

    const handleTestTelegram = () => {
        startTransition(async () => {
            const result = await testTelegramBot(tgForm.botToken, tgForm.chatId)
            if (result.success) {
                toast.success('Test message sent! Check your Telegram.')
            } else {
                toast.error('Failed to send test message. Check your Bot Token and Chat ID.')
            }
        })
    }

    const toggleBotPolling = () => {
        if (isBotRunning && pollingInterval) {
            clearInterval(pollingInterval)
            setPollingInterval(null)
            setIsBotRunning(false)
            toast.info('Bot stopped')
        } else {
            // Start polling every 3 seconds
            const interval = setInterval(async () => {
                try {
                    const res = await fetch('/api/telegram/poll')
                    const data = await res.json()
                    if (data.processed > 0) {
                        console.log(`Processed ${data.processed} commands`)
                    }
                } catch (e) {
                    console.error('Poll error:', e)
                }
            }, 3000)
            setPollingInterval(interval)
            setIsBotRunning(true)
            toast.success('Bot started! Commands will now be processed.')
        }
    }

    return (
        <div className="space-y-6">
            <Tabs defaultValue="whatsapp">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="whatsapp" className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4" />
                        WhatsApp Sessions
                    </TabsTrigger>
                    <TabsTrigger value="telegram" className="flex items-center gap-2">
                        <Bot className="h-4 w-4" />
                        Telegram Bot
                    </TabsTrigger>
                </TabsList>

                {/* WhatsApp Sessions Tab */}
                <TabsContent value="whatsapp" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>WhatsApp Sessions</CardTitle>
                                    <CardDescription>
                                        Kelola multi-session WhatsApp dengan failover otomatis
                                    </CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={handleSync} disabled={isPending}>
                                        <RefreshCw className={`h-4 w-4 mr-2 ${isPending ? 'animate-spin' : ''}`} />
                                        Sync Status
                                    </Button>
                                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button size="sm">
                                                <Plus className="h-4 w-4 mr-2" />
                                                Add Session
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>Tambah WhatsApp Session</DialogTitle>
                                                <DialogDescription>
                                                    Nama session harus sama dengan yang ada di WA Gateway
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="space-y-4 py-4">
                                                <div className="space-y-2">
                                                    <Label>Nama Session *</Label>
                                                    <Input
                                                        placeholder="esurat-backup1"
                                                        value={newSession.name}
                                                        onChange={(e) => setNewSession({ ...newSession, name: e.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Nomor HP (opsional)</Label>
                                                    <Input
                                                        placeholder="628123456789"
                                                        value={newSession.phoneNumber}
                                                        onChange={(e) => setNewSession({ ...newSession, phoneNumber: e.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Daily Limit</Label>
                                                    <Input
                                                        type="number"
                                                        value={newSession.dailyLimit}
                                                        onChange={(e) => setNewSession({ ...newSession, dailyLimit: parseInt(e.target.value) || 1000 })}
                                                    />
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
                                                <Button onClick={handleAddSession} disabled={!newSession.name || isPending}>
                                                    Tambah
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {sessions.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p>Belum ada WhatsApp session terdaftar</p>
                                    <p className="text-sm">Klik "Add Session" untuk menambahkan</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Session</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Nomor HP</TableHead>
                                            <TableHead>Pesan Hari Ini</TableHead>
                                            <TableHead>Total Pesan</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sessions.map((session) => (
                                            <TableRow key={session.id} className={!session.isActive ? 'opacity-50' : ''}>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium">{session.name}</span>
                                                        {session.isPrimary && (
                                                            <Badge variant="default" className="text-xs">
                                                                <Star className="h-3 w-3 mr-1" />
                                                                Primary
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {session.status === 'CONNECTED' ? (
                                                        <Badge variant="default" className="bg-green-500">
                                                            <Wifi className="h-3 w-3 mr-1" />
                                                            Connected
                                                        </Badge>
                                                    ) : session.status === 'BANNED' ? (
                                                        <Badge variant="destructive">Banned</Badge>
                                                    ) : (
                                                        <Badge variant="secondary">
                                                            <WifiOff className="h-3 w-3 mr-1" />
                                                            Disconnected
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>{session.phoneNumber || '-'}</TableCell>
                                                <TableCell>
                                                    {session.currentDailyCount} / {session.dailyLimit}
                                                </TableCell>
                                                <TableCell>{session.totalMessagesSent}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        {!session.isPrimary && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleSetPrimary(session.id)}
                                                                disabled={isPending}
                                                                title="Set as Primary"
                                                            >
                                                                <Star className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleToggleActive(session.id, session.isActive)}
                                                            disabled={isPending}
                                                            title={session.isActive ? 'Disable' : 'Enable'}
                                                        >
                                                            {session.isActive ? <WifiOff className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDeleteSession(session.id)}
                                                            disabled={isPending}
                                                            className="text-destructive hover:text-destructive"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>

                    {/* Info Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Activity className="h-4 w-4" />
                                Cara Kerja Multi-Session
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground space-y-2">
                            <p><strong>Failover Mode:</strong> Session primary digunakan utama. Jika disconnect, backup akan mengambil alih.</p>
                            <p><strong>Round-Robin Mode:</strong> Pesan didistribusikan merata ke semua session aktif untuk menghindari rate limit.</p>
                            <p><strong>Daily Limit:</strong> Batas pesan per hari per session. Setelah tercapai, akan switch ke session lain.</p>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Telegram Bot Tab */}
                <TabsContent value="telegram" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Telegram Bot Configuration</CardTitle>
                            <CardDescription>
                                Konfigurasi bot Telegram untuk menerima notifikasi dan monitoring
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="botToken">Bot Token *</Label>
                                    <Input
                                        id="botToken"
                                        type="password"
                                        placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
                                        value={tgForm.botToken}
                                        onChange={(e) => setTgForm({ ...tgForm, botToken: e.target.value })}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Dapatkan dari @BotFather di Telegram
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="chatId">Chat ID *</Label>
                                    <Input
                                        id="chatId"
                                        placeholder="-1001234567890"
                                        value={tgForm.chatId}
                                        onChange={(e) => setTgForm({ ...tgForm, chatId: e.target.value })}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        ID grup/channel untuk menerima notifikasi
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="botUsername">Bot Username (opsional)</Label>
                                <Input
                                    id="botUsername"
                                    placeholder="@esurat_bot"
                                    value={tgForm.botUsername}
                                    onChange={(e) => setTgForm({ ...tgForm, botUsername: e.target.value })}
                                />
                            </div>

                            <div className="border-t pt-4">
                                <h4 className="font-medium mb-4">Notifikasi</h4>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="notifyDisconnect">Session Disconnect</Label>
                                        <Switch
                                            id="notifyDisconnect"
                                            checked={tgForm.notifyOnSessionDisconnect}
                                            onCheckedChange={(v) => setTgForm({ ...tgForm, notifyOnSessionDisconnect: v })}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="notifyReconnect">Session Reconnect</Label>
                                        <Switch
                                            id="notifyReconnect"
                                            checked={tgForm.notifyOnSessionReconnect}
                                            onCheckedChange={(v) => setTgForm({ ...tgForm, notifyOnSessionReconnect: v })}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="notifyHighTraffic">High Traffic Alert</Label>
                                        <Switch
                                            id="notifyHighTraffic"
                                            checked={tgForm.notifyOnHighTraffic}
                                            onCheckedChange={(v) => setTgForm({ ...tgForm, notifyOnHighTraffic: v })}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="notifyError">System Error</Label>
                                        <Switch
                                            id="notifyError"
                                            checked={tgForm.notifyOnSystemError}
                                            onCheckedChange={(v) => setTgForm({ ...tgForm, notifyOnSystemError: v })}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="dailyReport">Daily Report</Label>
                                        <Switch
                                            id="dailyReport"
                                            checked={tgForm.notifyDailyReport}
                                            onCheckedChange={(v) => setTgForm({ ...tgForm, notifyDailyReport: v })}
                                        />
                                    </div>
                                    {tgForm.notifyDailyReport && (
                                        <div className="space-y-2">
                                            <Label htmlFor="reportTime">Report Time</Label>
                                            <Input
                                                id="reportTime"
                                                type="time"
                                                value={tgForm.dailyReportTime}
                                                onChange={(e) => setTgForm({ ...tgForm, dailyReportTime: e.target.value })}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-2 pt-4">
                                <Button
                                    variant={isBotRunning ? "destructive" : "default"}
                                    onClick={toggleBotPolling}
                                    disabled={!telegramConfig}
                                >
                                    <Bot className={`h-4 w-4 mr-2 ${isBotRunning ? 'animate-pulse' : ''}`} />
                                    {isBotRunning ? 'Stop Bot' : 'Start Bot'}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={handleTestTelegram}
                                    disabled={!tgForm.botToken || !tgForm.chatId || isPending}
                                >
                                    <Send className="h-4 w-4 mr-2" />
                                    Test Connection
                                </Button>
                                <Button
                                    onClick={handleSaveTelegram}
                                    disabled={!tgForm.botToken || !tgForm.chatId || isPending}
                                >
                                    <Settings className="h-4 w-4 mr-2" />
                                    Save Configuration
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Setup Guide */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Panduan Setup Telegram Bot</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm space-y-4">
                            <div>
                                <h4 className="font-medium mb-2">1. Buat Bot di BotFather</h4>
                                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                                    <li>Buka Telegram, cari <strong>@BotFather</strong></li>
                                    <li>Kirim perintah <code>/newbot</code></li>
                                    <li>Ikuti instruksi untuk membuat bot baru</li>
                                    <li>Simpan <strong>Bot Token</strong> yang diberikan</li>
                                </ol>
                            </div>
                            <div>
                                <h4 className="font-medium mb-2">2. Dapatkan Chat ID</h4>
                                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                                    <li>Buat grup baru atau gunakan grup yang ada</li>
                                    <li>Tambahkan bot ke grup sebagai admin</li>
                                    <li>Kirim pesan apapun ke grup</li>
                                    <li>Buka <code>https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code></li>
                                    <li>Cari <code>"chat":&#123;"id":-123456789&#125;</code> - itu Chat ID Anda</li>
                                </ol>
                            </div>
                            <div>
                                <h4 className="font-medium mb-2">3. Bot Commands</h4>
                                <div className="text-muted-foreground space-y-1">
                                    <p><code>/status</code> - Cek status sistem</p>
                                    <p><code>/sessions</code> - Lihat status WhatsApp session</p>
                                    <p><code>/letters</code> - Statistik surat hari ini</p>
                                    <p><code>/pending</code> - Jumlah surat pending</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
