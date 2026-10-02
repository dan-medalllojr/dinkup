import { createBrowserRouter } from 'react-router';
import { Layout } from './components/Layout.tsx';
import { RequireAuth } from './components/RequireAuth.tsx';
import { RouteError } from './components/RouteError.tsx';
import { GamePage } from './pages/GamePage.tsx';
import { GamesPage } from './pages/GamesPage.tsx';
import { AboutPage } from './pages/AboutPage.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { InstallPage } from './pages/InstallPage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';
import { NotificationsPage } from './pages/NotificationsPage.tsx';
import { PlayerPage } from './pages/PlayerPage.tsx';
import { ProfilePage } from './pages/ProfilePage.tsx';
import { RegisterPage } from './pages/RegisterPage.tsx';

export const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <RouteError />,
    // Shown while a lazy route (e.g. /courts) loads on a direct visit.
    hydrateFallbackElement: <p className="page muted">Loading…</p>,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: 'courts',
        // Leaflet is ~150 KB, so only load it when someone opens the map.
        lazy: async () => ({ Component: (await import('./pages/CourtsPage.tsx')).CourtsPage }),
      },
      { path: 'games', element: <GamesPage /> },
      { path: 'games/:id', element: <GamePage /> },
      { path: 'install', element: <InstallPage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'players/:id', element: <PlayerPage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: 'profile', element: <ProfilePage /> },
          { path: 'notifications', element: <NotificationsPage /> },
          {
            path: 'games/new',
            // Shares the Leaflet chunk with /courts.
            lazy: async () => ({ Component: (await import('./pages/NewGamePage.tsx')).NewGamePage }),
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
