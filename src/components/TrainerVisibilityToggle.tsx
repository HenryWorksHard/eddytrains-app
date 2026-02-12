'use client'

import { useState } from 'react'
import { Users, UserCheck, Loader2 } from 'lucide-react'
import { createClient } from '@/app/lib/supabase/client'

interface Props {
  organizationId: string
  currentVisibility: 'team' | 'assigned'
}

export default function TrainerVisibilityToggle({ organizationId, currentVisibility }: Props) {
  const [visibility, setVisibility] = useState<'team' | 'assigned'>(currentVisibility)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const handleToggle = async () => {
    const newVisibility = visibility === 'team' ? 'assigned' : 'team'
    setSaving(true)
    
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ trainer_visibility: newVisibility })
        .eq('id', organizationId)
      
      if (error) throw error
      setVisibility(newVisibility)
    } catch (err) {
      console.error('Failed to update visibility:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between py-3">
        <div className="flex items-center gap-3">
          {visibility === 'team' ? (
            <Users className="w-5 h-5 text-yellow-400" />
          ) : (
            <UserCheck className="w-5 h-5 text-blue-400" />
          )}
          <div>
            <p className="text-white font-medium">Client Visibility</p>
            <p className="text-sm text-zinc-500">
              {visibility === 'team' 
                ? 'All trainers can see all clients in the company'
                : 'Trainers can only see clients assigned to them'
              }
            </p>
          </div>
        </div>
        
        <button
          onClick={handleToggle}
          disabled={saving}
          className={`relative w-14 h-8 rounded-full transition-colors ${
            visibility === 'team' ? 'bg-yellow-400' : 'bg-blue-500'
          } ${saving ? 'opacity-50' : ''}`}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-black" />
          ) : (
            <div 
              className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${
                visibility === 'team' ? 'right-1' : 'left-1'
              }`} 
            />
          )}
        </button>
      </div>
      
      {/* Visual indicator of current mode */}
      <div className={`p-4 rounded-xl border ${
        visibility === 'team' 
          ? 'bg-yellow-400/5 border-yellow-400/20' 
          : 'bg-blue-500/5 border-blue-500/20'
      }`}>
        <div className="flex items-center gap-2 text-sm">
          {visibility === 'team' ? (
            <>
              <Users className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-400 font-medium">Team Mode</span>
              <span className="text-zinc-400">— Trainers share access to all company clients</span>
            </>
          ) : (
            <>
              <UserCheck className="w-4 h-4 text-blue-400" />
              <span className="text-blue-400 font-medium">Assigned Mode</span>
              <span className="text-zinc-400">— Trainers only see their own assigned clients</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
