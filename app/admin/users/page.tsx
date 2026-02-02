'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface User {
  id: string
  full_name: string | null
  email?: string
  role: string
  password_changed?: boolean
  created_at: string
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserName, setNewUserName] = useState('')
  const [creating, setCreating] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    message: string
    tempPassword?: string
  } | null>(null)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      if (data.users) {
        setUsers(data.users)
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setResult(null)

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newUserEmail,
          full_name: newUserName
        })
      })

      const data = await res.json()

      if (!res.ok) {
        setResult({ success: false, message: data.error || 'Failed to create user' })
        return
      }

      setResult({
        success: true,
        message: data.emailSent 
          ? '✅ User created and welcome email sent!' 
          : '⚠️ User created but email failed. Share the password manually:',
        tempPassword: data.emailSent ? undefined : data.tempPassword
      })

      // Refresh user list
      fetchUsers()

      // Clear form if successful
      if (data.emailSent) {
        setTimeout(() => {
          setShowAddModal(false)
          setNewUserEmail('')
          setNewUserName('')
          setResult(null)
        }, 2000)
      }
    } catch {
      setResult({ success: false, message: 'Failed to create user' })
    } finally {
      setCreating(false)
    }
  }

  const closeModal = () => {
    setShowAddModal(false)
    setNewUserEmail('')
    setNewUserName('')
    setResult(null)
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header - Industrial Minimal */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-zinc-500 hover:text-yellow-400 transition-colors">← Admin</Link>
            <h1 className="text-xl font-bold text-white tracking-widest" style={{ fontFamily: 'Sora, sans-serif' }}>USERS</h1>
            <div className="w-8 h-1 bg-yellow-400"></div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-black text-sm font-bold uppercase tracking-wider rounded-lg transition-colors"
          >
            + Add User
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="p-6 space-y-3">
        {loading ? (
          <div className="text-center py-8 text-zinc-500">Loading...</div>
        ) : users.length === 0 ? (
          <div className="text-center py-8 text-zinc-500">No users yet</div>
        ) : (
          users.map((user) => (
            <div
              key={user.id}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-4"
            >
              <div className="text-2xl">
                {user.role === 'admin' ? '👑' : '👤'}
              </div>
              <div className="flex-1">
                <h3 className="text-white font-medium flex items-center gap-2">
                  {user.full_name || 'No name'}
                  {user.role === 'admin' && (
                    <span className="text-xs bg-yellow-400/20 text-yellow-400 px-2 py-0.5 rounded">
                      Admin
                    </span>
                  )}
                  {user.password_changed === false && (
                    <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                      Pending
                    </span>
                  )}
                </h3>
                <p className="text-zinc-500 text-sm">{user.email || user.id}</p>
              </div>
            </div>
          ))
        )}
      </main>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white tracking-widest mb-4" style={{ fontFamily: 'Sora, sans-serif' }}>ADD NEW USER</h2>
            <div className="w-12 h-1 bg-yellow-400 mb-6"></div>
            
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-zinc-500 text-sm mb-1">Email *</label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="client@example.com"
                  required
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-yellow-400 transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-zinc-500 text-sm mb-1">Full Name</label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="John Smith"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-yellow-400 transition-colors"
                />
              </div>

              {result && (
                <div className={`p-4 rounded-xl ${
                  result.success 
                    ? 'bg-green-500/10 border border-green-500/20' 
                    : 'bg-red-500/10 border border-red-500/20'
                }`}>
                  <p className={result.success ? 'text-green-400' : 'text-red-400'}>
                    {result.message}
                  </p>
                  {result.tempPassword && (
                    <div className="mt-3 p-3 bg-zinc-800 rounded-lg">
                      <p className="text-zinc-500 text-xs mb-1">Temporary Password:</p>
                      <p className="text-yellow-400 font-mono text-lg select-all">
                        {result.tempPassword}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-white font-medium transition-colors"
                >
                  {result?.success ? 'Done' : 'Cancel'}
                </button>
                {!result?.success && (
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 py-3 bg-yellow-400 hover:bg-yellow-300 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-bold uppercase tracking-wider rounded-xl transition-colors"
                  >
                    {creating ? 'Creating...' : 'Create'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
