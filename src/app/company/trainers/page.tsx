'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/app/lib/supabase/client'
import { UserCheck, Plus, Users, MoreVertical, Trash2, X } from 'lucide-react'

interface Trainer {
  id: string
  email: string
  full_name: string | null
  created_at: string
  client_count?: number
}

export default function CompanyTrainersPage() {
  const supabase = createClient()
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [maxTrainers, setMaxTrainers] = useState(5)
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newTrainer, setNewTrainer] = useState({
    email: '',
    password: '',
    fullName: '',
  })
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetchCompanyAndTrainers()
  }, [])

  async function fetchCompanyAndTrainers() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Get user's company
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id, organization_id')
      .eq('id', user.id)
      .single()

    const compId = profile?.company_id || profile?.organization_id
    if (!compId) {
      setLoading(false)
      return
    }

    setCompanyId(compId)

    // Get company details
    const { data: company } = await supabase
      .from('organizations')
      .select('max_trainers')
      .eq('id', compId)
      .single()

    if (company) setMaxTrainers(company.max_trainers || 5)

    // Get trainers in this company
    const { data: trainersData } = await supabase
      .from('profiles')
      .select('id, email, full_name, created_at')
      .eq('company_id', compId)
      .eq('role', 'trainer')
      .order('created_at', { ascending: false })

    if (trainersData) {
      const trainersWithClients = await Promise.all(
        trainersData.map(async (trainer) => {
          const { count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('trainer_id', trainer.id)
            .eq('role', 'client')

          return { ...trainer, client_count: count || 0 }
        })
      )
      setTrainers(trainersWithClients)
    }

    setLoading(false)
  }

  async function addTrainer() {
    if (!newTrainer.email || !newTrainer.password) return
    
    if (trainers.length >= maxTrainers) {
      alert(`You've reached your trainer limit (${maxTrainers}). Contact support to upgrade.`)
      return
    }

    setAdding(true)

    try {
      const response = await fetch('/api/company/trainers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTrainer),
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || 'Failed to add trainer')
        return
      }

      setShowAddModal(false)
      setNewTrainer({ email: '', password: '', fullName: '' })
      fetchCompanyAndTrainers()
      alert(`Trainer created! They can login with:\nEmail: ${newTrainer.email}\nPassword: ${newTrainer.password}`)
    } catch (error) {
      console.error('Error adding trainer:', error)
      alert('Failed to add trainer')
    } finally {
      setAdding(false)
    }
  }

  async function removeTrainer(trainerId: string) {
    const trainer = trainers.find(t => t.id === trainerId)
    if (!trainer) return

    const confirmText = `Remove ${trainer.full_name || trainer.email}?\n\nThis will delete their account and reassign their ${trainer.client_count || 0} clients.`
    if (!confirm(confirmText)) return

    setDeletingId(trainerId)

    try {
      const response = await fetch(`/api/company/trainers?id=${trainerId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        alert(data.error || 'Failed to remove trainer')
        return
      }

      fetchCompanyAndTrainers()
    } catch (error) {
      console.error('Error removing trainer:', error)
      alert('Failed to remove trainer')
    } finally {
      setDeletingId(null)
    }
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
          <h1 className="text-2xl font-bold text-white">Your Trainers</h1>
          <p className="text-zinc-400 mt-1">
            {trainers.length} of {maxTrainers} trainers
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          disabled={trainers.length >= maxTrainers}
          className="flex items-center gap-2 bg-yellow-400 text-black px-4 py-2 rounded-xl font-medium hover:bg-yellow-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          Add Trainer
        </button>
      </div>

      {/* Trainers List */}
      {trainers.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
          <UserCheck className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No trainers yet</h3>
          <p className="text-zinc-400 mb-6">Add trainers to your company</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-yellow-400 text-black px-6 py-2 rounded-xl font-medium hover:bg-yellow-300 transition-colors"
          >
            Add Trainer
          </button>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-zinc-800/50">
              <tr>
                <th className="text-left text-xs font-medium text-zinc-400 uppercase tracking-wider px-6 py-4">Trainer</th>
                <th className="text-left text-xs font-medium text-zinc-400 uppercase tracking-wider px-6 py-4">Clients</th>
                <th className="text-left text-xs font-medium text-zinc-400 uppercase tracking-wider px-6 py-4">Joined</th>
                <th className="text-right text-xs font-medium text-zinc-400 uppercase tracking-wider px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {trainers.map((trainer) => (
                <tr key={trainer.id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-white">{trainer.full_name || 'No name'}</p>
                      <p className="text-sm text-zinc-500">{trainer.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-zinc-400" />
                      <span className="text-white">{trainer.client_count}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-zinc-400">
                    {new Date(trainer.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => removeTrainer(trainer.id)}
                      disabled={deletingId === trainer.id}
                      className="p-2 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors disabled:opacity-50"
                    >
                      {deletingId === trainer.id ? (
                        <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Trainer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Add Trainer</h2>
              <button onClick={() => setShowAddModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Full Name</label>
                <input
                  type="text"
                  value={newTrainer.fullName}
                  onChange={(e) => setNewTrainer({ ...newTrainer, fullName: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:border-yellow-400 focus:outline-none"
                  placeholder="John Smith"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Email Address</label>
                <input
                  type="email"
                  value={newTrainer.email}
                  onChange={(e) => setNewTrainer({ ...newTrainer, email: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:border-yellow-400 focus:outline-none"
                  placeholder="trainer@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Password</label>
                <input
                  type="password"
                  value={newTrainer.password}
                  onChange={(e) => setNewTrainer({ ...newTrainer, password: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:border-yellow-400 focus:outline-none"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
                <p className="text-xs text-zinc-500 mt-1">Min 6 characters. Share this with the trainer.</p>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 bg-zinc-800 text-white px-4 py-3 rounded-xl font-medium hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addTrainer}
                disabled={adding || !newTrainer.email || !newTrainer.password}
                className="flex-1 bg-yellow-400 text-black px-4 py-3 rounded-xl font-medium hover:bg-yellow-300 transition-colors disabled:opacity-50"
              >
                {adding ? 'Creating...' : 'Create Trainer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
