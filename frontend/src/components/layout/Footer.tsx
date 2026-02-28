export function Footer() {
  const year = new Date().getFullYear()

  return <footer className="border-t border-slate-200 px-4 py-4 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">{year} OBD2SW License Platform</footer>
}
