import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useProducts } from '@/hooks/useProducts'
import { useCategories } from '@/hooks/useCategories'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { formatGHS } from '@/lib/currency'
import type { Product } from '@/types/db'

interface UnitFormRow {
  id?: string
  label: string
  conversion_qty: string
  price_ghs: string
}
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

const emptyForm = {
  name: '',
  category_id: '',
  sku: '',
  barcode: '',
  unit: 'pc',
  price_ghs: '',
  cost_ghs: '',
  vat_exempt: false,
  stock_qty: '',
  low_stock_threshold: '5',
}

export default function InventoryPage() {
  const { products, loading, refresh } = useProducts()
  const { categories } = useCategories()
  const { profile } = useAuth()
  const canManage = profile?.role === 'admin' || profile?.role === 'manager'
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [units, setUnits] = useState<UnitFormRow[]>([])
  const [removedUnitIds, setRemovedUnitIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setUnits([])
    setRemovedUnitIds([])
    setDialogOpen(true)
  }

  function openEdit(product: Product) {
    setEditing(product)
    setForm({
      name: product.name,
      category_id: product.category_id ?? '',
      sku: product.sku ?? '',
      barcode: product.barcode ?? '',
      unit: product.unit,
      price_ghs: String(product.price_ghs),
      cost_ghs: product.cost_ghs !== null ? String(product.cost_ghs) : '',
      vat_exempt: product.vat_exempt,
      stock_qty: String(product.stock_qty),
      low_stock_threshold: String(product.low_stock_threshold),
    })
    setUnits(
      (product.product_units ?? []).map((pu) => ({
        id: pu.id,
        label: pu.label,
        conversion_qty: String(pu.conversion_qty),
        price_ghs: String(pu.price_ghs),
      })),
    )
    setRemovedUnitIds([])
    setDialogOpen(true)
  }

  function addUnitRow() {
    setUnits((u) => [...u, { label: '', conversion_qty: '', price_ghs: '' }])
  }

  function updateUnitRow(index: number, patch: Partial<UnitFormRow>) {
    setUnits((u) => u.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function removeUnitRow(index: number) {
    setUnits((u) => {
      const row = u[index]
      if (row.id) setRemovedUnitIds((ids) => [...ids, row.id!])
      return u.filter((_, i) => i !== index)
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)

    const payload = {
      name: form.name,
      category_id: form.category_id || null,
      sku: form.sku || null,
      barcode: form.barcode || null,
      unit: form.unit,
      price_ghs: Number(form.price_ghs),
      cost_ghs: form.cost_ghs ? Number(form.cost_ghs) : null,
      vat_exempt: form.vat_exempt,
      stock_qty: Number(form.stock_qty),
      low_stock_threshold: Number(form.low_stock_threshold),
    }

    const { data: productRow, error } = editing
      ? await supabase.from('products').update(payload).eq('id', editing.id).select('id').single()
      : await supabase.from('products').insert(payload).select('id').single()

    if (error || !productRow) {
      toast.error(error?.message ?? 'Failed to save product')
      setSaving(false)
      return
    }

    const validUnits = units.filter((u) => u.label.trim())
    const unitsError = (
      await Promise.all([
        removedUnitIds.length > 0
          ? supabase.from('product_units').update({ is_active: false }).in('id', removedUnitIds)
          : Promise.resolve({ error: null }),
        ...validUnits.map((u) => {
          const unitPayload = {
            product_id: productRow.id,
            label: u.label.trim(),
            conversion_qty: Number(u.conversion_qty),
            price_ghs: Number(u.price_ghs),
            is_active: true,
          }
          return u.id
            ? supabase.from('product_units').update(unitPayload).eq('id', u.id)
            : supabase.from('product_units').insert(unitPayload)
        }),
      ])
    ).find((r) => r.error)?.error

    if (unitsError) {
      toast.error(unitsError.message)
    } else {
      toast.success(editing ? 'Product updated' : 'Product added')
      setDialogOpen(false)
      refresh()
    }
    setSaving(false)
  }

  async function handleDelete(product: Product) {
    if (!confirm(`Remove "${product.name}" from the catalog?`)) return
    const { error } = await supabase.from('products').update({ is_active: false }).eq('id', product.id)
    if (error) toast.error(error.message)
    else {
      toast.success('Product removed')
      refresh()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Inventory</h1>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Add product
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>VAT</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={canManage ? 6 : 5} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!loading && products.length === 0 && (
              <TableRow>
                <TableCell colSpan={canManage ? 6 : 5} className="text-center text-muted-foreground">
                  No products yet. Add your first one.
                </TableCell>
              </TableRow>
            )}
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">
                  {product.name}
                  {product.product_units && product.product_units.length > 0 && (
                    <Badge variant="secondary" className="ml-2 text-[10px]">
                      +{product.product_units.length} packaging
                      {product.product_units.length > 1 ? 's' : ''}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{product.sku ?? '—'}</TableCell>
                <TableCell>{formatGHS(product.price_ghs)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {product.stock_qty} {product.unit}
                    {product.stock_qty <= product.low_stock_threshold && (
                      <Badge variant="destructive">Low</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>{product.vat_exempt ? 'Exempt' : 'Standard'}</TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(product)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(product)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit product' : 'Add product'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={form.category_id || undefined}
                onValueChange={(v) => setForm({ ...form, category_id: v ?? '' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Input id="unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="pc, kg, bag…" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="barcode">Barcode</Label>
              <Input id="barcode" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Price (GHS)</Label>
              <Input id="price" type="number" step="0.01" min={0} value={form.price_ghs} onChange={(e) => setForm({ ...form, price_ghs: e.target.value })} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cost">Cost (GHS)</Label>
              <Input id="cost" type="number" step="0.01" min={0} value={form.cost_ghs} onChange={(e) => setForm({ ...form, cost_ghs: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock">Stock quantity</Label>
              <Input id="stock" type="number" step="0.01" min={0} value={form.stock_qty} onChange={(e) => setForm({ ...form, stock_qty: e.target.value })} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="threshold">Low stock alert at</Label>
              <Input id="threshold" type="number" step="0.01" min={0} value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} />
            </div>

            <label className="col-span-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.vat_exempt}
                onChange={(e) => setForm({ ...form, vat_exempt: e.target.checked })}
                className="size-4"
              />
              VAT-exempt item
            </label>

            <div className="col-span-2 space-y-2 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label>Other packagings</Label>
                <Button type="button" size="sm" variant="outline" onClick={addUnitRow}>
                  <Plus className="size-3" />
                  Add packaging
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                E.g. a "Box of 24" sold on top of the {form.unit || 'base unit'} above — selling
                one deducts {form.unit || 'base unit'}s from the same stock count.
              </p>
              {units.map((row, i) => (
                <div key={row.id ?? i} className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Label</Label>
                    <Input
                      value={row.label}
                      onChange={(e) => updateUnitRow(i, { label: e.target.value })}
                      placeholder="Box of 24"
                    />
                  </div>
                  <div className="w-24 space-y-1">
                    <Label className="text-xs">= {form.unit || 'units'}</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={row.conversion_qty}
                      onChange={(e) => updateUnitRow(i, { conversion_qty: e.target.value })}
                    />
                  </div>
                  <div className="w-28 space-y-1">
                    <Label className="text-xs">Price (GHS)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={row.price_ghs}
                      onChange={(e) => updateUnitRow(i, { price_ghs: e.target.value })}
                    />
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => removeUnitRow(i)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>

            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save product'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
