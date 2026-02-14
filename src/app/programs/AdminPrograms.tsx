import { createClient } from '@/app/lib/supabase/server'
import { getEffectiveOrgId } from '@/app/lib/org-context'
import Link from 'next/link'
import { Plus, Dumbbell, ChevronRight } from 'lucide-react'
import ProgramCard from '@/components/ProgramCard'
import Sidebar from '@/components/Sidebar'

interface Program {
  id: string
  name: string
  description: string | null
  category: string
  duration_weeks: number | null
  difficulty: string
  is_active: boolean
  created_at: string
}

const categories = [
  { id: 'strength', label: 'Strength Training', icon: 'S', color: 'yellow' },
  { id: 'cardio', label: 'Cardio', icon: 'C', color: 'red' },
  { id: 'hyrox', label: 'Hyrox', icon: 'H', color: 'orange' },
  { id: 'hybrid', label: 'Hybrid', icon: 'HY', color: 'purple' },
]

async function getPrograms(): Promise<Program[]> {
  const supabase = await createClient()
  
  const orgId = await getEffectiveOrgId()
  if (!orgId) return []
  
  const { data } = await supabase
    .from('programs')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
  
  return (data as Program[]) || []
}

function groupByCategory(programs: Program[]) {
  const grouped: Record<string, Program[]> = {}
  
  categories.forEach(cat => {
    grouped[cat.id] = []
  })
  grouped['other'] = []
  
  programs.forEach(program => {
    const cat = program.category?.toLowerCase() || 'other'
    if (grouped[cat]) {
      grouped[cat].push(program)
    } else {
      grouped['other'].push(program)
    }
  })
  
  return grouped
}

export default async function AdminPrograms() {
  const programs = await getPrograms()
  const groupedPrograms = groupByCategory(programs)

  const getCategoryColor = (catId: string) => {
    switch (catId) {
      case 'strength': return 'bg-yellow-400/10 border-yellow-400/30 text-yellow-400'
      case 'cardio': return 'bg-red-400/10 border-red-400/30 text-red-400'
      case 'hyrox': return 'bg-orange-400/10 border-orange-400/30 text-orange-400'
      case 'hybrid': return 'bg-purple-400/10 border-purple-400/30 text-purple-400'
      default: return 'bg-zinc-400/10 border-zinc-400/30 text-zinc-400'
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <Sidebar />
      <main className="lg:ml-64 p-4 lg:p-8 pt-20 lg:pt-8">
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Programs</h1>
              <p className="text-zinc-400 mt-1">Manage your fitness programs by category</p>
            </div>
            <Link
              href="/programs/new"
              className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-black px-4 py-2 rounded-xl font-medium transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create Program
            </Link>
          </div>

          {/* Programs by Category */}
          {programs.length > 0 ? (
            <div className="space-y-8">
              {categories.map((category) => {
                const categoryPrograms = groupedPrograms[category.id]
                
                return (
                  <div key={category.id} className="space-y-4">
                    {/* Category Header */}
                    <div className={`flex items-center gap-3 p-4 rounded-xl border ${getCategoryColor(category.id)}`}>
                      <span className="text-2xl">{category.icon}</span>
                      <div className="flex-1">
                        <h2 className="text-lg font-semibold">{category.label}</h2>
                        <p className="text-sm opacity-70">
                          {categoryPrograms.length} program{categoryPrograms.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 opacity-50" />
                    </div>

                    {/* Category Programs */}
                    {categoryPrograms.length > 0 ? (
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 pl-4">
                        {categoryPrograms.map((program) => (
                          <ProgramCard key={program.id} program={program} />
                        ))}
                      </div>
                    ) : (
                      <div className="pl-4">
                        <div className="p-6 bg-zinc-900/50 border border-zinc-800 border-dashed rounded-xl text-center">
                          <p className="text-zinc-500 text-sm">No {category.label.toLowerCase()} programs yet</p>
                          <Link
                            href="/programs/new"
                            className="inline-flex items-center gap-1 text-yellow-400 text-sm mt-2 hover:underline"
                          >
                            <Plus className="w-4 h-4" />
                            Create one
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Other/Uncategorized */}
              {groupedPrograms['other'].length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 rounded-xl border bg-zinc-400/10 border-zinc-400/30 text-zinc-400">
                    <span className="text-2xl">📁</span>
                    <div className="flex-1">
                      <h2 className="text-lg font-semibold">Other</h2>
                      <p className="text-sm opacity-70">
                        {groupedPrograms['other'].length} program{groupedPrograms['other'].length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 pl-4">
                    {groupedPrograms['other'].map((program) => (
                      <ProgramCard key={program.id} program={program} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="card p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                <Dumbbell className="w-8 h-8 text-zinc-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No programs yet</h3>
              <p className="text-zinc-400 mb-6">Create your first fitness program to get started</p>
              <Link
                href="/programs/new"
                className="inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-black px-6 py-3 rounded-xl font-medium transition-colors"
              >
                <Plus className="w-5 h-5" />
                Create Your First Program
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
