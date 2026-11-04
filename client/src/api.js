import axios from 'axios';
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', withCredentials: true, timeout: 15000 });
let accessToken = '', refreshing;
export const setAccessToken = token => { accessToken = token || ''; };
export const refreshSession = () => {
  if (!refreshing) refreshing = api.post('/auth/refresh', {}, { skipRefresh: true }).then(r => { setAccessToken(r.data.token); return r.data; }).finally(() => { refreshing = undefined; });
  return refreshing;
};
api.interceptors.request.use(c => {
  if (accessToken) c.headers.Authorization = 'Bearer ' + accessToken;
  return c;
});
api.interceptors.response.use(r => r, async e => {
  const c = e.config;
  if (e.response?.status === 401 && c && !c.skipRefresh && !c.retried && accessToken) {
    c.retried = true;
    try { await refreshSession(); return api(c); }
    catch (refreshError) {
      if (refreshError.response?.status === 401) { setAccessToken(''); window.dispatchEvent(new Event('auth:expired')); }
      return Promise.reject(refreshError);
    }
  }
  return Promise.reject(e);
});
export const errMsg = e => e.response?.data?.message || e.message;
export const money = n => '₹' + Number(n || 0).toLocaleString('en-IN');
export const fdate = d => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '–');

// Pricing: product.monthlyRent is the 3-month price. Longer tenure = cheaper per month (same table as the server).
export const MULT = { 1: 1.25, 3: 1, 6: 0.92, 9: 0.86, 12: 0.8 };
export const rentFor = (base, t) => Math.round(base * (MULT[t] ?? 1));
export const lineRent = i => Math.round(rentFor(i.product.monthlyRent, i.tenure) * (i.bundle ? 100 - i.bundle.pct : 100) / 100);
export const CATS = [['furniture', 'Furniture'], ['appliance', 'Appliances'], ['babykids', 'Baby & Kids'], ['electronics', 'Electronics'], ['fitness', 'Fitness'], ['others', 'Others']];
// [type, label, emoji]
export const TYPES = {
  furniture: [['bed', 'Beds', '🛏️'], ['mattress', 'Mattresses', '🛌'], ['sofa', 'Sofas', '🛋️'], ['chair', 'Chairs & Stools', '🪑'], ['wardrobe', 'Wardrobe & Organizer', '🚪'], ['study table', 'Study Tables', '📚'],
    ['center table', 'Center Tables', '☕'], ['dining table', 'Dining Tables', '🍽️'], ['bedside table', 'Bedside Tables', '🕯️'], ['drawers', 'Chest of Drawers', '🗄️'], ['shelf', 'Shelves & TV Units', '📖']],
  appliance: [['fridge', 'Refrigerators', '🧊'], ['washing machine', 'Washing Machines', '🧺'], ['purifier', 'Water Purifiers', '💧'], ['air purifier', 'Air Purifiers', '🌬️'], ['ac', 'Air Conditioners', '❄️'],
    ['tv', 'Televisions', '📺'], ['microwave', 'Microwaves', '🍲'], ['cooktop', 'Cooktops', '🔥'], ['cooler', 'Air Coolers', '🌀'], ['dishwasher', 'Dishwashers', '🫧'], ['vacuum', 'Home', '🧹'], ['kitchen', 'Kitchen', '🍳'], ['geyser', 'Geysers', '🚿']],
  babykids: [['crib', 'Cribs', '🍼'], ['stroller', 'Strollers', '👶'], ['highchair', 'High Chairs', '🥣'], ['kids', 'Kids Furniture', '🧸']],
  electronics: [['laptop', 'Laptops', '💻'], ['tablet', 'Tablets', '📱'], ['phone', 'Smartphones', '📲'], ['speaker', 'Soundbars', '🔊'], ['monitor', 'Monitors', '🖥️']],
  fitness: [['treadmill', 'Treadmills', '🏃'], ['bike', 'Exercise Bikes', '🚴'], ['trainer', 'Cross Trainers', '🏋️'], ['dumbbell', 'Dumbbells', '💪'], ['gym', 'Home Gyms', '🏅'], ['massage', 'Massage Chairs', '💆']],
  others: [['inverter', 'Inverters', '🔋'], ['console', 'Gaming Consoles', '🎮'], ['camera', 'Cameras', '📷']]
};
export const ALL_TYPES = Object.values(TYPES).flat();
export const CAT_OF = Object.fromEntries(Object.entries(TYPES).flatMap(([c, l]) => l.map(t => [t[0], c])));
export const typeLabel = t => ALL_TYPES.find(x => x[0] === t)?.[1] || t;
export const home = u => (u?.role === 'admin' ? '/admin' : u?.role === 'vendor' ? '/vendor' : '/');
export default api;
