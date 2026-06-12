import { NavLink, Outlet } from 'react-router'
import './Layout.css'

const NAV = [
  { to: '/rfq', label: 'RFQs' },
  { to: '/quotes', label: 'Quotes', disabled: true },
]

export default function Layout() {
  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="sidebar-brand">litquote</div>
        <ul className="sidebar-nav">
          {NAV.map(({ to, label, disabled }) =>
            disabled ? (
              <li key={to} className="sidebar-item sidebar-item--disabled">
                {label}
              </li>
            ) : (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    'sidebar-link' + (isActive ? ' sidebar-link--active' : '')
                  }
                >
                  {label}
                </NavLink>
              </li>
            )
          )}
        </ul>
      </nav>

      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
