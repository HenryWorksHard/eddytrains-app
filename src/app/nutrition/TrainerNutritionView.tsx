'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/app/lib/supabase/client'
import { Search, Users, User, Calculator, Plus, Edit2 } from 'lucide-react'
import Link from 'next/link'

interface Client {
  id: string
  full_name: string | null
  email: string
}

interface NutritionPlan {
  id: string
  custom_calories: number | null
  custom_protein: number | null
  custom_carbs: number | null
  custom_fats: number | null
  notes: string | null
  nutrition_plans: {
    name: string
    calories: number
    protein: number
    carbs: number
    fats: number
  } | null
}

export default function TrainerNutritionView({ clients }: { clients: Client[] }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [clientNutrition, setClientNutrition] = useState<NutritionPlan | null>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const filteredClients = clients.filter(client => {
    const query = searchQuery.toLowerCase()
    return (
      client.full_name?.toLowerCase().includes(query) ||
      client.email.toLowerCase().includes(query)
    )
  })

  useEffect(() => {
    if (selectedClient) {
      loadClientNutrition(selectedClient.id)
    }
  }, [selectedClient])

  const loadClientNutrition = async (clientId: string) => {
    setLoading(true)
    const { data } = await supabase
      .from('client_nutrition')
      .select(`*, nutrition_plans (name, calories, protein, carbs, fats)`)
      .eq('client_id', clientId)
      .eq('is_active', true)
      .single()
    
    setClientNutrition(data)
    setLoading(false)
  }

  const getNutritionValues = () => {
    if (!clientNutrition) return null
    return {
      calories: clientNutrition.custom_calories || clientNutrition.nutrition_plans?.calories || 0,
      protein: clientNutrition.custom_protein || clientNutrition.nutrition_plans?.protein || 0,
      carbs: clientNutrition.custom_carbs || clientNutrition.nutrition_plans?.carbs || 0,
      fats: clientNutrition.custom_fats || clientNutrition.nutrition_plans?.fats || 0,
      planName: clientNutrition.nutrition_plans?.name || 'Custom Plan',
      notes: clientNutrition.notes
    }
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Client Search/Select */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl lg:rounded-2xl p-4 lg:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-yellow-400" />
          <h2 className="text-base lg:text-lg font-semibold text-white">Select Client</h2>
        </div>
        
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
          />
        </div>

        {/* Client List */}
        {clients.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400 text-sm">No clients yet</p>
            <Link href="/users/new" className="text-yellow-400 text-sm hover:underline mt-2 inline-block">
              Add your first client
            </Link>
          </div>
        ) : (
          <div className="max-h-48 lg:max-h-64 overflow-y-auto space-y-2">
            {filteredClients.map((client) => (
              <button
                key={client.id}
                onClick={() => setSelectedClient(client)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
                  selectedClient?.id === client.id
                    ? 'bg-yellow-400/10 border border-yellow-400/30'
                    : 'bg-zinc-800/50 hover:bg-zinc-800 border border-transparent'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">
                  <User className="w-4 h-4 text-zinc-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {client.full_name || 'Unnamed'}
                  </p>
                  <p className="text-xs text-zinc-500 truncate">{client.email}</p>
                </div>
                {selectedClient?.id === client.id && (
                  <div className="w-2 h-2 rounded-full bg-yellow-400" />
                )}
              </button>
            ))}
            {filteredClients.length === 0 && searchQuery && (
              <p className="text-zinc-500 text-sm text-center py-4">No clients match "{searchQuery}"</p>
            )}
          </div>
        )}
      </div>

      {/* Selected Client's Nutrition */}
      {selectedClient && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl lg:rounded-2xl p-4 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base lg:text-lg font-semibold text-white">
                {selectedClient.full_name || 'Client'}'s Nutrition
              </h2>
              <p className="text-zinc-500 text-xs lg:text-sm">{selectedClient.email}</p>
            </div>
            <Link
              href={`/users/${selectedClient.id}?tab=nutrition`}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-black text-sm font-medium rounded-lg transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Edit</span>
            </Link>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-zinc-700 border-t-yellow-400 rounded-full animate-spin" />
            </div>
          ) : clientNutrition ? (
            <div className="space-y-4">
              {/* Plan name */}
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                  {getNutritionValues()?.planName}
                </span>
              </div>

              {/* Calories */}
              <div className="bg-zinc-800/50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 text-sm">Daily Calories</span>
                  <span className="text-xl lg:text-2xl font-bold text-white">
                    {getNutritionValues()?.calories}
                  </span>
                </div>
              </div>

              {/* Macros */}
              <div className="grid grid-cols-3 gap-2 lg:gap-3">
                <div className="bg-blue-500/10 rounded-xl p-3 text-center">
                  <div className="text-base lg:text-lg font-bold text-white">
                    {getNutritionValues()?.protein}g
                  </div>
                  <p className="text-blue-400 text-xs">Protein</p>
                </div>
                <div className="bg-yellow-500/10 rounded-xl p-3 text-center">
                  <div className="text-base lg:text-lg font-bold text-white">
                    {getNutritionValues()?.carbs}g
                  </div>
                  <p className="text-yellow-400 text-xs">Carbs</p>
                </div>
                <div className="bg-red-500/10 rounded-xl p-3 text-center">
                  <div className="text-base lg:text-lg font-bold text-white">
                    {getNutritionValues()?.fats}g
                  </div>
                  <p className="text-red-400 text-xs">Fats</p>
                </div>
              </div>

              {/* Notes */}
              {getNutritionValues()?.notes && (
                <div className="pt-4 border-t border-zinc-800">
                  <p className="text-sm text-zinc-400 mb-2">Notes</p>
                  <p className="text-zinc-300 text-sm whitespace-pre-wrap">
                    {getNutritionValues()?.notes}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calculator className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400 text-sm mb-4">No nutrition plan assigned</p>
              <Link
                href={`/users/${selectedClient.id}?tab=nutrition`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black text-sm font-medium rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Assign Plan
              </Link>
            </div>
          )}
        </div>
      )}

      {/* No client selected prompt */}
      {!selectedClient && clients.length > 0 && (
        <div className="bg-zinc-900/50 border border-dashed border-zinc-800 rounded-xl lg:rounded-2xl p-8 text-center">
          <User className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400">Select a client above to view their nutrition plan</p>
        </div>
      )}
    </div>
  )
}
