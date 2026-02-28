import type { ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'

interface PageTransitionProps extends HTMLMotionProps<'div'> {
  children: ReactNode
  transitionKey: string
}

interface StaggerGroupProps extends HTMLMotionProps<'div'> {
  children: ReactNode
}

interface StaggerItemProps extends HTMLMotionProps<'div'> {
  children: ReactNode
}

export function PageTransition({ children, transitionKey, className, ...props }: PageTransitionProps) {
  const reduceMotion = useReducedMotion()

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={transitionKey}
        className={className}
        {...props}
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

export function StaggerGroup({ children, className, ...props }: StaggerGroupProps) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      className={className}
      {...props}
      initial={reduceMotion ? false : 'hidden'}
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: reduceMotion ? 0 : 0.06,
          },
        },
      }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className, ...props }: StaggerItemProps) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      className={cn(className)}
      {...props}
      variants={{
        hidden: { opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 8 },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            duration: reduceMotion ? 0 : 0.2,
            ease: 'easeOut',
          },
        },
      }}
    >
      {children}
    </motion.div>
  )
}
