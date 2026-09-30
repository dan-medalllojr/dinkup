import { Link, NavLink, Outlet } from 'react-router';
import { useAuth } from '../lib/auth.tsx';
import { Avatar } from './Avatar.tsx';

export function Layout() {
  const { user, loading } = useAuth();

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          <img src="/favicon.svg" alt="" width={28} height={28} />
          Dinkup
        </Link>
        <nav className="topnav">
          <NavLink to="/courts">Courts</NavLink>
          {loading ? null : user ? (
            <NavLink to="/profile" className="topnav-profile" aria-label="Your profile">
              <Avatar name={user.name} photoUrl={user.photoUrl} size={32} />
            </NavLink>
          ) : (
            <>
              <NavLink to="/login">Log in</NavLink>
              <NavLink to="/register" className="button button-small">
                Sign up
              </NavLink>
            </>
          )}
        </nav>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </div>
  );
}
