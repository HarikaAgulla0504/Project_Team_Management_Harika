import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { label } from '../format';
import Icon from './Icon';

export default function Layout() {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false); // mobile sidebar

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };
  const link = ({ isActive }: { isActive: boolean }) => (isActive ? 'nav-link active' : 'nav-link');

  return (
    <div className="shell">
      {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)} />}

      <aside className={open ? 'sidebar open' : 'sidebar'}>
        <div className="logo">
          <span className="logo-mark"><Icon name="layers" size={20} /></span>
          <span>Project Manager</span>
        </div>

        <nav className="nav" onClick={() => setOpen(false)}>
          <NavLink to="/" end className={link}><Icon name="dashboard" /> Dashboard</NavLink>
          <NavLink to="/projects" className={link}><Icon name="folder" /> Projects</NavLink>
          <NavLink to="/tasks" className={link}><Icon name="tasks" /> Tasks</NavLink>
          {hasRole('ADMIN') && <NavLink to="/users" className={link}><Icon name="users" /> Users</NavLink>}
        </nav>

        <div className="sidebar-user">
          <div className="avatar">{user?.name.charAt(0).toUpperCase()}</div>
          <div className="sidebar-user-info">
            <strong>{user?.name}</strong>
            <small>{user ? label(user.role) : ''}</small>
          </div>
          <button className="icon-btn" onClick={handleLogout} title="Log out" aria-label="Log out">
            <Icon name="logout" />
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="mobilebar">
          <button className="icon-btn dark" onClick={() => setOpen(true)} aria-label="Open menu"><Icon name="menu" size={22} /></button>
          <strong>Project Manager</strong>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
