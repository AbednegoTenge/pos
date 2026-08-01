import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, ShoppingCart, Package, Settings, LogOut, Store, History, Menu } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useBusinessSettings } from '@/hooks/useBusinessSettings'
import { useLowStockAlerts } from '@/hooks/useLowStockAlerts'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import OfflineBanner from '@/components/layout/OfflineBanner'
import { cn } from '@/lib/utils'
import type { StaffRole } from '@/types/db'

// Omitting `roles` means visible to every authenticated staff member.
const NAV_ITEMS: {
  to: string
  label: string
  icon: typeof ShoppingCart
  end?: boolean
  roles?: StaffRole[]
}[] = [
  { to: '/', label: 'Checkout', icon: ShoppingCart, end: true },
  { to: '/inventory', label: 'Inventory', icon: Package },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: History, roles: ['admin', 'manager'] },
  { to: '/settings', label: 'Settings', icon: Settings, roles: ['admin'] },
]

export default function AppLayout() {
  const { profile, signOut } = useAuth()
  const { settings } = useBusinessSettings()
  useLowStockAlerts(profile?.role === 'admin' || profile?.role === 'manager')
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    document.title = settings?.business_name ? `${settings.business_name} · POS` : 'POS Ghana'
  }, [settings])

  const visibleNavItems = NAV_ITEMS.filter(
    (item) => !item.roles || (profile && item.roles.includes(profile.role)),
  )

  function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
    return (
      <nav className="flex-1 space-y-1 p-2">
        {visibleNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )
            }
          >
            <item.icon className="size-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <OfflineBanner />

      <div className="flex items-center justify-between border-b bg-card px-4 py-3 lg:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Store className="size-4" />
          </span>
          <p className="truncate font-semibold">{settings?.business_name ?? 'POS Ghana'}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setNavOpen(true)}>
          <Menu className="size-5" />
          <span className="sr-only">Open menu</span>
        </Button>
      </div>

      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="flex w-72 flex-col p-0">
          <SheetHeader className="border-b">
            <SheetTitle className="flex items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Store className="size-4" />
              </span>
              <span className="min-w-0">
                <p className="truncate">{settings?.business_name ?? 'POS Ghana'}</p>
                <span className="block truncate text-xs font-normal text-muted-foreground">
                  {profile?.full_name ?? '…'}
                </span>
              </span>
            </SheetTitle>
          </SheetHeader>
          <NavLinks onNavigate={() => setNavOpen(false)} />
          <div className="border-t p-2">
            <Button variant="ghost" className="w-full justify-start gap-2" onClick={signOut}>
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex flex-1">
        <aside className="hidden w-56 shrink-0 flex-col border-r bg-card lg:flex">
          <div className="flex items-center gap-2 border-b px-4 py-4">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Store className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold">{settings?.business_name ?? 'POS Ghana'}</p>
              <p className="truncate text-xs text-muted-foreground">{profile?.full_name ?? '…'}</p>
            </div>
          </div>
          <NavLinks />
          <div className="border-t p-2">
            <Button variant="ghost" className="w-full justify-start gap-2" onClick={signOut}>
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        </aside>
        <main className="flex-1 overflow-auto bg-muted/20 p-3 sm:p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
