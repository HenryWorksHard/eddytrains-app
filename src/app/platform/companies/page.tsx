'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/app/lib/supabase/client'
import { Building2, Plus, Users, DollarSign, MoreVertical, Edit, Trash2 } from 'lucide-react'

interface Company {
  id: string
  name: string
  slug: string
  custom_monthly_price: number | null
  max_trainers: number
  created_at: string
  trainer_count?: number
  client_count?: number
}

export default function CompaniesPage() {
  const supabase = createClient()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newCompany, setNewCompany] = useState({ name: '', slug: '', custom_monthly_price: '', max_trainers: '5' })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchCompanies()
  }, [])

  async function fetchCompanies() {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('organization_type', 'company')
      .order('created_at', { ascending: false })

    if (data) {
      // Get trainer and client counts for each company
      const companiesWithCounts = await Promise.all(
        data.map(async (company) => {
          const { count: trainerCount } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', company.id)
            .eq('role', 'trainer')

          const { count: clientCount } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', company.id)
            .eq('role', 'client')

          return {
            ...company,
            trainer_count: trainerCount || 0,
            client_count: clientCount || 0,
          }
        })
      )
      setCompanies(companiesWithCounts)
    }
    setLoading(false)
  }

  async function createCompany() {
    if (!newCompany.name || !newCompany.slug) return
    setCreating(true)

    const { error } = await supabase.from('organizations').insert({
      name: newCompany.name,
      slug: newCompany.slug.toLowerCase().replace(/\s+/g, '-'),
      organization_type: 'company',
      custom_monthly_price: newCompany.custom_monthly_price ? parseInt(newCompany.custom_monthly_price) : null,
      max_trainers: parseInt(newCompany.max_trainers) || 5,
      subscription_status: 'active', // Companies are always active (custom billing)
    })

    if (!error) {
      setShowCreateModal(false)
      setNewCompany({ name: '', slug: '', custom_monthly_price: '', max_trainers: '5' })
      fetchCompanies()
    }
    setCreating(false)
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
          <h1 className="text-2xl font-bold text-white">Companies</h1>
          <p className="text-zinc-400 mt-1">Gyms and studios with custom pricing</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-yellow-400 text-black px-4 py-2 rounded-xl font-medium hover:bg-yellow-300 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Company
        </button>
      </div>

      {/* Companies Grid */}
      {companies.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
          <Building2 className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No companies yet</h3>
          <p className="text-zinc-400 mb-6">Add your first gym or studio</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-yellow-400 text-black px-6 py-2 rounded-xl font-medium hover:bg-yellow-300 transition-colors"
          >
            Add Company
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((company) => (
            <div
              key={company.id}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <button className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
                  <MoreVertical className="w-4 h-4 text-zinc-400" />
                </button>
              </div>
              
              <h3 className="text-lg font-semibold text-white mb-1">{company.name}</h3>
              <p className="text-sm text-zinc-500 mb-4">/{company.slug}</p>
              
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-zinc-800">
                <div>
                  <p className="text-xs text-zinc-500">Trainers</p>
                  <p className="text-lg font-semibold text-white">{company.trainer_count}/{company.max_trainers}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Clients</p>
                  <p className="text-lg font-semibold text-white">{company.client_count}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Price</p>
                  <p className="text-lg font-semibold text-green-400">
                    {company.custom_monthly_price ? `$${company.custom_monthly_price}` : '-'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-6">Add Company</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Company Name</label>
                <input
                  type="text"
                  value={newCompany.name}
                  onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:border-yellow-400 focus:outline-none"
                  placeholder="Adelaide Fitness"
                />
              </div>
              
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Slug (URL)</label>
                <input
                  type="text"
                  value={newCompany.slug}
                  onChange={(e) => setNewCompany({ ...newCompany, slug: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:border-yellow-400 focus:outline-none"
                  placeholder="adelaide-fitness"
                />
              </div>
              
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Monthly Price ($)</label>
                <input
                  type="number"
                  value={newCompany.custom_monthly_price}
                  onChange={(e) => setNewCompany({ ...newCompany, custom_monthly_price: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:border-yellow-400 focus:outline-none"
                  placeholder="500"
                />
              </div>
              
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Max Trainers</label>
                <input
                  type="number"
                  value={newCompany.max_trainers}
                  onChange={(e) => setNewCompany({ ...newCompany, max_trainers: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:border-yellow-400 focus:outline-none"
                  placeholder="5"
                />
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
                onClick={createCompany}
                disabled={creating || !newCompany.name || !newCompany.slug}
                className="flex-1 bg-yellow-400 text-black px-4 py-3 rounded-xl font-medium hover:bg-yellow-300 transition-colors disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
