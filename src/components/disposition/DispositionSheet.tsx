import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DispositionSheetProps {
    disposition: any
    className?: string
    qrDataUrl?: string
    logoUrl?: string
}

export function DispositionSheet({ disposition, className, qrDataUrl, logoUrl }: DispositionSheetProps) {
    // Hardcoded positions from the official format
    const positions = [
        'Kepala Sub Bagian Tata Usaha',
        'Ketua Tim Program',
        'Ketua Tim Berita',
        'Ketua Tim Teknik',
        'Ketua Tim Keuangan',
        'Ketua Tim Umum',
        'Ketua Tim Kerja Sama Jasa Siaran dan Non Siaran',
        'Ketua Tim Promo Teresterial dan Media Baru',
        'Ketua Tim Pengelolaan, Distribusi dan Promosi Konten Media Baru',
        'PPK'
    ]

    // Predefined instructions matching the official format
    const predefinedInstructions = [
        'Diteliti / diselesaikan',
        'Dipertimbangkan',
        'Untuk diketahui / diperhatikan',
        'Mewakili / menghadiri / mengikuti',
        'Dikoordinasikan',
        'Ditampung permasalahannya',
        'Peringatkan / pendekatan',
        'Pendapat / analisa / saran',
        'Konsep jawaban / sambutan',
        'Konsep laporan',
        'Data diolah',
        'Ditindaklanjuti',
        'Diagendakan / dijadwalkan',
        'Harap dibantu',
        'File'
    ]

    return (
        <div className={cn("bg-white text-black max-w-[210mm] mx-auto text-sm p-8", className)} style={{ fontFamily: "'Gotham Light', 'Gotham', 'Montserrat', sans-serif", fontWeight: 300 }}>
            <style dangerouslySetInnerHTML={{
                __html: `
                @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;600&display=swap');
             `}} />
            {/* Header */}
            <div className="relative mb-6">
                <div className="absolute top-0 left-0">
                    <img src={logoUrl || "/logo.png"} alt="TVRI" className="h-12 object-contain" />
                </div>
                <div className="text-center">
                    <h1 className="font-bold text-lg uppercase">DISPOSISI</h1>
                    <h2 className="font-bold text-lg uppercase">KEPALA TVRI</h2>
                    <h3 className="font-bold text-lg uppercase">STASIUN KALIMANTAN BARAT</h3>
                </div>
            </div>

            {/* Content Area */}
            <div className="">
                {/* Meta Info */}
                <div className="grid grid-cols-[80px_10px_1fr] gap-1 mb-3 text-sm">
                    <div>No</div>
                    <div>:</div>
                    <div>{disposition.number}</div>

                    <div>Tanggal</div>
                    <div>:</div>
                    <div>{format(new Date(disposition.createdAt), 'dd MMMM yyyy', { locale: id })}</div>

                    <div>Dari</div>
                    <div>:</div>
                    <div>{disposition.letter.creator.name} / {disposition.letter.title}</div>

                    <div>Hal</div>
                    <div>:</div>
                    <div>{disposition.letter.description || disposition.letter.title}</div>
                </div>

                {/* Sifat */}
                <div className="flex items-center gap-6 mb-3 text-sm">
                    <span>Sifat :</span>
                    {[
                        { label: 'Biasa', value: 'BIASA' },
                        { label: 'Segera', value: 'SEGERA' },
                        { label: 'Penting', value: 'PENTING' },
                        { label: 'Rahasia', value: 'RAHASIA' }
                    ].map((sifat) => (
                        <div key={sifat.value} className="flex items-center gap-1">
                            <div className={cn("w-4 h-4 border border-black flex items-center justify-center",
                                disposition.urgency === sifat.value ? "bg-black text-white" : "")}>
                                {disposition.urgency === sifat.value && <Check className="w-3 h-3" />}
                            </div>
                            <span>{sifat.label}</span>
                        </div>
                    ))}
                </div>

                {/* Main Grid - Recipients */}
                <div className="border border-black">
                    <div className="divide-y divide-black border-b border-black">
                        {positions.map((pos, idx) => {
                            const isChecked = disposition.recipients.some((r: any) =>
                                r.user.name.includes(pos) || false
                            )
                            return (
                                <div key={idx} className="flex items-center h-7 px-2">
                                    <div className="w-5 h-5 border border-black flex items-center justify-center mr-2 shrink-0">
                                        {isChecked && <Check className="w-4 h-4" />}
                                    </div>
                                    <span className="text-sm">{pos} :</span>
                                </div>
                            )
                        })}
                    </div>

                    {/* Instructions and Notes Split */}
                    <div className="grid grid-cols-2 divide-x divide-black">
                        {/* Instructions Column */}
                        <div className="divide-y divide-black">
                            {predefinedInstructions.map((instr, idx) => {
                                const isChecked = disposition.instructions.some((i: any) => i.instruction.name === instr)
                                return (
                                    <div key={idx} className="flex items-center h-6 px-2">
                                        <div className="w-4 h-4 shrink-0 mr-2 border border-black flex items-center justify-center">
                                            {isChecked && <Check className="w-3 h-3" />}
                                        </div>
                                        <span className="text-sm">{instr}</span>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Notes Column */}
                        <div className="p-3 relative min-h-[150px]">
                            <p className="font-semibold text-sm mb-2">Catatan :</p>
                            <div className="whitespace-pre-wrap text-sm">
                                {disposition.notes}
                            </div>

                            {/* Signature Area at bottom right - QR replaces manual signature */}
                            <div className="absolute bottom-3 right-3 text-center">
                                <p className="text-sm">Pontianak, {format(new Date(disposition.createdAt), 'dd MMMM yyyy', { locale: id })}</p>
                                <p className="text-sm">Plt. Kepala TVRI Stasiun Kalimantan Barat</p>

                                {/* QR Code replaces manual signature */}
                                <div className="h-20 flex items-center justify-center my-2">
                                    {qrDataUrl && (
                                        <img src={qrDataUrl} alt="QR Code" className="h-16 w-16" />
                                    )}
                                </div>

                                <p className="font-semibold text-sm underline">Sugeng Widiyanto, SE</p>
                                <p className="text-xs">NIP. 197105231993031003</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sekretariat */}
                <div className="mt-3 text-sm mb-12">
                    <span>Sekretariat :</span>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-4 flex justify-between text-[10px] items-end">
                <div className="text-[#1e3a8a] font-bold">
                    <p>LEMBAGA PENYIARAN PUBLIK</p>
                    <p>TELEVISI REPUBLIK INDONESIA</p>
                    <p>STASIUN KALIMANTAN BARAT</p>
                </div>
                <div className="text-right text-[#1e3a8a]">
                    <p>Jl. A Yani No.60, Pontianak, Kalimantan Barat 78121, Indonesia</p>
                    <p>P (0561) 736056 F (0561) 738037</p>
                    <p>www.tvri.go.id</p>
                </div>
            </div>
        </div>
    )
}
