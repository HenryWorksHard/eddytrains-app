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
          {/* Link to admin portal for user management */}
          <a
            href="https://eddytrains-admin.vercel.app/users/new"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-black text-sm font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-2"
          >
            + Add User
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </header>

      {/* Info Banner */}
      <div className="mx-6 mt-6 p-4 bg-zinc-800/50 border border-zinc-700 rounded-xl">
        <p className="text-zinc-400 text-sm">
          💡 To add or manage users with full features (permissions, programs, schedules), use the{' '}
          <a 
            href="https://eddytrains-admin.vercel.app/users" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-yellow-400 hover:underline"
          >
            Admin Portal
          </a>
        </p>
      </div>

      {/* Main */}
      <main className="p-6 space-y-3">
        {loading ? (
          <div className="text-center py-8 text-zinc-500">Loading...</div>
        ) : users.length === 0 ? (
          <div className="text-center py-8 text-zinc-500">No users yet</div>
        ) : (
          users.map((user) => (
            <a
              key={user.id}
              href={`https://eddytrains-admin.vercel.app/users/${user.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 flex items-center gap-4 transition-colors block"
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
              <span className="text-zinc-600">→</span>
            </a>
          ))
        )}
      </main>
    </div>
  )
}
