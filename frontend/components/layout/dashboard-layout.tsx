'use client'

'use client'

import { useState } from 'react'
import { 
  Activity,
  ChevronDown,
  Database, 
  FileText,
  Server,
  Settings,
  Users,
  Zap 
} from 'lucide-react'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  // Simple active state check - this can be enhanced later
  const isActive = (path: string) => {
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname
      if (path === '/' && pathname === '/') return true
      if (path !== '/' && pathname.startsWith(path)) return true
    }
    return false
  }

  const navItems = [
    { href: '/deployments', label: 'Deployments', icon: Server },
    { href: '/projects', label: 'Projects', icon: FileText },
    { href: '/databases', label: 'Databases', icon: Database },
    { href: '/team', label: 'Team', icon: Users },
    { href: '/billing', label: 'Billing', icon: Activity },
    { href: '/settings', label: 'Settings', icon: Settings }
  ]

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-full bg-neutral-900 border-r border-neutral-800 transition-all duration-300 z-50 ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
        <div className="p-4">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-black" />
            </div>
            {!sidebarCollapsed && <span className="font-bold text-xl">CodeRunner</span>}
          </div>
          
          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)
              
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    active
                      ? 'bg-orange-500/20 text-orange-400'
                      : 'hover:bg-neutral-800 transition-colors'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </a>
              )
            })}
          </nav>
        </div>
        
        <button 
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute bottom-4 left-4 p-2 rounded-lg hover:bg-neutral-800 transition-colors"
        >
          <ChevronDown className={`w-5 h-5 transition-transform ${sidebarCollapsed ? 'rotate-90' : '-rotate-90'}`} />
        </button>
      </div>

      {/* Main Content */}
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        {children}
      </div>
    </div>
  )
}