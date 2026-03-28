import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'dashboard-text-body inline-flex items-center justify-center rounded-xl text-sm font-semibold shadow-sm transition-[transform,box-shadow,background-color,border-color,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 dark:focus-visible:ring-offset-slate-950',
  {
    variants: {
      variant: {
        default: 'bg-brand-600 text-white hover:bg-brand-500 hover:shadow-lg hover:shadow-brand-900/10',
        secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
        outline: 'border border-slate-300 bg-white text-slate-900 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-900',
        ghost: 'bg-transparent text-slate-700 shadow-none hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800',
        destructive: 'bg-rose-600 text-white hover:bg-rose-500 hover:shadow-lg hover:shadow-rose-900/15',
      },
      size: {
        default: 'h-11 px-4 py-2',
        sm: 'h-9 px-3',
        lg: 'h-12 px-6',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
))

Button.displayName = 'Button'
