'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { UserPlus, Search, Filter, Mail, Edit2, Trash2, Clock, Copy, Check, RefreshCw, Dumbbell, Apple, X, Loader2 } from 'lucide-react'
import { createClient } from '@/app/lib/supabase/client'
import { apiFetch } from '@/app/lib/api'

interface User {
  id: string
  slug: string | null
  email: string
  full_name: string | null
  is_active: boolean
  created_at: string
  status: string | null
  temp_password: string | null
  password_changed: boolean | null
  can_access_strength: boolean
  can_access_cardio: boolean
  can_access_hyrox: boolean
  can_access_hybrid: boolean
}

interface Program {
  id: string
  name: string
  category: string
}

interface NutritionPlan {
  id: string
  name: string
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  return (
    <button 
      onClick={handleCopy}
      className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
      title="Copy password"
    >
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
    </button>
  )
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  
  // Bulk selection state
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkAction, setBulkAction] = useState<'program' | 'nutrition' | null>(null)
  const [programs, setPrograms] = useState<Program[]>([])
  const [nutritionPlans, setNutritionPlans] = useState<NutritionPlan[]>([])
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null)
  const [selectedNutrition, setSelectedNutrition] = useState<string | null>(null)
  const [bulkAssigning, setBulkAssigning] = useState(false)
  const [bulkDuration, setBulkDuration] = useState(4)
  const [deletingUser, setDeletingUser] = useState<string | null>(null)

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to delete ${userName}? This cannot be undone.`)) {
      return
    }
    
    setDeletingUser(userId)
    try {
      const response = await apiFetch(`/api/users?id=${userId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        const data = await response.json()
        alert(data.error || 'Failed to delete client')
        return
      }
      
      // Remove from local state
      setUsers(prev => prev.filter(u => u.id !== userId))
    } catch (error) {
      console.error('Delete error:', error)
      alert('Failed to delete client')
    } finally {
      setDeletingUser(null)
    }
  }

  const toggleUserSelection = (userId: string) => {
    const newSelected = new Set(selectedUsers)
    if (newSelected.has(userId)) {
      newSelected.delete(userId)
    } else {
      newSelected.add(userId)
    }
    setSelectedUsers(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set())
    } else {
      setSelectedUsers(new Set(users.map(u => u.id)))
    }
  }

  const openBulkModal = async (action: 'program' | 'nutrition') => {
    setBulkAction(action)
    setShowBulkModal(true)
    
    if (action === 'program' && programs.length === 0) {
      const { data } = await supabase.from('programs').select('id, name, category').order('name')
      setPrograms(data || [])
    } else if (action === 'nutrition' && nutritionPlans.length === 0) {
      const { data } = await supabase.from('nutrition_plans').select('id, name').order('name')
      setNutritionPlans(data || [])
    }
  }

  const handleBulkAssign = async () => {
    if (selectedUsers.size === 0) return
    
    setBulkAssigning(true)
    try {
      const userIds = Array.from(selectedUsers)
      
      if (bulkAction === 'program' && selectedProgram) {
        // Assign program to all selected users
        const startDate = new Date()
        const endDate = new Date()
        endDate.setDate(endDate.getDate() + (bulkDuration * 7))
        
        const insertData = userIds.map(userId => ({
          client_id: userId,
          program_id: selectedProgram,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          duration_weeks: bulkDuration,
          is_active: true
        }))
        
        const { error } = await supabase.from('client_programs').insert(insertData)
        if (error) throw error
      } else if (bulkAction === 'nutrition' && selectedNutrition) {
        // First delete existing nutrition assignments
        await supabase.from('client_nutrition').delete().in('client_id', userIds)
        
        // Assign nutrition to all selected users
        const insertData = userIds.map(userId => ({
          client_id: userId,
          plan_id: selectedNutrition
        }))
        
        const { error } = await supabase.from('client_nutrition').insert(insertData)
        if (error) throw error
      }
      
      setShowBulkModal(false)
      setSelectedUsers(new Set())
      setSelectedProgram(null)
      setSelectedNutrition(null)
    } catch (err) {
      console.error('Bulk assign failed:', err)
    } finally {
      setBulkAssigning(false)
    }
  }

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const response = await apiFetch('/api/users')
      const data = await response.json()
      setUsers(data.users || [])
    } catch (error) {
      console.error('Failed to fetch users:', error)
      setUsers([])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">Clients</h1>
          <p className="text-zinc-400 text-sm lg:text-base mt-1">Manage your fitness clients</p>
        </div>
        <div className="flex items-center gap-2 lg:gap-3">
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="flex items-center gap-2 px-2.5 lg:px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg lg:rounded-xl transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/users/new"
            className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-black px-3 lg:px-4 py-2 rounded-lg lg:rounded-xl text-sm lg:text-base font-medium transition-colors"
          >
            <UserPlus className="w-4 h-4 lg:w-5 lg:h-5" />
            <span className="hidden sm:inline">Add</span> Client
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 lg:gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 lg:left-4 top-1/2 -translate-y-1/2 w-4 h-4 lg:w-5 lg:h-5 text-zinc-500" />
          <input
            type="search"
            placeholder="Search users by name or email..."
            className="w-full pl-10 lg:pl-12 pr-4 py-2.5 lg:py-3 bg-zinc-900 border border-zinc-800 rounded-lg lg:rounded-xl text-sm lg:text-base text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
          />
        </div>
        <button className="flex items-center gap-2 px-3 lg:px-4 py-2.5 lg:py-3 bg-zinc-900 border border-zinc-800 rounded-lg lg:rounded-xl text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors">
          <Filter className="w-4 h-4 lg:w-5 lg:h-5" />
          <span className="hidden sm:inline">Filters</span>
        </button>
      </div>

      {/* Bulk Action Toolbar */}
      {selectedUsers.size > 0 && (
        <div className="flex items-center gap-4 bg-yellow-400/10 border border-yellow-400/30 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center text-black font-bold text-sm">
              {selectedUsers.size}
            </span>
            <span className="text-white font-medium">users selected</span>
          </div>
          
          <div className="flex-1" />
          
          <button
            onClick={() => openBulkModal('program')}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-medium rounded-lg transition-colors"
          >
            <Dumbbell className="w-4 h-4" />
            Assign Program
          </button>
          <button
            onClick={() => openBulkModal('nutrition')}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
          >
            <Apple className="w-4 h-4" />
            Assign Nutrition
          </button>
          <button
            onClick={() => setSelectedUsers(new Set())}
            className="p-2 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Users Table */}
      <div className="card">
        {users.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th className="w-12 hidden sm:table-cell">
                    <input
                      type="checkbox"
                      checked={selectedUsers.size === users.length && users.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-zinc-600 text-yellow-400 focus:ring-yellow-400 focus:ring-offset-0 bg-zinc-700"
                    />
                  </th>
                  <th>User</th>
                  <th className="hidden md:table-cell">Email</th>
                  <th className="hidden sm:table-cell">Status</th>
                  <th className="hidden lg:table-cell">Temp Password</th>
                  <th className="hidden lg:table-cell">Joined</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className={selectedUsers.has(user.id) ? 'bg-yellow-400/5' : ''}>
                    <td className="hidden sm:table-cell">
                      <input
                        type="checkbox"
                        checked={selectedUsers.has(user.id)}
                        onChange={() => toggleUserSelection(user.id)}
                        className="w-4 h-4 rounded border-zinc-600 text-yellow-400 focus:ring-yellow-400 focus:ring-offset-0 bg-zinc-700"
                      />
                    </td>
                    <td>
                      <Link href={`/users/${user.slug || user.id}`} className="flex items-center gap-2 sm:gap-3 group">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center text-black font-medium text-sm sm:text-base group-hover:ring-2 group-hover:ring-yellow-400/50 transition-all flex-shrink-0">
                          {user.full_name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-white group-hover:text-yellow-400 transition-colors truncate">{user.full_name || 'No name set'}</p>
                          <p className="text-xs text-zinc-500 truncate">@{user.slug || user.email}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-zinc-500" />
                        <span className="truncate">{user.email || 'No email'}</span>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell">
                      {user.password_changed ? (
                        <span className="badge badge-success">Active</span>
                      ) : user.status === 'pending' ? (
                        <span className="badge badge-warning flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Pending
                        </span>
                      ) : (
                        <span className="badge badge-info">Invited</span>
                      )}
                    </td>
                    <td className="hidden lg:table-cell">
                      {user.temp_password && !user.password_changed ? (
                        <div className="flex items-center gap-2">
                          <code className="bg-zinc-800 px-2 py-1 rounded text-xs text-yellow-400 font-mono">
                            {user.temp_password}
                          </code>
                          <CopyButton text={user.temp_password} />
                        </div>
                      ) : user.password_changed ? (
                        <span className="text-zinc-500 text-xs">Changed</span>
                      ) : (
                        <span className="text-zinc-500 text-xs">—</span>
                      )}
                    </td>
                    <td className="hidden lg:table-cell text-zinc-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="flex items-center gap-1 sm:gap-2">
                        <Link
                          href={`/users/${user.slug || user.id}`}
                          className="p-1.5 sm:p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Link>
                        <button 
                          onClick={() => handleDeleteUser(user.id, user.full_name || user.email)}
                          disabled={deletingUser === user.id}
                          className="p-1.5 sm:p-2 rounded-lg hover:bg-red-500/10 text-zinc-400 hover:text-red-400 transition-colors disabled:opacity-50"
                        >
                          {deletingUser === user.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 lg:p-12 text-center">
            <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-3 lg:mb-4">
              <UserPlus className="w-6 h-6 lg:w-8 lg:h-8 text-zinc-500" />
            </div>
            <h3 className="text-lg lg:text-xl font-semibold text-white mb-2">No clients yet</h3>
            <p className="text-zinc-400 text-sm lg:text-base mb-4 lg:mb-6">Get started by adding your first client</p>
            <Link
              href="/users/new"
              className="inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-black px-4 lg:px-6 py-2.5 lg:py-3 rounded-lg lg:rounded-xl text-sm lg:text-base font-medium transition-colors"
            >
              <UserPlus className="w-4 h-4 lg:w-5 lg:h-5" />
              Add Your First User
            </Link>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 lg:gap-4">
        <div className="card p-3 lg:p-4 text-center">
          <p className="text-xl lg:text-2xl font-bold text-white">{users.length}</p>
          <p className="text-zinc-400 text-xs lg:text-sm">Total Clients</p>
        </div>
        <div className="card p-3 lg:p-4 text-center">
          <p className="text-xl lg:text-2xl font-bold text-green-500">{users.filter(u => u.is_active).length}</p>
          <p className="text-zinc-400 text-xs lg:text-sm">Active</p>
        </div>
        <div className="card p-3 lg:p-4 text-center">
          <p className="text-xl lg:text-2xl font-bold text-red-500">{users.filter(u => !u.is_active).length}</p>
          <p className="text-zinc-400 text-xs lg:text-sm">Inactive</p>
        </div>
      </div>

      {/* Bulk Action Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                {bulkAction === 'program' ? (
                  <Dumbbell className="w-5 h-5 text-yellow-400" />
                ) : (
                  <Apple className="w-5 h-5 text-green-400" />
                )}
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Bulk Assign {bulkAction === 'program' ? 'Program' : 'Nutrition'}
                  </h3>
                  <p className="text-sm text-zinc-500">
                    Assigning to {selectedUsers.size} user{selectedUsers.size !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowBulkModal(false)} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {bulkAction === 'program' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">Select Program</label>
                    <select
                      value={selectedProgram || ''}
                      onChange={(e) => setSelectedProgram(e.target.value || null)}
                      className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    >
                      <option value="">Choose a program...</option>
                      {programs.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.category})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">Duration (weeks)</label>
                    <input
                      type="number"
                      min="1"
                      max="52"
                      value={bulkDuration}
                      onChange={(e) => setBulkDuration(parseInt(e.target.value) || 4)}
                      className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Select Nutrition Plan</label>
                  <select
                    value={selectedNutrition || ''}
                    onChange={(e) => setSelectedNutrition(e.target.value || null)}
                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-green-400"
                  >
                    <option value="">Choose a plan...</option>
                    {nutritionPlans.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-zinc-800">
              <button
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkAssign}
                disabled={bulkAssigning || (bulkAction === 'program' ? !selectedProgram : !selectedNutrition)}
                className={`flex items-center gap-2 px-6 py-2 font-medium rounded-xl transition-colors ${
                  bulkAction === 'program'
                    ? 'bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-400/50 text-black'
                    : 'bg-green-500 hover:bg-green-600 disabled:bg-green-500/50 text-white'
                }`}
              >
                {bulkAssigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Assign to {selectedUsers.size} Users
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
