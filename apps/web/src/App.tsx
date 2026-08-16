import { NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { User } from '@mile-triage/shared';
import { api } from './api';
import { CategoriesPage } from './pages/CategoriesPage';
import { HistoryPage } from './pages/HistoryPage';
import { LandingPage } from './pages/LandingPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { ReportsPage } from './pages/ReportsPage';
import { TriagePage } from './pages/TriagePage';

function Shell() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    void api
      .me()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  if (user === undefined) {
    return <div className="page muted">Loading…</div>;
  }
  if (!user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/triage" className="brand">
          <img className="brand-mark" src="/favicon.svg" alt="" />
          MileTriage
        </NavLink>
        <nav className="nav desktop-nav">
          <NavLink to="/triage">Triage</NavLink>
          <NavLink to="/history">History</NavLink>
          <NavLink to="/trip-types">Trip types</NavLink>
          <NavLink to="/onboarding">Vehicles</NavLink>
          <NavLink to="/reports">Reports</NavLink>
          <button
            className="btn ghost"
            onClick={() =>
              void api.logout().then(() => {
                window.location.href = '/';
              })
            }
          >
            Log out
          </button>
        </nav>
        <button
          className="btn ghost mobile-logout"
          onClick={() =>
            void api.logout().then(() => {
              window.location.href = '/';
            })
          }
        >
          Log out
        </button>
      </header>
      <Outlet />
      <nav className="bottom-nav" aria-label="Main">
        <NavLink to="/triage">Triage</NavLink>
        <NavLink to="/history">History</NavLink>
        <NavLink to="/trip-types">Types</NavLink>
        <NavLink to="/reports">Reports</NavLink>
        <NavLink to="/onboarding">Vehicles</NavLink>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route element={<Shell />}>
        <Route path="/triage" element={<TriagePage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/trip-types" element={<CategoriesPage />} />
        <Route path="/categories" element={<Navigate to="/trip-types" replace />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/reports" element={<ReportsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
