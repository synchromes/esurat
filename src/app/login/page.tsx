'use client'

import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FileText, Loader2, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

const loginSchema = z.object({
    email: z.string().email('Email tidak valid'),
    password: z.string().min(1, 'Password harus diisi')
})

type LoginForm = z.infer<typeof loginSchema>

function LoginForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    const {
        register,
        handleSubmit,
        formState: { errors }
    } = useForm<LoginForm>({
        resolver: zodResolver(loginSchema)
    })

    const onSubmit = async (data: LoginForm) => {
        setIsLoading(true)
        try {
            const result = await signIn('credentials', {
                email: data.email,
                password: data.password,
                redirect: false
            })

            if (result?.error) {
                toast.error(result.error)
            } else {
                toast.success('Login berhasil!')
                router.push(callbackUrl)
                router.refresh()
            }
        } catch {
            toast.error('Terjadi kesalahan. Silakan coba lagi.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4">
            {/* Background Pattern */}
            <div className="absolute inset-0 bg-grid-pattern opacity-5" />

            <Card className="w-full max-w-md relative backdrop-blur-sm bg-white/90 dark:bg-gray-900/90 shadow-2xl border-0">
                <CardHeader className="space-y-4 text-center pb-2">
                    {/* Logo */}
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
                        <FileText className="h-8 w-8 text-white" />
                    </div>
                    <div className="space-y-1">
                        <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                            E-Surat Digital
                        </CardTitle>
                        <CardDescription className="text-muted-foreground">
                            Sistem Manajemen Dokumen Digital TVRI
                        </CardDescription>
                    </div>
                </CardHeader>

                <CardContent className="pt-4">
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="nama@tvri.go.id"
                                {...register('email')}
                                disabled={isLoading}
                                className="h-11"
                            />
                            {errors.email && (
                                <p className="text-sm text-destructive">{errors.email.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    {...register('password')}
                                    disabled={isLoading}
                                    className="h-11 pr-10"
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-0 top-0 h-11 w-11 hover:bg-transparent"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                                    ) : (
                                        <Eye className="h-4 w-4 text-muted-foreground" />
                                    )}
                                </Button>
                            </div>
                            {errors.password && (
                                <p className="text-sm text-destructive">{errors.password.message}</p>
                            )}
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-11 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Memproses...
                                </>
                            ) : (
                                'Masuk'
                            )}
                        </Button>
                    </form>

                    <div className="mt-6 text-center text-sm text-muted-foreground">
                        <p>© {new Date().getFullYear()} TVRI. Hak Cipta Dilindungi.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        }>
            <LoginForm />
        </Suspense>
    )
}
