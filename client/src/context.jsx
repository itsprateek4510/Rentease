import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api, { lineRent, rentFor, setAccessToken, refreshSession } from './api';
import { storedLocation } from './locations';

const AuthCtx = createContext(), CartCtx = createContext(), CityCtx = createContext();
export const useAuth = () => useContext(AuthCtx);
export const useCart = () => useContext(CartCtx);
export const useCity = () => useContext(CityCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null), [loading, setLoading] = useState(true), [loginOpen, setLoginOpen] = useState(false), [authError, setAuthError] = useState('');
  useEffect(() => {
    let active = true;
    localStorage.removeItem('token'); // migrate away from persistent access tokens
    refreshSession().then(data => { if (active) setUser(data.user); }).catch(() => {}).finally(() => { if (active) setLoading(false); });
    const expired = () => { setUser(null); setAuthError('Your session expired. Please log in again.'); };
    window.addEventListener('auth:expired', expired);
    return () => { active = false; window.removeEventListener('auth:expired', expired); };
  }, []);
  const login = (token, u) => { setAccessToken(token); setUser(u); setAuthError(''); };
  const logout = async () => {
    try { await api.post('/auth/logout', {}, { skipRefresh: true }); setAccessToken(''); setUser(null); setAuthError(''); return true; }
    catch { setAuthError('Could not sign out on the server. Please try again.'); return false; }
  };
  const refresh = () => api.get('/auth/me').then(r => { setUser(r.data); return r.data; });
  const toggleWish = async id => { const { data } = await api.post('/wishlist/' + id); setUser(u => ({ ...u, wishlist: data })); };
  return <AuthCtx.Provider value={{ user, setUser, loading, login, logout, refresh, toggleWish, authError, loginOpen, openLogin: () => setLoginOpen(true), closeLogin: () => setLoginOpen(false) }}>{children}</AuthCtx.Provider>;
}

export function CityProvider({ children }) {
  const [location, setLocationState] = useState(storedLocation), [areas, setAreas] = useState([]), [open, setOpen] = useState(!storedLocation().city);
  const city = location.city;
  const locationParams = useMemo(() => ({ city, state: location.state, pincode: location.pincode, lat: location.lat, lng: location.lng }), [location]);
  const [areasError, setAreasError] = useState('');
  useEffect(() => {
    api.get('/areas', { timeout: 5000 }).then(r => setAreas(r.data)).catch(() => {
      setAreasError('Location service is temporarily unavailable. You can enter any Indian city to browse; products and checkout require the server to be online.');
      // Match the demo cities in server/seed.js when the API cannot be reached.
      setAreas(['Delhi', 'Noida', 'Gurugram', 'Mumbai', 'Pune', 'Bengaluru', 'Hyderabad', 'Chennai', 'Lucknow', 'Aligarh'].map(name => ({ name })));
    });
  }, []);
  const setLocation = value => {
    const next = { ...value, city: value.city.trim().toLowerCase(), country: 'IN' };
    localStorage.setItem('city', next.city); localStorage.setItem('location', JSON.stringify(next)); setLocationState(next); setOpen(false);
  };
  const setCity = c => setLocation({ city: c });
  return <CityCtx.Provider value={{ city, setCity, location, setLocation, locationParams, areas, areasError, open, setOpen }}>{children}</CityCtx.Provider>;
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => { try { return JSON.parse(localStorage.getItem('cart')) || []; } catch { return []; } });
  const [coupon, setCoupon] = useState(null); // { code, discount, description }
  useEffect(() => localStorage.setItem('cart', JSON.stringify(items)), [items]);
  const monthly = items.reduce((s, i) => s + lineRent(i) * i.qty, 0);
  const deposit = items.reduce((s, i) => s + i.product.securityDeposit * i.qty, 0);
  const saving = items.reduce((s, i) => s + (rentFor(i.product.monthlyRent, i.tenure) - lineRent(i)) * i.qty, 0);
  useEffect(() => { // keep coupon valid as the cart changes
    if (!coupon) return;
    api.post('/coupons/validate', { code: coupon.code, subtotal: monthly }).then(r => setCoupon(c => (c && c.discount === r.data.discount ? c : r.data))).catch(() => setCoupon(null));
  }, [monthly]); // eslint-disable-line
  const add = (product, tenure, qty = 1, bundle) => setItems(l => [...l.filter(i => i.product._id !== product._id), { product, tenure, qty, bundle }]);
  const addMany = list => setItems(l => [...l.filter(i => !list.some(x => x.product._id === i.product._id)), ...list]);
  const update = (id, patch) => setItems(l => l.map(i => (i.product._id === id ? { ...i, ...patch, ...(patch.tenure || patch.qty ? { bundle: undefined } : {}) } : i)));
  const remove = id => setItems(l => { const r = l.find(i => i.product._id === id); return l.filter(i => i.product._id !== id).map(i => (r?.bundle && i.bundle?.slug === r.bundle.slug ? { ...i, bundle: undefined } : i)); });
  const clear = () => { setItems([]); setCoupon(null); };
  return <CartCtx.Provider value={{ items, add, addMany, update, remove, clear, coupon, setCoupon, monthly, deposit, saving, discount: coupon?.discount || 0 }}>{children}</CartCtx.Provider>;
}
