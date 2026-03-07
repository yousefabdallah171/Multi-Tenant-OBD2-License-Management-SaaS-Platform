import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface EditCustomerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  initialClientName: string
  initialEmail?: string | null
  initialPhone?: string | null
  isPending?: boolean
  onSubmit: (payload: { client_name: string; email?: string; phone?: string }) => void
}

export function EditCustomerDialog({
  open,
  onOpenChange,
  title,
  description,
  initialClientName,
  initialEmail,
  initialPhone,
  isPending = false,
  onSubmit,
}: EditCustomerDialogProps) {
  const { t } = useTranslation()
  const [clientName, setClientName] = useState(initialClientName)
  const [email, setEmail] = useState(initialEmail ?? '')
  const [phone, setPhone] = useState(initialPhone ?? '')

  useEffect(() => {
    if (!open) {
      return
    }

    setClientName(initialClientName)
    setEmail(initialEmail ?? '')
    setPhone(initialPhone ?? '')
  }, [initialClientName, initialEmail, initialPhone, open])

  const trimmedClientName = clientName.trim()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title ?? t('common.edit', { defaultValue: 'Edit Customer' })}</DialogTitle>
          <DialogDescription>{description ?? 'Update customer information.'}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label={t('activate.clientName', { defaultValue: 'Client Display Name' })} htmlFor="edit-customer-client-name">
            <Input id="edit-customer-client-name" value={clientName} onChange={(event) => setClientName(event.target.value)} autoFocus />
          </Field>
          <Field label={t('common.email')} htmlFor="edit-customer-email">
            <Input id="edit-customer-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
          <Field label={t('common.phone')} htmlFor="edit-customer-phone">
            <Input id="edit-customer-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            disabled={isPending || trimmedClientName.length < 1}
            onClick={() => onSubmit({
              client_name: trimmedClientName,
              email: email.trim() || undefined,
              phone: phone.trim() || undefined,
            })}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isPending ? t('common.loading') : t('common.save', { defaultValue: 'Save' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}
