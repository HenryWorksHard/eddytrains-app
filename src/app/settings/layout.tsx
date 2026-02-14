import Sidebar from '@/components/Sidebar'

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-zinc-950">
      <Sidebar />
      <main className="lg:ml-64 p-4 lg:p-8 pt-20 lg:pt-8">
        {children}
      </main>
    </div>
  )
}
