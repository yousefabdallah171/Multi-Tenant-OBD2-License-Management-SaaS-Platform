import { useState } from 'react'
import { Download, FileText, LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

interface ExportButtonsProps {
  onExportCsv: () => Promise<void> | void
  onExportPdf: () => Promise<void> | void
  isExporting?: boolean
}

export function ExportButtons({ onExportCsv, onExportPdf, isExporting = false }: ExportButtonsProps) {
  const { t } = useTranslation()
  const [activeFormat, setActiveFormat] = useState<'csv' | 'pdf' | null>(null)
  const disabled = isExporting || activeFormat !== null

  async function handleExport(format: 'csv' | 'pdf', action: () => Promise<void> | void) {
    setActiveFormat(format)

    try {
      await action()
    } finally {
      setActiveFormat(null)
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Button type="button" variant="outline" onClick={() => void handleExport('csv', onExportCsv)} disabled={disabled}>
        {activeFormat === 'csv' ? <LoaderCircle className="me-2 h-4 w-4 animate-spin" /> : <Download className="me-2 h-4 w-4" />}
        {t('common.csv')}
      </Button>
      <Button type="button" variant="outline" onClick={() => void handleExport('pdf', onExportPdf)} disabled={disabled}>
        {activeFormat === 'pdf' ? <LoaderCircle className="me-2 h-4 w-4 animate-spin" /> : <FileText className="me-2 h-4 w-4" />}
        {t('common.pdf')}
      </Button>
    </div>
  )
}
