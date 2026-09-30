import { createBrowserRouter } from 'react-router';
import { Layout } from './components/Layout.tsx';
import { RequireAuth } from './components/RequireAuth.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';
import { PlayerPage } from './pages/PlayerPage.tsx';
import { ProfilePage } from './pages/ProfilePage.tsx';
import { RegisterPage } from './pages/RegisterPage.tsx';

export const router = createBrowserRouter([
  {
    element: <Layout />,
    // Shown while a lazy route (e.g. /courts) loads on a direct visit.
    hydrateFallbackElement: <p className="page muted">Loading…</p>,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: 'courts',
        // Leaflet is ~150 KB, so only load it when someone opens the map.
        lazy: async () => ({ Component: (await import('./pages/CourtsPage.tsx')).CourtsPage }),
      },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'players/:id', element: <PlayerPage /> },
      {
        element: <RequireAuth />,
        children: [{ path: 'profile', element: <ProfilePage /> }],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
