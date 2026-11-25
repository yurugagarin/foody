import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { Brand } from './components/Logo';
import { Icon } from './components/Icon';
import { Gallery } from './pages/Gallery';
import { RecipeDetail } from './pages/RecipeDetail';
import { CookMode } from './pages/CookMode';
import { RateAttempt } from './pages/RateAttempt';
import { Pantry } from './pages/Pantry';
import { Library } from './pages/Library';
import { Editor } from './pages/Editor';
import { Settings } from './pages/Settings';
import { useEffect } from 'react';

const NAV = [
  { to: '/', label: 'Galeri', icon: 'gallery', end: true },
  { to: '/dolap', label: 'Dolabım', icon: 'fridge' },
  { to: '/malzemeler', label: 'Malzemeler', icon: 'jar' },
  { to: '/ayarlar', label: 'Ayarlar', icon: 'settings' }
];

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function Shell() {
  const { pathname } = useLocation();
  const cooking = pathname.endsWith('/pisir');
  return (
    <div className="shell">
      <div className="statusbar" aria-hidden="true" />
      {!cooking && (
        <aside className="side" aria-label="Menü">
          <div style={{ padding: '0 6px 18px' }}><Brand /></div>
          <NavLink to="/yeni" className="btn gold newbtn"><Icon name="plus" size={18} />Yeni tarif</NavLink>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav${isActive ? ' active' : ''}`}>
              <Icon name={n.icon} />
              {n.label}
            </NavLink>
          ))}
          <div className="grow" />
          <p className="small muted" style={{ padding: '0 8px', lineHeight: 1.5 }}>Tariflerin, fotoğrafların ve notların bu cihazda saklanır.</p>
        </aside>
      )}
      <main className="main" style={cooking ? { paddingBottom: 0 } : undefined}>
        <ScrollTop />
        <Routes>
          <Route path="/" element={<Gallery />} />
          <Route path="/tarif/:id" element={<RecipeDetail />} />
          <Route path="/tarif/:id/pisir" element={<CookMode />} />
          <Route path="/tarif/:id/puanla" element={<RateAttempt />} />
          <Route path="/tarif/:id/duzenle" element={<Editor />} />
          <Route path="/yeni" element={<Editor />} />
          <Route path="/dolap" element={<Pantry />} />
          <Route path="/malzemeler" element={<Library />} />
          <Route path="/ayarlar" element={<Settings />} />
          <Route path="*" element={<Gallery />} />
        </Routes>
      </main>
      {!cooking && (
        <nav className="bottomnav" aria-label="Ana menü">
          <NavLink to="/" end><Icon name="gallery" />Galeri</NavLink>
          <NavLink to="/dolap"><Icon name="fridge" />Dolabım</NavLink>
          <NavLink to="/yeni" className="plus" aria-label="Yeni tarif"><Icon name="plus" size={24} stroke={2.2} /></NavLink>
          <NavLink to="/malzemeler"><Icon name="jar" />Malzemeler</NavLink>
          <NavLink to="/ayarlar"><Icon name="settings" />Ayarlar</NavLink>
        </nav>
      )}
    </div>
  );
}

export function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}
