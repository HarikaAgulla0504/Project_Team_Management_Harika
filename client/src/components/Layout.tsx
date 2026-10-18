import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Badge } from './ui';

export default function Layout() {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false); // mobile menu

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };
  const link = ({ isActive }: { isActive: boolean }) => (isActive ? 'nav-link active' : 'nav-link');

  return (
    <div className="app">
      <header className="topbar">
        <strong className="brand">Project &amp; Team Manager</strong>
        <button className="btn btn-small menu-toggle" onClick={() => setOpen(!open)} aria-label="Toggle menu">
          ☰
        </button>
        <nav className={open ? 'nav open' : 'nav'} onClick={() => setOpen(false)}>
          <NavLink to="/" end className={link}>Dashboard</NavLink>
          <NavLink to="/projects" className={link}>Projects</NavLink>
          <NavLink to="/tasks" className={link}>Tasks</NavLink>
          {hasRole('ADMIN') && <NavLink to="/users" className={link}>Users</NavLink>}
        </nav>
        <div className="user-box">
          <span>{user?.name}</span>
          {user && <Badge value={user.role} kind="role" />}
          <button className="btn btn-small" onClick={handleLogout}>Log out</button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
