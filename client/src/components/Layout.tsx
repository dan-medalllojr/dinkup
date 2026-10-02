import { Link, NavLink, Outlet } from 'react-router';
import { useAuth } from '../lib/auth.tsx';
import { useInbox } from '../lib/notifications.ts';
import { Avatar } from './Avatar.tsx';
import { PwaStatus } from './PwaStatus.tsx';

// Small inline icons for the tab bar; stroke uses currentColor.
const icon = (d: string) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);
const ICONS = {
  home: icon('M3 11l9-8 9 8M5 10v10h14V10'),
  games: icon('M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z'),
  courts: icon('M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'),
  post: icon('M12 5v14M5 12h14'),
  bell: icon('M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0'),
};

// Header bell with the unread count; opens the inbox.
function Bell() {
  const { unread } = useInbox();
  const label = unread > 0 ? `Notifications, ${unread} unread` : 'Notifications';
  return (
    <NavLink to="/notifications" className="bell" aria-label={label} title={label}>
      {ICONS.bell}
      {unread > 0 ? <span className="bell-badge">{unread > 9 ? '9+' : unread}</span> : null}
    </NavLink>
  );
}

const TABS = [
  { to: '/', label: 'Home', icon: ICONS.home, end: true },
  { to: '/games', label: 'Games', icon: ICONS.games, end: true },
  { to: '/courts', label: 'Courts', icon: ICONS.courts, end: false },
  { to: '/games/new', label: 'Post', icon: ICONS.post, end: false },
];

export function Layout() {
  const { user, loading } = useAuth();

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          <img src="/favicon.svg" alt="" width={28} height={28} />
          Dinkup
        </Link>
        {/* Wide screens: links live in the header. Phones use the tab bar below. */}
        <nav className="topnav-links" aria-label="Main">
          <NavLink to="/games" end>
            Games
          </NavLink>
          <NavLink to="/courts">Courts</NavLink>
          {user ? (
            <NavLink to="/games/new" className="button button-small">
              Post game
            </NavLink>
          ) : null}
        </nav>
        <div className="topnav-account">
          {loading ? null : user ? (
            <>
              <Bell />
              <NavLink to="/profile" className="topnav-profile" aria-label="Your profile">
                <Avatar name={user.name} photoUrl={user.photoUrl} size={32} />
              </NavLink>
            </>
          ) : (
            <>
              <NavLink to="/login">Log in</NavLink>
              <NavLink to="/register" className="button button-small">
                Sign up
              </NavLink>
            </>
          )}
        </div>
      </header>
      <PwaStatus />
      <main className="page">
        <Outlet />
      </main>
      <nav className="tabbar" aria-label="Main">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className="tab">
            {t.icon}
            <span>{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
