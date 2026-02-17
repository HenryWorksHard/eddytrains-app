'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/app/lib/supabase/client'
import { UserCheck, Plus, Users, Building2, CreditCard, MoreVertical, Mail, ChevronRight } from 'lucide-react'

interface Trainer {
  id: string
  email: string
  full_name: string | null
  role: string
  company_id: string | null
  organization_id: string | null
  created_at: string
  company_name?: string
  org_name?: string
  client_count?: number
  subscription_tier?: string
  subscription_status?: string
}

export default function TrainersPage() {
  const supabase = createClient()
  const router = useRouter()
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTrainer, setNewTrainer] = useState({ email: '', full_name: '', company_id: '', create_solo_org: true })
  const [creating, setCreating] = useState(false)
  const [filter, setFilter] = useState<'all' | 'solo' | 'company'>('all')

  useEffect(() => {
    fetchTrainers()
    fetchCompanies()
  }, [])

  async function fetchCompanies() {
    const { data } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('organization_type', 'company')
      .order('name')
    
    if (data) setCompanies(data)
  }

  async function fetchTrainers() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'trainer')
      .order('created_at', { ascending: false })

    if (data) {
      const trainersWithDetails = await Promise.all(
        data.map(async (trainer) => {
          let company_name = null
          let org_name = null
          let subscription_tier = null
          let subscription_status = null

          // Get company name if trainer is under a company
          if (trainer.company_id) {
            const { data: company } = await supabase
              .from('organizations')
              .select('name')
              .eq('id', trainer.company_id)
              .single()
            company_name = company?.name
          }

          // Get org details for solo trainers
          if (trainer.organization_id) {
            const { data: org } = await supabase
              .from('organizations')
              .select('name, subscription_tier, subscription_status, organization_type')
              .eq('id', trainer.organization_id)
              .single()
            org_name = org?.name
            if (org?.organization_type === 'solo') {
              subscription_tier = org?.subscription_tier
              subscription_status = org?.subscription_status
            }
          }

          // Get client count
          const { count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('trainer_id', trainer.id)
            .eq('role', 'client')

          return {
            ...trainer,
            company_name,
            org_name,
            subscription_tier,
            subscription_status,
            client_count: count || 0,
          }
        })
      )
      setTrainers(trainersWithDetails)
    }
    setLoading(false)
  }

  const filteredTrainers = trainers.filter((t) => {
    if (filter === 'solo') return !t.company_id
    if (filter === 'company') return !!t.company_id
    return true
  })

  async function createTrainer() {
    if (!newTrainer.email) return
    setCreating(true)

    // TODO: Implement trainer creation with invite flow
    // For now, just show the concept
    alert('Trainer invite flow to be implemented')
    
    setCreating(false)
    setShowCreateModal(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Trainers</h1>
          <p className="text-zinc-400 mt-1">All trainers on the platform</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-yellow-400 text-black px-4 py-2 rounded-xl font-medium hover:bg-yellow-300 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Trainer
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'solo', 'company'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-yellow-400 text-black'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            {f === 'all' ? 'All' : f === 'solo' ? 'Solo Trainers' : 'Company Trainers'}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-sm text-zinc-400">Total Trainers</p>
          <p className="text-2xl font-bold text-white">{trainers.length}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-sm text-zinc-400">Solo Trainers</p>
          <p className="text-2xl font-bold text-green-400">{trainers.filter(t => !t.company_id).length}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-sm text-zinc-400">Company Trainers</p>
          <p className="text-2xl font-bold text-blue-400">{trainers.filter(t => t.company_id).length}</p>
        </div>
      </div>

      {/* Trainers List */}
      {filteredTrainers.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
          <UserCheck className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No trainers found</h3>
          <p className="text-zinc-400">Add your first trainer to get started</p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-zinc-800/50">
              <tr>
                <th className="text-left text-xs font-medium text-zinc-400 uppercase tracking-wider px-6 py-4">Trainer</th>
                <th className="text-left text-xs font-medium text-zinc-400 uppercase tracking-wider px-6 py-4">Type</th>
                <th className="text-left text-xs font-medium text-zinc-400 uppercase tracking-wider px-6 py-4">Clients</th>
                <th className="text-left text-xs font-medium text-zinc-400 uppercase tracking-wider px-6 py-4">Status</th>
                <th className="text-right text-xs font-medium text-zinc-400 uppercase tracking-wider px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filteredTrainers.map((trainer) => (
                <tr 
                  key={trainer.id} 
                  onClick={() => router.push(`/platform/trainers/${trainer.id}`)}
                  className="hover:bg-zinc-800/30 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-white">{trainer.full_name || 'No name'}</p>
                      <p className="text-sm text-zinc-500">{trainer.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {trainer.company_id ? (
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-blue-400" />
                        <span className="text-blue-400">{trainer.company_name}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-green-400" />
                        <span className="text-green-400 capitalize">{trainer.subscription_tier || 'Solo'}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-zinc-400" />
                      <span className="text-white">{trainer.client_count}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {trainer.company_id ? (
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs">Company</span>
                    ) : (
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        trainer.subscription_status === 'active' 
                          ? 'bg-green-500/20 text-green-400'
                          : trainer.subscription_status === 'trialing'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {trainer.subscription_status || 'Unknown'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <ChevronRight className="w-5 h-5 text-zinc-500" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-6">Add Trainer</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Email</label>
                <input
                  type="email"
                  value={newTrainer.email}
                  onChange={(e) => setNewTrainer({ ...newTrainer, email: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:border-yellow-400 focus:outline-none"
                  placeholder="trainer@example.com"
                />
              </div>
              
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Full Name</label>
                <input
                  type="text"
                  value={newTrainer.full_name}
                  onChange={(e) => setNewTrainer({ ...newTrainer, full_name: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:border-yellow-400 focus:outline-none"
                  placeholder="John Smith"
                />
              </div>
              
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Assign to Company (optional)</label>
                <select
                  value={newTrainer.company_id}
                  onChange={(e) => setNewTrainer({ ...newTrainer, company_id: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:border-yellow-400 focus:outline-none"
                >
                  <option value="">Solo Trainer (uses Stripe billing)</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 bg-zinc-800 text-white px-4 py-3 rounded-xl font-medium hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createTrainer}
                disabled={creating || !newTrainer.email}
                className="flex-1 bg-yellow-400 text-black px-4 py-3 rounded-xl font-medium hover:bg-yellow-300 transition-colors disabled:opacity-50"
              >
                <Mail className="w-4 h-4 inline mr-2" />
                {creating ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
