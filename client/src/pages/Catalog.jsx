import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { CATS, TYPES, rentFor, typeLabel, errMsg } from '../api';
import { useCity } from '../context.jsx';
import PillBand from '../components/PillBand.jsx';
import { ProductCard } from '../ui.jsx';

const BUDGETS = [['₹0 - ₹500', 0, 500], ['₹501 - ₹1000', 501, 1000], ['₹1001 - ₹5000', 1001, 5000], ['₹5000+', 5001, Infinity]];
const price = p => rentFor(p.monthlyRent, 12);
const toggle = (arr, v) => (arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

export default function Catalog() {
  const { city, locationParams } = useCity(), [sp, setSp] = useSearchParams(), [all, setAll] = useState([]), [loading, setLoading] = useState(true), [show, setShow] = useState(24), [error, setError] = useState('');
  const [st, setSt] = useState({ in: true, out: false }), [bud, setBud] = useState([]), [caps, setCaps] = useState([]), [brands, setBrands] = useState([]);
  const category = CATS.some(([k]) => k === sp.get('category')) ? sp.get('category') : '', type = sp.get('type') || '', q = sp.get('q') || '', sort = sp.get('sort') || 'popular';
  useEffect(() => { let active = true; setLoading(true); setAll([]); setError(''); api.get('/products', { params: locationParams }).then(r => { if (active) setAll(r.data); }).catch(e => { if (active) setError(errMsg(e)); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [locationParams]);
  useEffect(() => { setCaps([]); setBrands([]); setBud([]); setShow(24); }, [category, type, q]);
  const set = (k, v) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); if (k === 'category') n.delete('type'); setSp(n); };

  const base = useMemo(() => all.filter(p => (!category || p.category === category) && (!type || p.type === type) && (!q || p.name.toLowerCase().includes(q.toLowerCase()))), [all, category, type, q]);
  const inStatus = p => (!st.in && !st.out) || (st.in && p.available > 0) || (st.out && p.available < 1);
  const list = useMemo(() => {
    const l = base.filter(p => inStatus(p) && (!bud.length || bud.some(i => price(p) >= BUDGETS[i][1] && price(p) <= BUDGETS[i][2])) && (!caps.length || caps.includes(p.capacity)) && (!brands.length || brands.includes(p.brand)));
    const by = { low: (a, b) => a.monthlyRent - b.monthlyRent, high: (a, b) => b.monthlyRent - a.monthlyRent, rating: (a, b) => b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount, popular: (a, b) => b.ratingCount - a.ratingCount };
    return [...l].sort(by[sort] || by.popular);
  }, [base, st, bud, caps, brands, sort]); // eslint-disable-line
  const capList = [...new Set(base.map(p => p.capacity).filter(Boolean))].sort((a, b) => parseFloat(a) - parseFloat(b));
  const brandList = [...new Set(base.map(p => p.brand).filter(Boolean))].sort();
  const label = type ? typeLabel(type) : CATS.find(c => c[0] === category)?.[1];
  const title = label ? `${label} on Rent in ` : q ? `Results for “${q}” in ` : 'All products on Rent in ';
  const tiles = category ? TYPES[category].map(([t, l, em]) => ({ key: t, l, em, on: type === t, to: `/listings?category=${category}&type=${encodeURIComponent(t)}` }))
    : CATS.map(([k, l]) => ({ key: k, l, em: TYPES[k][0][2], on: false, to: '/listings?category=' + k }));
  const crumbs = [['Home', '/'], [category ? CATS.find(c => c[0] === category)?.[1] + ' on Rent' : 'All products', category ? '/listings?category=' + category : null], ...(type ? [[typeLabel(type)]] : [])];

  return (
    <>
      <PillBand crumbs={crumbs} category={category} />
      <div className="wrap" style={{ paddingTop: 16 }}>
        <div className="trow" role="list">{tiles.map(t => <Link key={t.key} to={t.to} role="listitem" className={'tt' + (t.on ? ' on' : '')}><span className="em" aria-hidden="true">{t.em}</span><span>{t.l}</span></Link>)}</div>
        <div className="shop2">
          <aside className="side2" aria-label="Filters">
            <h2>Filters</h2>
            <h4>Product Status</h4>
            <label className="fl"><input type="checkbox" checked={st.in} onChange={e => setSt({ ...st, in: e.target.checked })} /><span>In Stock</span><i>{base.filter(p => p.available > 0).length}</i></label>
            <label className="fl"><input type="checkbox" checked={st.out} onChange={e => setSt({ ...st, out: e.target.checked })} /><span>Out of Stock</span><i>{base.filter(p => p.available < 1).length}</i></label>
            <h4>Monthly Budget</h4>
            {BUDGETS.map(([l, lo, hi], i) => { const n = base.filter(p => inStatus(p) && price(p) >= lo && price(p) <= hi).length;
              return <label key={l} className={'fl' + (n ? '' : ' dis')}><input type="checkbox" disabled={!n} checked={bud.includes(i)} onChange={() => setBud(toggle(bud, i))} /><span>{l}</span><i>{n}</i></label>; })}
            {capList.length > 1 && <><h4>Capacity</h4><div className="capp">{capList.map(c => <button key={c} className={'cp' + (caps.includes(c) ? ' on' : '')} aria-pressed={caps.includes(c)} onClick={() => setCaps(toggle(caps, c))}>{c}</button>)}</div></>}
            {brandList.length > 1 && <><h4>Brand</h4>{brandList.map(b => <label key={b} className="fl"><input type="checkbox" checked={brands.includes(b)} onChange={() => setBrands(toggle(brands, b))} /><span>{b}</span><i>{base.filter(p => p.brand === b).length}</i></label>)}</>}
          </aside>
          <div>
            <div className="row between" style={{ marginTop: 0 }}>
              <h1 className="ctitle">{title}<span style={{ textTransform: 'capitalize' }}>{city || 'India'}</span></h1>
              <select value={sort} onChange={e => set('sort', e.target.value)} aria-label="Sort" style={{ width: 'auto' }}>
                <option value="popular">Most popular</option><option value="rating">Top rated</option><option value="low">Rent: low to high</option><option value="high">Rent: high to low</option></select>
            </div>
            <p className="muted">{loading ? 'Loading…' : `${list.length} products`}</p>
            {error && <p role="alert" className="msg err">Could not load rentals: {error}</p>}
            {!loading && !error && !list.length && <p>No lender listings match this location and these filters. Try a PIN code or clear a filter.</p>}
            <div className="grid3">{list.slice(0, show).map(p => <ProductCard key={p._id} p={p} />)}</div>
            {list.length > show && <p style={{ textAlign: 'center', marginTop: 22 }}><button className="alt" onClick={() => setShow(s => s + 24)}>Load more</button></p>}
          </div>
        </div>
      </div>
    </>
  );
}
