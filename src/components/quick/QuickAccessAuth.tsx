'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { verifyMagicLink } from '@/actions/quick-actions'
import { Loader2, Lock } from 'lucide-react'

interface QuickAccessAuthProps {
    token: string
    onVerified: (data: any) => void
}

export function QuickAccessAuth({ token, onVerified }: QuickAccessAuthProps) {
    const [otp, setOtp] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    const handleVerify = async () => {
        if (!otp || otp.length < 6) {
            setError('Masukkan kode OTP 6 digit')
            return
        }

        setIsLoading(true)
        setError('')

        try {
            const result = await verifyMagicLink(token, otp)
            if (result.success) {
                onVerified(result.data)
            } else {
                setError(result.error || 'Verifikasi gagal')
            }
        } catch (e) {
            setError('Terjadi kesalahan network')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="p-6 space-y-6">
            <div className="text-center space-y-2">
                <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto">
                    <Lock className="w-6 h-6 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold">Verifikasi Kode OTP</h2>
                <p className="text-sm text-gray-500">
                    Masukkan kode 6 digit yang dikirim ke WhatsApp Anda.
                </p>
            </div>

            <div className="space-y-4">
                <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="000000"
                    className="text-center text-2xl tracking-[0.5em] h-14 font-mono"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                />

                {error && (
                    <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded animate-shake">
                        {error}
                    </p>
                )}

                <Button
                    className="w-full h-12 text-lg"
                    onClick={handleVerify}
                    disabled={isLoading || otp.length !== 6}
                >
                    {isLoading ? <Loader2 className="animate-spin mr-2" /> : 'Verifikasi Akses'}
                </Button>
            </div>
        </div>
    )
}
