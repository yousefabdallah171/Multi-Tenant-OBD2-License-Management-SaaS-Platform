import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { PageTransition } from '@/components/shared/PageTransition'

interface ErrorPageShellProps {
  code: string
  icon: LucideIcon
  title: string
  description: string
  actions: React.ReactNode
}

export function ErrorPageShell({ code, icon: Icon, title, description, actions }: ErrorPageShellProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.16),_transparent_28%),linear-gradient(180deg,_#f8fafc,_#e2e8f0)] px-4 py-10 dark:bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),_transparent_32%),linear-gradient(180deg,_#020617,_#0f172a)]">
      <PageTransition transitionKey={code} className="w-full max-w-2xl">
        <Card>
          <CardContent className="flex flex-col items-center gap-6 p-10 text-center">
            <div className="rounded-full bg-sky-100 p-4 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
              <Icon className="h-10 w-10" />
            </div>
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-600 dark:text-sky-400">{code}</p>
              <h1 className="text-3xl font-semibold text-slate-950 dark:text-white">{title}</h1>
              <p className="mx-auto max-w-xl text-sm text-slate-500 dark:text-slate-400">{description}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">{actions}</div>
          </CardContent>
        </Card>
      </PageTransition>
    </main>
  )
}
