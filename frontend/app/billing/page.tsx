'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { CreditCard, Database, FileText, TrendingUp, Users, Zap } from 'lucide-react'

export default function BillingPage() {
  const currentPlan = {
    name: 'Free Tier',
    price: '$0',
    period: 'month'
  }

  const usage = {
    deployments: { current: 3, limit: 5, unit: 'deployments' },
    storage: { current: 2.3, limit: 5, unit: 'GB' },
    bandwidth: { current: 8.5, limit: 100, unit: 'GB' },
    databases: { current: 2, limit: 2, unit: 'databases' }
  }

  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: 'month',
      current: true,
      features: [
        '5 Deployments',
        '5GB Storage',
        '100GB Bandwidth',
        '2 Databases',
        'Community Support'
      ]
    },
    {
      name: 'Pro',
      price: '$29',
      period: 'month',
      popular: true,
      features: [
        '50 Deployments',
        '100GB Storage',
        '1TB Bandwidth',
        '10 Databases',
        'Priority Support',
        'Custom Domains',
        'Team Collaboration'
      ]
    },
    {
      name: 'Enterprise',
      price: '$99',
      period: 'month',
      features: [
        'Unlimited Deployments',
        '1TB Storage',
        '10TB Bandwidth',
        'Unlimited Databases',
        '24/7 Support',
        'Custom Domains',
        'Advanced Analytics',
        'SSO Integration'
      ]
    }
  ]

  const getUsagePercentage = (current: number, limit: number) => {
    return Math.min((current / limit) * 100, 100)
  }

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-400'
    if (percentage >= 70) return 'text-yellow-400'
    return 'text-green-400'
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-64 bg-neutral-900 border-r border-neutral-800">
        <div className="p-4">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-black" />
            </div>
            <span className="font-bold text-xl">CodeRunner</span>
          </div>
          
          <nav className="space-y-2">
            <a href="/" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-neutral-800 transition-colors">
              <Database className="w-5 h-5" />
              <span>Deployments</span>
            </a>
            <a href="/projects" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-neutral-800 transition-colors">
              <FileText className="w-5 h-5" />
              <span>Projects</span>
            </a>
            <a href="/databases" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-neutral-800 transition-colors">
              <Database className="w-5 h-5" />
              <span>Databases</span>
            </a>
            <a href="/team" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-neutral-800 transition-colors">
              <Users className="w-5 h-5" />
              <span>Team</span>
            </a>
            <a href="/billing" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-orange-500/20 text-orange-400">
              <CreditCard className="w-5 h-5" />
              <span>Billing</span>
            </a>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-64">
        {/* Header */}
        <header className="border-b border-neutral-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Billing & Usage</h1>
              <p className="text-neutral-400 mt-1">Manage your subscription and monitor usage</p>
            </div>
            <Button className="bg-orange-500 hover:bg-orange-600 text-black font-medium">
              <TrendingUp className="w-4 h-4 mr-2" />
              Upgrade Plan
            </Button>
          </div>
        </header>

        <div className="p-6 space-y-8">
          {/* Current Plan */}
          <Card className="bg-neutral-900 border-neutral-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Current Plan</CardTitle>
                  <p className="text-neutral-400 mt-1">You are currently on the {currentPlan.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold">{currentPlan.price}</p>
                  <p className="text-neutral-400">per {currentPlan.period}</p>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Usage This Month */}
          <Card className="bg-neutral-900 border-neutral-800">
            <CardHeader>
              <CardTitle>Usage This Month</CardTitle>
              <p className="text-neutral-400">Monitor your resource consumption</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {Object.entries(usage).map(([key, data]) => {
                const percentage = getUsagePercentage(data.current, data.limit)
                return (
                  <div key={key}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="capitalize font-medium">{key.replace(/([A-Z])/g, ' $1')}</span>
                      <span className={`font-mono ${getUsageColor(percentage)}`}>
                        {data.current} / {data.limit} {data.unit}
                      </span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                    <div className="flex justify-between text-xs text-neutral-400 mt-1">
                      <span>{percentage.toFixed(1)}% used</span>
                      <span>{data.limit - data.current} {data.unit} remaining</span>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Available Plans */}
          <div>
            <h2 className="text-xl font-bold mb-6">Available Plans</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((plan, index) => (
                <Card key={index} className={`bg-neutral-900 border-neutral-800 relative ${
                  plan.popular ? 'border-orange-500' : ''
                }`}>
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-orange-500 text-black">Most Popular</Badge>
                    </div>
                  )}
                  <CardHeader className="text-center">
                    <CardTitle className="text-2xl">{plan.name}</CardTitle>
                    <div className="mt-4">
                      <span className="text-4xl font-bold">{plan.price}</span>
                      <span className="text-neutral-400">/{plan.period}</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3 mb-6">
                      {plan.features.map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-center gap-2 text-sm">
                          <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button 
                      className={`w-full ${
                        plan.current 
                          ? 'bg-neutral-700 text-neutral-400 cursor-not-allowed' 
                          : 'bg-orange-500 hover:bg-orange-600 text-black'
                      }`}
                      disabled={plan.current}
                    >
                      {plan.current ? 'Current Plan' : 'Upgrade'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Billing History */}
          <Card className="bg-neutral-900 border-neutral-800">
            <CardHeader>
              <CardTitle>Billing History</CardTitle>
              <p className="text-neutral-400">Your recent invoices and payments</p>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <CreditCard className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No billing history</h3>
                <p className="text-neutral-400">
                  You're currently on the free plan. Upgrade to see billing history.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
