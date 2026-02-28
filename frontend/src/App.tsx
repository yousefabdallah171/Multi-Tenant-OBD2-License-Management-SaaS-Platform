import { BrowserRouter } from 'react-router-dom'
import { AppToaster } from '@/components/ui/toast'
import { useTheme } from '@/hooks/useTheme'
import { AppRouter } from '@/router'

function App() {
  useTheme()

  return (
    <BrowserRouter>
      <AppRouter />
      <AppToaster />
    </BrowserRouter>
  )
}

export default App
