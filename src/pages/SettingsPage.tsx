import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { useBusinessSettings } from '@/hooks/useBusinessSettings'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function SettingsPage() {
  const { settings, loading, refresh } = useBusinessSettings()
  const [form, setForm] = useState({
    business_name: '',
    address: '',
    phone: '',
    tin: '',
    vat_rate: '0.15',
    nhil_rate: '0.025',
    getfund_rate: '0.025',
    covid_levy_rate: '0.01',
    tax_enabled: true,
    receipt_footer: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!settings) return
    setForm({
      business_name: settings.business_name,
      address: settings.address ?? '',
      phone: settings.phone ?? '',
      tin: settings.tin ?? '',
      vat_rate: String(settings.vat_rate),
      nhil_rate: String(settings.nhil_rate),
      getfund_rate: String(settings.getfund_rate),
      covid_levy_rate: String(settings.covid_levy_rate),
      tax_enabled: settings.tax_enabled,
      receipt_footer: settings.receipt_footer ?? '',
    })
  }, [settings])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase
      .from('business_settings')
      .update({
        business_name: form.business_name,
        address: form.address || null,
        phone: form.phone || null,
        tin: form.tin || null,
        vat_rate: Number(form.vat_rate),
        nhil_rate: Number(form.nhil_rate),
        getfund_rate: Number(form.getfund_rate),
        covid_levy_rate: Number(form.covid_levy_rate),
        tax_enabled: form.tax_enabled,
        receipt_footer: form.receipt_footer || null,
      })
      .eq('id', true)

    if (error) toast.error(error.message)
    else {
      toast.success('Settings saved')
      refresh()
    }
    setSaving(false)
  }

  if (loading) return <p className="text-muted-foreground">Loading…</p>

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Business details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="business_name">Business name</Label>
              <Input
                id="business_name"
                value={form.business_name}
                onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tin">TIN (Tax ID)</Label>
                <Input id="tin" value={form.tin} onChange={(e) => setForm({ ...form, tin: e.target.value })} />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.tax_enabled}
                onChange={(e) => setForm({ ...form, tax_enabled: e.target.checked })}
                className="size-4"
              />
              Apply VAT / NHIL / GETFund / COVID-19 Levy on sales
            </label>

            {form.tax_enabled && (
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vat">VAT rate</Label>
                  <Input id="vat" type="number" step="0.001" value={form.vat_rate} onChange={(e) => setForm({ ...form, vat_rate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nhil">NHIL rate</Label>
                  <Input id="nhil" type="number" step="0.001" value={form.nhil_rate} onChange={(e) => setForm({ ...form, nhil_rate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="getfund">GETFund rate</Label>
                  <Input id="getfund" type="number" step="0.001" value={form.getfund_rate} onChange={(e) => setForm({ ...form, getfund_rate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="covid">COVID levy rate</Label>
                  <Input id="covid" type="number" step="0.001" value={form.covid_levy_rate} onChange={(e) => setForm({ ...form, covid_levy_rate: e.target.value })} />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="footer">Receipt footer message</Label>
              <Textarea
                id="footer"
                value={form.receipt_footer}
                onChange={(e) => setForm({ ...form, receipt_footer: e.target.value })}
                rows={2}
              />
            </div>

            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save settings'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
