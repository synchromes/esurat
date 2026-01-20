export default function QuickLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="bg-blue-600 p-4 text-center">
                    <h1 className="text-white font-bold text-lg">E-SURAT DIGITAL</h1>
                    <p className="text-blue-100 text-sm">Akses Cepat</p>
                </div>
                {children}
            </div>
        </div>
    )
}
