import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errMsg, money, rentFor } from './api';
import { useAuth } from './context.jsx';

export function useFlash() {
  const [m, setM] = useState(null);
  const run = async (fn, ok) => { try { await fn(); setM(ok ? { t: ok } : null); return true; } catch (e) { setM({ t: errMsg(e), err: true }); return false; } };
  const box = m && <div className={'msg' + (m.err ? ' err' : '')} role="status">{m.t}</div>;
  return [box, run, setM];
}
export const Tag = ({ s }) => <span className={'tag ' + s}>{String(s).replace('_', ' ')}</span>;
export const Stars = ({ v, n }) => v > 0 ? <span className="stars" aria-label={`${v} out of 5`}>★ {v.toFixed(1)}{n ? <small> ({n})</small> : null}</span> : null;

const FALLBACK = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="700" height="460"><rect width="100%" height="100%" fill="#f1eeee"/><text x="50%" y="52%" fill="#a39b9b" font-family="sans-serif" font-size="30" text-anchor="middle">RentEase</text></svg>');
export const typeImg = t => '/products/' + String(t || '').replace(/ /g, '-') + '.svg';
export const imgError = p => e => {
  const el = e.currentTarget;
  if (!el.dataset.t) { el.dataset.t = 1; el.src = typeImg(p.type); } else { el.onerror = null; el.src = FALLBACK; }
};

export function Heart({ id, className = '' }) {
  const { user, toggleWish } = useAuth(), nav = useNavigate(), on = user?.wishlist?.includes(id);
  return <button type="button" className={'heart ' + className + (on ? ' on' : '')} aria-label={on ? 'Remove from wishlist' : 'Add to wishlist'} aria-pressed={!!on}
    onClick={e => { e.preventDefault(); e.stopPropagation(); user ? toggleWish(id) : nav('/login'); }}>{on ? '♥' : '♡'}</button>;
}

export function ProductCard({ p }) {
  return (
    <Link to={'/product/' + p._id} className="pcard2">
      <div className="pimg2">
        {p.available < 1 ? <span className="bd out">Out of stock</span> : p.badge ? <span className={'bd ' + p.badge.toLowerCase().replace(/ /g, '-')}>{p.badge}</span> : null}
        <Heart id={p._id} />
        <img src={p.image || typeImg(p.type)} alt={p.name} loading="lazy" onError={imgError(p)} />
        <div className="deliv">🚚 Delivery in <b>1-3 days</b></div>
      </div>
      <div className="prow"><h3>{p.name}</h3><div className="pr"><small>Monthly rent</small><b>{money(rentFor(p.monthlyRent, 12))}/mo</b></div></div>
      <div className="pfoot"><Stars v={p.ratingAvg} n={p.ratingCount} /></div>
    </Link>
  );
}
