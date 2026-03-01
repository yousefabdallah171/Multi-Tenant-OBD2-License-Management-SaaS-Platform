import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ActivateLicenseForm, type ActivationProgram } from '@/components/activation/ActivateLicenseForm'

interface ActivateLicenseModalProps {
  open: boolean
  onClose: () => void
  program: ActivationProgram | null
  onSuccess?: () => void
}

export function ActivateLicenseModal({ open, onClose, program, onSuccess }: ActivateLicenseModalProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('activate.title')}</DialogTitle>
        </DialogHeader>
        {program ? (
          <ActivateLicenseForm
            program={program}
            onCancel={onClose}
            onSuccess={() => {
              onSuccess?.()
              onClose()
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

