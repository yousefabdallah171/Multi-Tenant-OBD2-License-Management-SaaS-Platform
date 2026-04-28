import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { RenewLicenseForm } from '@/components/licenses/RenewLicenseForm'
import type { RenewLicenseData } from '@/types/manager-reseller.types'

interface RenewLicenseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  confirmLoadingLabel: string
  cancelLabel: string
  onSubmit: (payload: RenewLicenseData) => void
  isPending?: boolean
  anchorDate?: string | null
  initialPrice?: number
  autoPricePerDay?: number
  initialScheduledAt?: string | null
  initialScheduledTimezone?: string | null
  initialExpiresAt?: string | null
  resetKey?: string | number | null
}

export function RenewLicenseDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmLoadingLabel,
  cancelLabel,
  onSubmit,
  isPending = false,
  anchorDate,
  initialPrice = 0,
  autoPricePerDay = 0,
  initialScheduledAt,
  initialScheduledTimezone,
  initialExpiresAt,
  resetKey,
}: RenewLicenseDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <RenewLicenseForm
          confirmLabel={confirmLabel}
          confirmLoadingLabel={confirmLoadingLabel}
          cancelLabel={cancelLabel}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
          isPending={isPending}
          anchorDate={anchorDate}
          initialPrice={initialPrice}
          autoPricePerDay={autoPricePerDay}
          initialScheduledAt={initialScheduledAt}
          initialScheduledTimezone={initialScheduledTimezone}
          initialExpiresAt={initialExpiresAt}
          resetKey={resetKey}
          enabled={open}
        />
      </DialogContent>
    </Dialog>
  )
}
