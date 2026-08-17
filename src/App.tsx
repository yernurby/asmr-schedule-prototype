import { HashRouter } from 'react-router-dom'
import { AppRoutes } from './app/router'

// HashRouter so that deep links keep working on GitHub Pages, which cannot
// rewrite unknown paths to index.html.
export default function App() {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  )
}
