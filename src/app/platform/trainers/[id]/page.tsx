'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/app/lib/supabase/client'
import { 
  ArrowLeft, Users, Mail, Calendar, Building2, CreditCard, 
  Dumbbell, User, MoreVertical, Loader2 
} from 'lucide-react'

interface Trainer {
  id: string
  email: string
  full_name: string | null
  role: string
  company_id: string | null
  organization_id: string | null
  created_at: string
}

interface Client {
  id: string
  email: string
  full_name: string | null
  is_active: boolean
  created_at: string
  status: string | null
  activeProgram?: string | null
}

interface OrgInfo {
  name: string
  subscription_tier: string | null
  subscription_status: string | null
  organization_type: string
}

export default function TrainerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const trainerId = params.id as string
  const supabase = createClient()

  const [trainer, setTrainer] = useState<Trainer | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [orgInfo, setOrgInfo] = useState<OrgInfo | null>(null)
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (trainerId) {
      fetchTrainerData()
    }
  }, [trainerId])

  async function fetchTrainerData() {
    setLoading(true)
    try {
      // Fetch trainer profile
      const { data: trainerData, error: trainerError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', trainerId)
        .eq('role', 'trainer')
        .single()

      if (trainerError || !trainerData) {
        console.error('Trainer not found:', trainerError)
        router.push('/platform/trainers')
        return
      }

      // Get email from auth
      const response = await fetch(`/api/trainers/${trainerId}`)
      const authData = await response.json()
      
      setTrainer({
        ...trainerData,
        email: authData.email || 'Unknown'
      })

      // Fetch organization info
      if (trainerData.organization_id) {
        const { data: org } = await supabase
          .from('organizations')
          .select('name, subscription_tier, subscription_status, organization_type')
          .eq('id', trainerData.organization_id)
          .single()
        
        if (org) setOrgInfo(org)
      }

      // Fetch company name if applicable
      if (trainerData.company_id) {
        const { data: company } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', trainerData.company_id)
          .single()
        
        if (company) setCompanyName(company.name)
      }

      // Fetch trainer's clients
      const { data: clientsData } = await supabase
        .from('profiles')
        .select('id, full_name, is_active, created_at, status')
        .eq('trainer_id', trainerId)
        .eq('role', 'client')
        .order('created_at', { ascending: false })

      if (clientsData) {
        // Get emails for clients
        const clientsResponse = await fetch(`/api/admin/users?trainerFilter=${trainerId}`)
        const clientsWithEmail = await clientsResponse.json()
        
        // Get active programs for each client
        const clientsWithPrograms = await Promise.all(
          (clientsWithEmail.users || clientsData).map(async (client: Client) => {
            const { data: activeProgram } = await supabase
              .from('client_programs')
              .select('programs(name)')
              .eq('client_id', client.id)
              .eq('is_active', true)
              .limit(1)
              .single()
            
            const programData = activeProgram?.programs as unknown as { name: string } | null
            return {
              ...client,
              activeProgram: programData?.name || null
            }
          })
        )
        
        setClients(clientsWithPrograms)
      }
    } catch (error) {
      console.error('Error fetching trainer data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
      </div>
    )
  }

  if (!trainer) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-400">Trainer not found</p>
        <Link href="/platform/trainers" className="text-yellow-400 hover:underline mt-2 inline-block">
          Back to trainers
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-zinc-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">{trainer.full_name || 'Unnamed Trainer'}</h1>
          <p className="text-zinc-400">{trainer.email}</p>
        </div>
      </div>

      {/* Trainer Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Type */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-zinc-400 text-sm mb-2">
            {companyName ? <Building2 className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
            <span>Account Type</span>
          </div>
          <p className="text-white font-medium">
            {companyName ? (
              <span className="text-blue-400">{companyName}</span>
            ) : (
              <span className="text-green-400 capitalize">{orgInfo?.subscription_tier || 'Solo'} Trainer</span>
            )}
          </p>
        </div>

        {/* Status */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-zinc-400 text-sm mb-2">
            <CreditCard className="w-4 h-4" />
            <span>Status</span>
          </div>
          <span className={`px-2 py-1 rounded-full text-sm font-medium ${
            orgInfo?.subscription_status === 'active' 
              ? 'bg-green-500/20 text-green-400'
              : orgInfo?.subscription_status === 'trialing'
              ? 'bg-yellow-500/20 text-yellow-400'
              : 'bg-red-500/20 text-red-400'
          }`}>
            {orgInfo?.subscription_status || 'Unknown'}
          </span>
        </div>

        {/* Clients */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-zinc-400 text-sm mb-2">
            <Users className="w-4 h-4" />
            <span>Total Clients</span>
          </div>
          <p className="text-2xl font-bold text-white">{clients.length}</p>
        </div>
      </div>

      {/* Joined Date */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
          <Calendar className="w-4 h-4" />
          <span>Joined</span>
        </div>
        <p className="text-white">
          {new Date(trainer.created_at).toLocaleDateString('en-AU', { 
            day: 'numeric', month: 'long', year: 'numeric' 
          })}
        </p>
      </div>

      {/* Clients List */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-yellow-400" />
          Clients ({clients.length})
        </h2>

        {clients.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
            <User className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No clients yet</h3>
            <p className="text-zinc-400">This trainer hasn't added any clients</p>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-zinc-800/50">
                <tr>
                  <th className="text-left text-xs font-medium text-zinc-400 uppercase tracking-wider px-6 py-4">Client</th>
                  <th className="text-left text-xs font-medium text-zinc-400 uppercase tracking-wider px-6 py-4">Status</th>
                  <th className="text-left text-xs font-medium text-zinc-400 uppercase tracking-wider px-6 py-4">Active Program</th>
                  <th className="text-left text-xs font-medium text-zinc-400 uppercase tracking-wider px-6 py-4">Joined</th>
                  <th className="text-right text-xs font-medium text-zinc-400 uppercase tracking-wider px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {clients.map((client) => (
                  <tr key={client.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-white">{client.full_name || 'No name'}</p>
                        <p className="text-sm text-zinc-500">{client.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        client.is_active 
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {client.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {client.activeProgram ? (
                        <div className="flex items-center gap-2">
                          <Dumbbell className="w-4 h-4 text-yellow-400" />
                          <span className="text-white">{client.activeProgram}</span>
                        </div>
                      ) : (
                        <span className="text-zinc-500">No active program</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-zinc-400 text-sm">
                      {new Date(client.created_at).toLocaleDateString('en-AU', { 
                        day: 'numeric', month: 'short', year: 'numeric' 
                      })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/users/${client.id}`}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded-lg transition-colors"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
