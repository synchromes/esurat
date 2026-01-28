'use client'

import { useState, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { QrCode, PenTool, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// Setup worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface PreviewPDFProps {
    url: string
    letter: any // Use proper type if possible
}

export function PreviewPDF({ url, letter }: PreviewPDFProps) {
    const [numPages, setNumPages] = useState<number>(0)
    const [pageWidth, setPageWidth] = useState<number>(0)
    const [containerWidth, setContainerWidth] = useState<number>(0)
    const [loading, setLoading] = useState(true)

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages)
        setLoading(false)
    }

    // Determine scale based on container width
    const pageNumber = letter.qrPage || 1

    // Handle resize
    useEffect(() => {
        function updateWidth() {
            const container = document.getElementById('pdf-container')
            if (container) {
                setContainerWidth(container.clientWidth)
            }
        }

        window.addEventListener('resize', updateWidth)
        // Initial width
        updateWidth()

        return () => window.removeEventListener('resize', updateWidth)
    }, [])

    return (
        <div
            id="pdf-container"
            className="w-full relative flex justify-center"
            ref={(el) => {
                if (el) {
                    setContainerWidth(el.clientWidth)
                }
            }}
        >
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-gray-100/50">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            )}

            <Document
                file={url}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={
                    <div className="flex items-center justify-center h-[500px]">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                }
                error={
                    <div className="flex items-center justify-center h-[200px] text-destructive">
                        Gagal memuat PDF
                    </div>
                }
                className="shadow-lg"
            >
                <Page
                    pageNumber={pageNumber}
                    width={containerWidth ? Math.min(containerWidth, 800) : 600}
                    onLoadSuccess={(page) => {
                        // page.originalWidth gives the width in points (default 72dpi usually)
                    }}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                >
                    {['DRAFT', 'PENDING_APPROVAL'].includes(letter.status) && !letter.fileStamped && !loading && (
                        <>
                            <div
                                className="absolute border-2 border-primary bg-primary/20 flex items-center justify-center rounded shadow-lg"
                                style={{
                                    left: `${letter.qrXPercent * 100}%`,
                                    top: `${letter.qrYPercent * 100}%`,
                                    width: `${(letter.qrSize / 595.28) * 100}%`,
                                    aspectRatio: '1/1'
                                }}
                            >
                                <QrCode className="w-1/2 h-1/2 text-primary" />
                            </div>
                            <div
                                className="absolute border-2 border-blue-500 bg-blue-500/20 flex items-center justify-center rounded shadow-lg"
                                style={{
                                    left: `${letter.parafXPercent * 100}%`,
                                    top: `${letter.parafYPercent * 100}%`,
                                    width: `${(letter.parafSize / 595.28) * 100}%`,
                                    aspectRatio: '1/1'
                                }}
                            >
                                <PenTool className="w-1/2 h-1/2 text-blue-500" />
                            </div>
                        </>
                    )}
                </Page>
            </Document>
        </div>
    )
}
