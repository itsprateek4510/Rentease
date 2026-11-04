import { useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth, useCart, useCity } from './context.jsx';
import { CATS, home } from './api';
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

function CityModal() {
  const { city, setCity, areas, open, setOpen } = useCity(), [msg, setMsg] = useState('');
  if (!open) return null;
  const locate = () => {
    if (!navigator.geolocation) return setMsg('Location is not supported in this browser.');
    navigator.geolocation.getCurrentPosition(p => {
      const near = areas.filter(a => a.lat).map(a => ({ a, d: (a.lat - p.coords.latitude) ** 2 + (a.lng - p.coords.longitude) ** 2 })).sort((x, y) => x.d - y.d)[0];
      near && near.d < 25 ? setCity(near.a.name) : setMsg('We do not serve your area yet. Please pick a city below.');
    }, () => setMsg('Could not get your location. Please pick a city below.'));
  };
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Choose your city">
      <div className="box">
        <h2 style={{ marginTop: 0 }}>Choose location</h2>
        <p className="muted">Products, prices and delivery depend on where you live.</p>
        <button className="alt" onClick={locate}>📍 Fetch my location</button>
        {msg && <p className="muted">{msg}</p>}
        <div className="tiles">{areas.map(a => <button key={a._id} className="tile" onClick={() => setCity(a.name)}><b>{a.name}</b></button>)}</div>
        {city && <p><button className="link" onClick={() => setOpen(false)}>Keep {city}</button></p>}
      </div>
    </div>
  );
}

export default function App() {
  const { user, logout, loginOpen, openLogin, closeLogin } = useAuth(), { items } = useCart(), { city, setOpen } = useCity(), nav = useNavigate(), [q, setQ] = useState('');
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
                <Link to="/account">Account</Link><button className="link" onClick={() => { logout(); nav('/'); }}>Log out</button></div></div>
          ) : <button className="loginbtn" onClick={openLogin}>Login/Signup ➜</button>}
          {shopper && <Link to="/cart" className="cartb" aria-label={`Cart, ${items.length} items`}>🛒{items.length > 0 && <span className="n">{items.length}</span>}</Link>}
        </div>
      </header>
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
