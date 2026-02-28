import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { Sidebar } from '@/components/layout/Sidebar'
import { useSidebarStore } from '@/stores/sidebarStore'

export function DashboardLayout() {
  const setCollapsed = useSidebarStore((state) => state.setCollapsed)

  useEffect(() => {
    const syncSidebar = () => {
      setCollapsed(window.innerWidth < 1024)
    }

    syncSidebar()
    window.addEventListener('resize', syncSidebar)

    return () => window.removeEventListener('resize', syncSidebar)
  }, [setCollapsed])

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 dark:bg-slate-950 dark:text-white">
      <Navbar />
      <div className="flex min-h-[calc(100vh-4rem)]">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="flex-1 px-4 py-6 md:px-6">
            <Outlet />
          </main>
          <Footer />
        </div>
      </div>
    </div>
  )
}
