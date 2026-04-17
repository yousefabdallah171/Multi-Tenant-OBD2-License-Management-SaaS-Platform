import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ALL_COUNTRIES } from '@/lib/countries'

interface EditCustomerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  initialClientName: string
  initialEmail?: string | null
  initialPhone?: string | null
  initialCountryName?: string | null
  initialPrice?: number | null
  showCountryField?: boolean
  showPriceField?: boolean
  isPending?: boolean
  onSubmit: (payload: { client_name: string; email?: string; phone?: string; country_name?: string; price?: number }) => void
}

export function EditCustomerDialog({
  open,
  onOpenChange,
  title,
  description,
  initialClientName,
  initialEmail,
  initialPhone,
  initialCountryName,
  initialPrice,
  showCountryField = false,
  showPriceField = false,
  isPending = false,
  onSubmit,
}: EditCustomerDialogProps) {
  const { t } = useTranslation()
  const [clientName, setClientName] = useState(initialClientName)
  const [email, setEmail] = useState(initialEmail ?? '')
  const [phone, setPhone] = useState(initialPhone ?? '')
  const [countryName, setCountryName] = useState(initialCountryName ?? '')
  const [price, setPrice] = useState(initialPrice !== null && initialPrice !== undefined ? initialPrice.toFixed(2) : '')

  useEffect(() => {
    if (!open) {
      return
    }

    setClientName(initialClientName)
    setEmail(initialEmail ?? '')
    setPhone(initialPhone ?? '')
    setCountryName(initialCountryName ?? '')
    setPrice(initialPrice !== null && initialPrice !== undefined ? initialPrice.toFixed(2) : '')
  }, [initialClientName, initialCountryName, initialEmail, initialPhone, initialPrice, open])

  const trimmedClientName = clientName.trim()
  const trimmedPrice = price.trim()
  const parsedPrice = trimmedPrice === '' ? null : Number(trimmedPrice)
  const isPriceValid = !showPriceField || trimmedPrice === '' || (parsedPrice !== null && Number.isFinite(parsedPrice) && parsedPrice >= 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title ?? t('common.edit', { defaultValue: 'Edit Customer' })}</DialogTitle>
          <DialogDescription>{description ?? t('common.edit', { defaultValue: 'Update customer information.' })}</DialogDescription>
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
          {showCountryField ? (
            <Field label={t('common.country', { defaultValue: 'Country' })} htmlFor="edit-customer-country">
              <select
                id="edit-customer-country"
                value={countryName}
                onChange={(event) => setCountryName(event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">{t('common.country', { defaultValue: 'Country' })}</option>
                {ALL_COUNTRIES.map((country) => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
            </Field>
          ) : null}
          {showPriceField ? (
            <Field label={t('common.price', { defaultValue: 'Price' })} htmlFor="edit-customer-price">
              <Input
                id="edit-customer-price"
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
            </Field>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            disabled={isPending || trimmedClientName.length < 1 || !isPriceValid}
            onClick={() => onSubmit({
              client_name: trimmedClientName,
              email: email.trim() || undefined,
              phone: phone.trim() || undefined,
              country_name: showCountryField ? (countryName.trim() || undefined) : undefined,
              price: showPriceField && parsedPrice !== null ? Number(parsedPrice.toFixed(2)) : undefined,
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
