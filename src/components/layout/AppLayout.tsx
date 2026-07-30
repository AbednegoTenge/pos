import { useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, ShoppingCart, Package, Settings, LogOut, Store, History } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useBusinessSettings } from '@/hooks/useBusinessSettings'
import { Button } from '@/components/ui/button'
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

  useEffect(() => {
    document.title = settings?.business_name ? `${settings.business_name} · POS` : 'POS Ghana'
  }, [settings])

  return (
    <div className="flex min-h-screen flex-col">
      <OfflineBanner />
      <div className="flex flex-1">
        <aside className="flex w-56 shrink-0 flex-col border-r bg-card">
          <div className="flex items-center gap-2 border-b px-4 py-4">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Store className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold">{settings?.business_name ?? 'POS Ghana'}</p>
              <p className="truncate text-xs text-muted-foreground">{profile?.full_name ?? '…'}</p>
            </div>
          </div>
          <nav className="flex-1 space-y-1 p-2">
            {NAV_ITEMS.filter((item) => !item.roles || (profile && item.roles.includes(profile.role))).map(
              (item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
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
              ),
            )}
          </nav>
          <div className="border-t p-2">
            <Button variant="ghost" className="w-full justify-start gap-2" onClick={signOut}>
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        </aside>
        <main className="flex-1 overflow-auto bg-muted/20 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
