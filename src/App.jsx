import { NavLink, Route, Routes } from 'react-router-dom'
import BlueprintsPage from './pages/BlueprintsPage.jsx'
import RealtimeBlueprintPage from './pages/RealtimeBlueprintPage.jsx'
import BlueprintDetailPage from './pages/BlueprintDetailPage.jsx'
import BlueprintEditorPage from './pages/BlueprintEditorPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import NotFound from './pages/NotFound.jsx'
import PrivateRoute from './components/PrivateRoute.jsx'

export default function App() {
  return (
    <div className="container">
      <header className="app-header">
        <h1 className="brand-title">ECI - Laboratorio de Blueprints en React</h1>
        <nav className="site-nav">
          <NavLink to="/" end>
            Blueprints
          </NavLink>
          <NavLink to="/realtime">Real time</NavLink>
          <NavLink to="/login">Login</NavLink>
          <NavLink to="/blueprints/new">Create blueprint</NavLink>
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<BlueprintsPage />} />
        <Route path="/realtime" element={<RealtimeBlueprintPage />} />
        <Route
          path="/blueprints/new"
          element={
            <PrivateRoute>
              <BlueprintEditorPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/blueprints/:author/:name/edit"
          element={
            <PrivateRoute>
              <BlueprintEditorPage />
            </PrivateRoute>
          }
        />
        <Route path="/blueprints/:author/:name" element={<BlueprintDetailPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  )
}
