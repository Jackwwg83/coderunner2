'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { 
  Crown, 
  Mail, 
  MoreVertical, 
  Plus, 
  Search, 
  Settings, 
  Shield, 
  User, 
  UserCheck, 
  UserPlus, 
  Zap 
} from 'lucide-react'

interface TeamMember {
  id: string
  name: string
  email: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  status: 'active' | 'invited' | 'suspended'
  avatar?: string
  joinedAt: string
  lastActive: string
}

export default function TeamPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRole, setSelectedRole] = useState<string>('all')

  // Mock data - will be replaced with API integration
  const teamMembers: TeamMember[] = [
    {
      id: '1',
      name: 'Alex Johnson',
      email: 'alex@company.com',
      role: 'owner',
      status: 'active',
      avatar: '/placeholder-user.jpg',
      joinedAt: '2024-01-15',
      lastActive: '2 minutes ago'
    },
    {
      id: '2', 
      name: 'Sarah Chen',
      email: 'sarah@company.com',
      role: 'admin',
      status: 'active',
      joinedAt: '2024-02-01',
      lastActive: '1 hour ago'
    },
    {
      id: '3',
      name: 'Mike Rodriguez',
      email: 'mike@company.com', 
      role: 'member',
      status: 'active',
      joinedAt: '2024-02-15',
      lastActive: '1 day ago'
    },
    {
      id: '4',
      name: 'Emma Wilson',
      email: 'emma@company.com',
      role: 'viewer',
      status: 'invited',
      joinedAt: '2024-03-01',
      lastActive: 'Never'
    }
  ]

  const filteredMembers = teamMembers.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         member.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesRole = selectedRole === 'all' || member.role === selectedRole
    return matchesSearch && matchesRole
  })

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return Crown
      case 'admin': return Shield
      case 'member': return User
      case 'viewer': return UserCheck
      default: return User
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
      case 'admin': return 'text-red-400 bg-red-500/10 border-red-500/20'
      case 'member': return 'text-blue-400 bg-blue-500/10 border-blue-500/20'
      case 'viewer': return 'text-green-400 bg-green-500/10 border-green-500/20'
      default: return 'text-gray-400 bg-gray-500/10 border-gray-500/20'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-400'
      case 'invited': return 'bg-yellow-400'
      case 'suspended': return 'bg-red-400'
      default: return 'bg-gray-400'
    }
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <header className="border-b border-neutral-800 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Team Management</h1>
            <p className="text-neutral-400 mt-1">Manage team members and permissions</p>
          </div>
          <Button className="bg-orange-500 hover:bg-orange-600 text-black font-medium">
            <UserPlus className="w-4 h-4 mr-2" />
            Invite Member
          </Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <Input
              placeholder="Search team members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-neutral-900 border-neutral-700 focus:border-orange-500"
            />
          </div>
          <select 
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          >
            <option value="all">All Roles</option>
            <option value="owner">Owner</option>
            <option value="admin">Admin</option>
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
          </select>
        </div>

        {/* Team Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Members', value: teamMembers.length, color: 'text-blue-400' },
            { label: 'Active', value: teamMembers.filter(m => m.status === 'active').length, color: 'text-green-400' },
            { label: 'Invited', value: teamMembers.filter(m => m.status === 'invited').length, color: 'text-yellow-400' },
            { label: 'Admins', value: teamMembers.filter(m => m.role === 'admin' || m.role === 'owner').length, color: 'text-red-400' }
          ].map((stat, index) => (
            <Card key={index} className="bg-neutral-900 border-neutral-800">
              <CardContent className="p-4 text-center">
                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-sm text-neutral-400">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Team Members List */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle>Team Members ({filteredMembers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredMembers.map((member) => {
                const RoleIcon = getRoleIcon(member.role)
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 border border-neutral-800 rounded-lg hover:border-neutral-700 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={member.avatar} />
                          <AvatarFallback className="bg-neutral-800 text-neutral-200">
                            {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 ${getStatusColor(member.status)} rounded-full border-2 border-black`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{member.name}</h3>
                          <Badge className={getRoleColor(member.role)} variant="outline">
                            <RoleIcon className="w-3 h-3 mr-1" />
                            {member.role}
                          </Badge>
                        </div>
                        <p className="text-sm text-neutral-400">{member.email}</p>
                        <div className="flex items-center gap-4 text-xs text-neutral-500 mt-1">
                          <span>Joined {new Date(member.joinedAt).toLocaleDateString()}</span>
                          <span>•</span>
                          <span>Last active {member.lastActive}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {member.status === 'invited' && (
                        <Badge variant="outline" className="text-yellow-400 border-yellow-500/20">
                          Pending
                        </Badge>
                      )}
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {filteredMembers.length === 0 && (
          <div className="text-center py-12">
            <User className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No team members found</h3>
            <p className="text-neutral-400 mb-4">
              {searchQuery ? 'Try adjusting your search or filters' : 'Invite your first team member'}
            </p>
            <Button className="bg-orange-500 hover:bg-orange-600 text-black">
              <UserPlus className="w-4 h-4 mr-2" />
              Invite Member
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}