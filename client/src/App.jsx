import { useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth, useCart, useCity } from './context.jsx';
import api, { CATS, home, errMsg } from './api';
import { INDIAN_STATES } from './locations';
import LoginPanel from './components/LoginPanel.jsx';
import HelpWidget from './components/HelpWidget.jsx';
import Home from './pages/Home.jsx';
import Catalog from './pages/Catalog.jsx';
import Product from './pages/Product.jsx';
import Packages from './pages/Packages.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import OrderSuccess from './pages/OrderSuccess.jsx';
import Rentals from './pages/Rentals.jsx';
import Wishlist from './pages/Wishlist.jsx';
import Account from './pages/Account.jsx';
import Contact from './pages/Contact.jsx';
import Relocation from './pages/Relocation.jsx';
import Stores from './pages/Stores.jsx';
import Business from './pages/Business.jsx';
import Refer from './pages/Refer.jsx';
import Invoice from './pages/Invoice.jsx';
import Info from './pages/Info.jsx';
import Auth from './pages/Auth.jsx';
import Verify from './pages/Verify.jsx';
import Forgot from './pages/Forgot.jsx';
import Vendor from './pages/Vendor.jsx';
import Admin from './pages/Admin.jsx';

function Guard({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="wrap">Loading…</p>;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
  return children;
}

function LoginPage() {
  const nav = useNavigate();
  return <div className="wrap"><div className="card pad narrow"><LoginPanel onDone={u => nav(home(u))} /></div></div>;
}

function OAuthCallback() {
  const { user, loading } = useAuth();
  if (loading) return <p className="wrap">Completing Google sign-in…</p>;
  return user ? <Navigate to={home(user)} replace /> : <div className="wrap"><p>Could not complete sign-in. Check that cookies are enabled and try again.</p><Link to="/login">Back to login</Link></div>;
}

export function CityModal() {
  const { city, setCity, setLocation, areas, areasError, open, setOpen } = useCity(), [msg, setMsg] = useState('');
  const [town, setTown] = useState(''), [state, setState] = useState(''), [pin, setPin] = useState(''), [busy, setBusy] = useState(false);
  if (!open) return null;
  const locate = () => {
    if (!navigator.geolocation) return setMsg('Location is not supported in this browser.');
    setMsg(''); setBusy(true);
    navigator.geolocation.getCurrentPosition(async p => {
      try { const { data } = await api.get('/locations/reverse', { params: { lat: p.coords.latitude, lng: p.coords.longitude } }); setLocation(data); }
      catch (e) { setMsg(errMsg(e)); } finally { setBusy(false); }
    }, () => { setBusy(false); setMsg('Could not get your location. Enter your city or PIN code below.'); }, { timeout: 10000, maximumAge: 60000 });
  };
  const lookup = async e => {
    e.preventDefault(); setBusy(true); setMsg('');
    try { const { data } = await api.get('/locations/pincode/' + pin); setLocation(data); }
    catch (e) { setMsg(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Choose your city">
      <div className="box">
        <h2 style={{ marginTop: 0 }}>Choose location</h2>
        <p className="muted">Choose any location in India. Delivery depends on each lender’s coverage. Use your PIN code for the most accurate results.</p>
        <button className="alt" disabled={busy} onClick={locate}>📍 Fetch my location</button>
        {areasError && <p role="status" className="muted">{areasError}</p>}
        {msg && <p className="muted">{msg}</p>}
        <form onSubmit={lookup} className="row" aria-label="Find location by PIN code">
          <input aria-label="Indian PIN code" placeholder="6-digit PIN code" required pattern="[1-9][0-9]{5}" maxLength={6} inputMode="numeric" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} />
          <button disabled={busy || !/^[1-9]\d{5}$/.test(pin)}>Use PIN code</button>
        </form>
        <form aria-label="Choose an Indian location" onSubmit={e => { e.preventDefault(); if (town.trim() && state) setLocation({ city: town, state }); }}>
          <label>City or town</label><input required aria-label="City or town" value={town} onChange={e => setTown(e.target.value)} placeholder="Any city, town or village in India" />
          <label>State or union territory</label><select required aria-label="State or union territory" value={state} onChange={e => setState(e.target.value)}><option value="">Select state / UT</option>{INDIAN_STATES.map(s => <option key={s}>{s}</option>)}</select>
          <div className="row"><button disabled={busy}>Browse this location</button></div>
        </form>
        <p className="muted">Popular cities (not a service restriction)</p>
        <div className="tiles">{areas.map(a => <button key={a._id || a.name} className="tile" onClick={() => setCity(a.name)}><b>{a.name}</b></button>)}</div>
        {city && <p><button className="link" onClick={() => setOpen(false)}>Keep {city}</button></p>}
        {!city && <p><button className="link" onClick={() => setOpen(false)}>Continue browsing</button></p>}
      </div>
    </div>
  );
}

export default function App() {
  const { user, logout, loginOpen, openLogin, closeLogin, authError } = useAuth(), { items } = useCart(), { city, setOpen } = useCity(), nav = useNavigate(), [q, setQ] = useState('');
  const shopper = !user || user.role === 'user', first = user?.name?.split(' ')[0];
  return (
    <>
      <header className="top noprint">
        <div className="hd">
          <div className="brandcol"><Link to="/" className="logo2"><span className="lm">r</span><span className="lt">rentease</span></Link>
            <button className="cityb" onClick={() => setOpen(true)} aria-label="Change city"><span style={{ textTransform: 'capitalize' }}>{city || 'Select city'}</span>, India ▾</button></div>
          <form className="sbox2" role="search" onSubmit={e => { e.preventDefault(); nav('/listings?q=' + encodeURIComponent(q)); }}>
            <input placeholder="Search for products to rent" value={q} onChange={e => setQ(e.target.value)} aria-label="Search for products to rent" /><button aria-label="Search">🔍</button>
          </form>
          <nav className="hl2" aria-label="Services"><NavLink to="/plans">RentEase Plus</NavLink><NavLink to="/relocation">Relocation</NavLink><NavLink to="/stores">Stores</NavLink><NavLink to="/business">Business</NavLink></nav>
          {user ? (
            <div className="um"><button className="loginbtn alt" aria-haspopup="menu">Hi, {first} ▾</button>
              <div className="dd2" role="menu">
                {user.role === 'user' && <><Link to="/rentals">My rentals</Link><Link to="/wishlist">Wishlist</Link><Link to="/refer">Refer &amp; Earn</Link></>}
                {user.role === 'vendor' && <Link to="/vendor">Vendor desk</Link>}
                {user.role === 'admin' && <><Link to="/admin">Admin dashboard</Link><Link to="/vendor">Inventory</Link></>}
                <Link to="/account">Account</Link><button className="link" onClick={async () => { if (await logout()) nav('/'); }}>Log out</button></div></div>
          ) : <button className="loginbtn" onClick={openLogin}>Login/Signup ➜</button>}
          {shopper && <Link to="/cart" className="cartb" aria-label={`Cart, ${items.length} items`}>🛒{items.length > 0 && <span className="n">{items.length}</span>}</Link>}
        </div>
      </header>
      {authError && <p className="msg err" role="alert">{authError}</p>}
      <CityModal />
      {loginOpen && <div className="modal" role="dialog" aria-modal="true" aria-label="Log in" onClick={e => e.target === e.currentTarget && closeLogin()}>
        <div className="box login"><button className="x" aria-label="Close" onClick={closeLogin}>×</button><LoginPanel art onDone={closeLogin} /></div></div>}
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/listings" element={<Catalog />} />
          <Route path="/product/:id" element={<Product />} />
          <Route path="/packages" element={<Packages />} />
          <Route path="/plans" element={<Packages plans />} />
          <Route path="/cart" element={<div className="wrap"><Cart /></div>} />
          <Route path="/checkout" element={<Guard roles={['user']}><div className="wrap"><Checkout /></div></Guard>} />
          <Route path="/order-success/:id" element={<Guard><div className="wrap"><OrderSuccess /></div></Guard>} />
          <Route path="/invoice/:id" element={<Guard><div className="wrap"><Invoice /></div></Guard>} />
          <Route path="/wishlist" element={<Guard roles={['user']}><div className="wrap"><Wishlist /></div></Guard>} />
          <Route path="/refer" element={<Guard roles={['user']}><div className="wrap"><Refer /></div></Guard>} />
          <Route path="/relocation" element={<Relocation />} />
          <Route path="/stores" element={<Stores />} />
          <Route path="/business" element={<Business />} />
          <Route path="/contact" element={<div className="wrap"><Contact /></div>} />
          {['about', 'terms', 'privacy', 'faq'].map(k => <Route key={k} path={'/' + k} element={<Info page={k} />} />)}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<OAuthCallback />} />
          <Route path="/register" element={<div className="wrap"><Auth register /></div>} />
          <Route path="/verify" element={<div className="wrap"><Verify /></div>} />
          <Route path="/forgot" element={<div className="wrap"><Forgot /></div>} />
          <Route path="/reset/:token" element={<div className="wrap"><Forgot reset /></div>} />
          <Route path="/account" element={<Guard><div className="wrap"><Account /></div></Guard>} />
          <Route path="/rentals" element={<Guard roles={['user']}><div className="wrap"><Rentals /></div></Guard>} />
          <Route path="/vendor" element={<Guard roles={['vendor', 'admin']}><div className="wrap"><Vendor /></div></Guard>} />
          <Route path="/admin" element={<Guard roles={['admin']}><div className="wrap"><Admin /></div></Guard>} />
          <Route path="*" element={<div className="wrap"><p>Page not found.</p></div>} />
        </Routes>
      </main>
      <HelpWidget />
      <footer className="foot noprint">
        <div className="cols">
          <div><h4>RentEase</h4><p>Rent furniture, appliances, electronics and fitness equipment by the month. Free maintenance, free relocation and refundable deposits.</p></div>
          <div><h4>Explore</h4>{CATS.map(([k, l]) => <Link key={k} to={'/listings?category=' + k}>{l}</Link>)}<Link to="/packages">Packages</Link><Link to="/plans">RentEase Plus</Link></div>
          <div><h4>Company</h4><Link to="/about">About us</Link><Link to="/stores">Stores</Link><Link to="/relocation">Relocation</Link><Link to="/business">Business solutions</Link><Link to="/refer">Refer &amp; Earn</Link><Link to="/faq">FAQs</Link><Link to="/terms">Terms &amp; Conditions</Link><Link to="/privacy">Privacy Policy</Link></div>
          <div id="contact"><h4>Contact us</h4><p>support@rentease.in<br />+91 98765 43210<br />Mon to Sat, 9am to 7pm</p><Link to="/contact">Send us a message</Link></div>
        </div>
        <div className="copy">© 2026 RentEase. Demo project.</div>
      </footer>
    </>
  );
}
