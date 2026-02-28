import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Card, CardContent } from '@/components/ui/card'

interface PageLoaderProps {
  title?: string
  description?: string
}

export function PageLoader({ title, description }: PageLoaderProps) {
  return (
    <Card className="border-dashed shadow-none">
      <CardContent className="flex min-h-[18rem] flex-col items-center justify-center gap-3 p-8 text-center">
        <LoadingSpinner label={title} />
        {description ? <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}
      </CardContent>
    </Card>
  )
}
