'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/app/lib/supabase/client'
import { Users, Search, UserCheck, ChevronRight } from 'lucide-react'
import Link from 'next/link'

interface Client {
  id: string
  email: string
  full_name: string | null
  status: string
  created_at: string
  trainer_id: string | null
  trainer_name: string | null
  trainer_email: string | null
}

export default function CompanyClientsPage() {
  const supabase = createClient()
  const [clients, setClients] = useState<Client[]>([])
  const [trainers, setTrainers] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterTrainer, setFilterTrainer] = useState<string>('all')

  useEffect(() => {
    fetchClientsAndTrainers()
  }, [])

  async function fetchClientsAndTrainers() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Get user's company
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!profile?.company_id) {
      setLoading(false)
      return
    }

    // Get all trainers in this company
    const { data: trainersData } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('company_id', profile.company_id)
      .eq('role', 'trainer')

    if (trainersData) {
      setTrainers(trainersData.map(t => ({
        id: t.id,
        name: t.full_name || t.email
      })))

      // Get ALL clients in this company (visible to all trainers)
      const { data: clientsData } = await supabase
        .from('profiles')
        .select('id, email, full_name, status, created_at, trainer_id')
        .eq('company_id', profile.company_id)
        .eq('role', 'client')
        .order('created_at', { ascending: false })

      if (clientsData) {
        const clientsWithTrainers = clientsData.map(client => {
          const trainer = trainersData.find(t => t.id === client.trainer_id)
          return {
            ...client,
            trainer_name: trainer?.full_name || null,
            trainer_email: trainer?.email || null,
          }
        })
        setClients(clientsWithTrainers)
      }
    }

    setLoading(false)
  }

  const filteredClients = clients.filter((client) => {
    const matchesSearch = !search || 
      client.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      client.email.toLowerCase().includes(search.toLowerCase())
    
    const matchesTrainer = filterTrainer === 'all' || client.trainer_id === filterTrainer

    return matchesSearch && matchesTrainer
  })

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
      <div>
        <h1 className="text-2xl font-bold text-white">All Clients</h1>
        <p className="text-zinc-400 mt-1">View all clients across your trainers</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-sm text-zinc-400">Total Clients</p>
          <p className="text-2xl font-bold text-white">{clients.length}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-sm text-zinc-400">Active</p>
          <p className="text-2xl font-bold text-green-400">
            {clients.filter(c => c.status === 'active').length}
          </p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-sm text-zinc-400">Trainers</p>
          <p className="text-2xl font-bold text-blue-400">{trainers.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-zinc-500 focus:border-yellow-400 focus:outline-none"
          />
        </div>
        <select
          value={filterTrainer}
          onChange={(e) => setFilterTrainer(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-yellow-400 focus:outline-none min-w-[200px]"
        >
          <option value="all">All Trainers</option>
          {trainers.map((trainer) => (
            <option key={trainer.id} value={trainer.id}>{trainer.name}</option>
          ))}
        </select>
      </div>

      {/* Clients List */}
      {filteredClients.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
          <Users className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No clients found</h3>
          <p className="text-zinc-400">Clients will appear here when trainers add them</p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-zinc-800/50">
              <tr>
                <th className="text-left text-xs font-medium text-zinc-400 uppercase tracking-wider px-6 py-4">Client</th>
                <th className="text-left text-xs font-medium text-zinc-400 uppercase tracking-wider px-6 py-4">Trainer</th>
                <th className="text-left text-xs font-medium text-zinc-400 uppercase tracking-wider px-6 py-4">Status</th>
                <th className="text-left text-xs font-medium text-zinc-400 uppercase tracking-wider px-6 py-4">Joined</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filteredClients.map((client) => (
                <tr key={client.id} className="hover:bg-zinc-800/30 transition-colors cursor-pointer group">
                  <td className="px-6 py-4">
                    <Link href={`/users/${client.id}`} className="block">
                      <p className="font-medium text-white group-hover:text-yellow-400 transition-colors">{client.full_name || 'No name'}</p>
                      <p className="text-sm text-zinc-500">{client.email}</p>
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-blue-400" />
                      <span className="text-zinc-300">{client.trainer_name || client.trainer_email || 'Unassigned'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      client.status === 'active' 
                        ? 'bg-green-500/20 text-green-400'
                        : client.status === 'pending'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-zinc-500/20 text-zinc-400'
                    }`}>
                      {client.status || 'unknown'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-zinc-400">
                    {new Date(client.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <Link href={`/users/${client.id}`}>
                      <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-yellow-400 transition-colors" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
