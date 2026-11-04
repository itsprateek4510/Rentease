import { createContext, useContext, useEffect, useState } from 'react';
import api, { lineRent, rentFor } from './api';

const AuthCtx = createContext(), CartCtx = createContext(), CityCtx = createContext();
export const useAuth = () => useContext(AuthCtx);
export const useCart = () => useContext(CartCtx);
export const useCity = () => useContext(CityCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null), [loading, setLoading] = useState(!!localStorage.getItem('token')), [loginOpen, setLoginOpen] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem('token')) return;
    api.get('/auth/me').then(r => setUser(r.data)).catch(() => localStorage.removeItem('token')).finally(() => setLoading(false));
  }, []);
  const login = (token, u) => { localStorage.setItem('token', token); setUser(u); };
  const logout = () => { localStorage.removeItem('token'); setUser(null); };
  const refresh = () => api.get('/auth/me').then(r => { setUser(r.data); return r.data; });
  const toggleWish = async id => { const { data } = await api.post('/wishlist/' + id); setUser(u => ({ ...u, wishlist: data })); };
  return <AuthCtx.Provider value={{ user, setUser, loading, login, logout, refresh, toggleWish, loginOpen, openLogin: () => setLoginOpen(true), closeLogin: () => setLoginOpen(false) }}>{children}</AuthCtx.Provider>;
}

export function CityProvider({ children }) {
  const [city, setCityState] = useState(localStorage.getItem('city') || ''), [areas, setAreas] = useState([]), [open, setOpen] = useState(!localStorage.getItem('city'));
  useEffect(() => { api.get('/areas').then(r => setAreas(r.data)).catch(() => {}); }, []);
  const setCity = c => { localStorage.setItem('city', c); setCityState(c); setOpen(false); };
  return <CityCtx.Provider value={{ city, setCity, areas, open, setOpen }}>{children}</CityCtx.Provider>;
}

export function CartProvider({ children }) {
  const { city } = useCity();
  const [items, setItems] = useState(() => { try { return JSON.parse(localStorage.getItem('cart')) || []; } catch { return []; } });
  const [coupon, setCoupon] = useState(null); // { code, discount, description }
  useEffect(() => localStorage.setItem('cart', JSON.stringify(items)), [items]);
  useEffect(() => { if (city) setItems(l => l.filter(i => String(i.product.city).toLowerCase() === city)); }, [city]); // products are city-specific
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
