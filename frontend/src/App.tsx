import { BrowserRouter } from 'react-router-dom'
import { useTheme } from '@/hooks/useTheme'
import { AppRouter } from '@/router'

function App() {
  useTheme()

  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  )
}

export default App
