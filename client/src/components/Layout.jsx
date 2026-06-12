import { NavLink, Outlet } from 'react-router'
import './Layout.css'

const NAV = [
  { to: '/rfq', label: 'RFQs', icon: '📋' },
  { to: '/quotes', label: 'Quotes', icon: '💬', disabled: true },
  { to: '/suppliers', label: 'Suppliers', icon: '🏭', disabled: true },
  { to: '/reports', label: 'Reports', icon: '📊', disabled: true },
]

export default function Layout() {
  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-logo">LQ</div>
          <div>
            <div className="sidebar-brand-name">litquote</div>
            <div className="sidebar-brand-tagline">Procurement</div>
          </div>
        </div>

        <div className="sidebar-nav-section">
          <div className="sidebar-nav-label">Main menu</div>
          <ul className="sidebar-nav">
            {NAV.map(({ to, label, icon, disabled }) =>
              disabled ? (
                <li key={to} className="sidebar-item--disabled">
                  <span className="sidebar-link-icon">{icon}</span>
                  {label}
                  <span className="sidebar-badge">Soon</span>
                </li>
              ) : (
                <li key={to}>
                  <NavLink
                    to={to}
                    className={({ isActive }) =>
                      'sidebar-link' + (isActive ? ' sidebar-link--active' : '')
                    }
                  >
                    <span className="sidebar-link-icon">{icon}</span>
                    {label}
                  </NavLink>
                </li>
              )
            )}
          </ul>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-footer-text">v1.0.0 · litquote</div>
        </div>
      </nav>

      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
