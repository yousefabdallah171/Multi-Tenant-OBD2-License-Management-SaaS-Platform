import { Download, FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

interface ExportButtonsProps {
  onExportCsv: () => void
  onExportPdf: () => void
  isExporting?: boolean
}

export function ExportButtons({ onExportCsv, onExportPdf, isExporting = false }: ExportButtonsProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-wrap gap-3">
      <Button type="button" variant="secondary" onClick={onExportCsv} disabled={isExporting}>
        <Download className="me-2 h-4 w-4" />
        {t('common.csv')}
      </Button>
      <Button type="button" variant="secondary" onClick={onExportPdf} disabled={isExporting}>
        <FileText className="me-2 h-4 w-4" />
        {t('common.pdf')}
      </Button>
    </div>
  )
}
