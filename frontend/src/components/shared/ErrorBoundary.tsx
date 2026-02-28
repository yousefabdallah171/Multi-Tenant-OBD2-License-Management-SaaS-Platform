import { AlertTriangle, Home, RotateCcw } from 'lucide-react'
import type { ErrorInfo, ReactNode } from 'react'
import { Component } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface ErrorBoundaryCopy {
  title: string
  description: string
  tryAgain: string
  goToDashboard: string
  technicalDetails: string
}

interface ErrorBoundaryProps {
  children: ReactNode
  copy: ErrorBoundaryCopy
  dashboardHref: string
  resetKey?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Route error boundary caught an error.', error, errorInfo)
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null })
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    const { children, copy, dashboardHref } = this.props

    if (!this.state.hasError) {
      return children
    }

    return (
      <Card className="border-dashed shadow-none">
        <CardContent className="flex min-h-[26rem] flex-col items-center justify-center gap-5 p-8 text-center" role="alert">
          <div className="rounded-full bg-rose-100 p-4 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">{copy.title}</h2>
            <p className="max-w-xl text-sm text-slate-500 dark:text-slate-400">{copy.description}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button type="button" onClick={this.handleReset}>
              <RotateCcw className="me-2 h-4 w-4" />
              {copy.tryAgain}
            </Button>
            <Button type="button" variant="outline" onClick={() => window.location.assign(dashboardHref)}>
              <Home className="me-2 h-4 w-4" />
              {copy.goToDashboard}
            </Button>
          </div>
          {this.state.error?.message ? (
            <details className="max-w-2xl rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-start text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
              <summary className="cursor-pointer font-medium text-slate-950 dark:text-white">{copy.technicalDetails}</summary>
              <pre className="mt-3 whitespace-pre-wrap break-words text-xs">{this.state.error.message}</pre>
            </details>
          ) : null}
        </CardContent>
      </Card>
    )
  }
}

interface RouteErrorBoundaryProps {
  children: ReactNode
  dashboardHref: string
  resetKey?: string
}

export function RouteErrorBoundary({ children, dashboardHref, resetKey }: RouteErrorBoundaryProps) {
  const { t } = useTranslation()

  return (
    <ErrorBoundary
      dashboardHref={dashboardHref}
      resetKey={resetKey}
      copy={{
        title: t('common.errorBoundaryTitle'),
        description: t('common.errorBoundaryDescription'),
        tryAgain: t('common.tryAgain'),
        goToDashboard: t('common.goToDashboard'),
        technicalDetails: t('common.technicalDetails'),
      }}
    >
      {children}
    </ErrorBoundary>
  )
}
