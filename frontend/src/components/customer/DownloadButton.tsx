import { useState } from 'react'
import { Download, LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { customerPortalService } from '@/services/customer.service'

interface DownloadButtonProps {
  downloadId: number
  downloadLink?: string | null
  disabled?: boolean
  className?: string
  label?: string
}

export function DownloadButton({ downloadId, downloadLink, disabled = false, className, label }: DownloadButtonProps) {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const isDisabled = disabled || !downloadLink || isLoading

  const handleDownload = async () => {
    if (!downloadLink || disabled) {
      return
    }

    setIsLoading(true)

    const popup = window.open('', '_blank', 'noopener,noreferrer')

    try {
      await customerPortalService.logDownload(downloadId)
    } catch (error) {
      console.error(error)
      toast.error(t('customerPortal.download.logFailed'))
    } finally {
      if (popup) {
        popup.location.href = downloadLink
      } else {
        window.open(downloadLink, '_blank', 'noopener,noreferrer')
      }

      setIsLoading(false)
    }
  }

  return (
    <Button
      type="button"
      className={className}
      disabled={isDisabled}
      onClick={() => void handleDownload()}
      title={isDisabled ? t('customerPortal.download.disabledTooltip') : undefined}
    >
      {isLoading ? <LoaderCircle className="me-2 h-4 w-4 animate-spin" /> : <Download className="me-2 h-4 w-4" />}
      {label ?? t('customerPortal.actions.download')}
    </Button>
  )
}
