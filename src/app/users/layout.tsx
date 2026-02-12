import Sidebar from '@/components/Sidebar'

export default function UsersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-zinc-950">
      <Sidebar />
      <main className="ml-64 p-8">
        {children}
      </main>
    </div>
  )
}
