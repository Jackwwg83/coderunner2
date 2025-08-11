'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { 
  Bell, 
  CreditCard, 
  Key, 
  Lock, 
  Mail, 
  Palette, 
  Save, 
  Shield, 
  Trash2, 
  User, 
  Zap 
} from 'lucide-react'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile')
  const [notifications, setNotifications] = useState({
    deployments: true,
    security: true,
    billing: false,
    marketing: false
  })

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'api', label: 'API Keys', icon: Key },
    { id: 'preferences', label: 'Preferences', icon: Palette }
  ]

  return (
    <DashboardLayout>
      {/* Header */}
      <header className="border-b border-neutral-800 p-6">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-neutral-400 mt-1">Manage your account and preferences</p>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <Card className="lg:col-span-1 bg-neutral-900 border-neutral-800">
            <CardContent className="p-4">
              <nav className="space-y-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                        activeTab === tab.id
                          ? 'bg-orange-500/20 text-orange-400'
                          : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  )
                })}
              </nav>
            </CardContent>
          </Card>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <Card className="bg-neutral-900 border-neutral-800">
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Full Name</Label>
                      <Input id="name" defaultValue="John Doe" className="bg-neutral-800 border-neutral-700" />
                    </div>
                    <div>
                      <Label htmlFor="email">Email Address</Label>
                      <Input id="email" type="email" defaultValue="john@example.com" className="bg-neutral-800 border-neutral-700" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="company">Company</Label>
                    <Input id="company" defaultValue="Acme Inc." className="bg-neutral-800 border-neutral-700" />
                  </div>
                  <Button className="bg-orange-500 hover:bg-orange-600 text-black">
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                <Card className="bg-neutral-900 border-neutral-800">
                  <CardHeader>
                    <CardTitle>Password</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="current-password">Current Password</Label>
                      <Input id="current-password" type="password" className="bg-neutral-800 border-neutral-700" />
                    </div>
                    <div>
                      <Label htmlFor="new-password">New Password</Label>
                      <Input id="new-password" type="password" className="bg-neutral-800 border-neutral-700" />
                    </div>
                    <div>
                      <Label htmlFor="confirm-password">Confirm Password</Label>
                      <Input id="confirm-password" type="password" className="bg-neutral-800 border-neutral-700" />
                    </div>
                    <Button className="bg-orange-500 hover:bg-orange-600 text-black">
                      Update Password
                    </Button>
                  </CardContent>
                </Card>

                <Card className="bg-neutral-900 border-neutral-800">
                  <CardHeader>
                    <CardTitle>Two-Factor Authentication</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Enable 2FA</p>
                        <p className="text-sm text-neutral-400">Add an extra layer of security to your account</p>
                      </div>
                      <Switch />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <Card className="bg-neutral-900 border-neutral-800">
                <CardHeader>
                  <CardTitle>Email Notifications</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { key: 'deployments', label: 'Deployment Updates', description: 'Get notified about deployment status changes' },
                    { key: 'security', label: 'Security Alerts', description: 'Important security notifications and warnings' },
                    { key: 'billing', label: 'Billing & Usage', description: 'Billing notifications and usage alerts' },
                    { key: 'marketing', label: 'Product Updates', description: 'New features and product announcements' }
                  ].map((setting) => (
                    <div key={setting.key} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{setting.label}</p>
                        <p className="text-sm text-neutral-400">{setting.description}</p>
                      </div>
                      <Switch 
                        checked={notifications[setting.key as keyof typeof notifications]}
                        onCheckedChange={(checked) => 
                          setNotifications(prev => ({ ...prev, [setting.key]: checked }))
                        }
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* API Keys Tab */}
            {activeTab === 'api' && (
              <Card className="bg-neutral-900 border-neutral-800">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>API Keys</CardTitle>
                    <Button className="bg-orange-500 hover:bg-orange-600 text-black" size="sm">
                      <Key className="w-4 h-4 mr-2" />
                      New API Key
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 border border-neutral-800 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Production Key</p>
                          <p className="text-sm text-neutral-400 font-mono">coderunner_prod_••••••••••••••••</p>
                          <p className="text-xs text-neutral-500 mt-1">Created on March 15, 2024 • Last used 2 days ago</p>
                        </div>
                        <Button variant="outline" size="sm" className="border-red-700 text-red-400 hover:bg-red-900/20">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-center py-8 text-neutral-500">
                      <Key className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>API keys help you authenticate with CodeRunner API</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Other tabs can be added here */}
            {!['profile', 'security', 'notifications', 'api'].includes(activeTab) && (
              <Card className="bg-neutral-900 border-neutral-800">
                <CardContent className="p-12 text-center">
                  <div className="text-neutral-400">
                    <Zap className="w-12 h-12 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">{tabs.find(t => t.id === activeTab)?.label} Settings</h3>
                    <p>This section is coming soon.</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}