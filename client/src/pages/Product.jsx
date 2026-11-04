import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { fdate, money, rentFor } from '../api';
import { useAuth, useCart } from '../context.jsx';
import { Heart, ProductCard, Stars, imgError, typeImg, useFlash } from '../ui.jsx';

export default function Product() {
  const { id } = useParams(), [p, setP] = useState(null), [tenure, setTenure] = useState(0), [qty, setQty] = useState(1), [reviews, setReviews] = useState([]);
  const [rv, setRv] = useState({ rating: 5, comment: '' }), [box, run] = useFlash(), { add } = useCart(), { user } = useAuth(), nav = useNavigate();
  useEffect(() => {
    setP(null); window.scrollTo(0, 0);
    api.get('/products/' + id).then(r => { setP(r.data); setTenure(r.data.tenureOptions.includes(6) ? 6 : r.data.tenureOptions[0]); setQty(1); api.get('/reviews', { params: { sku: r.data.sku } }).then(x => setReviews(x.data)); }).catch(() => setP(false));
  }, [id]);
  if (p === false) return <p>Product not found.</p>;
  if (!p) return <p>Loading…</p>;
  const canRent = !user || user.role === 'user', rent = rentFor(p.monthlyRent, tenure), base = rentFor(p.monthlyRent, 3);
  const eta = new Date(Date.now() + 3 * 864e5);
  const submitReview = e => { e.preventDefault(); run(async () => { await api.post('/reviews', { sku: p.sku, ...rv }); const x = await api.get('/reviews', { params: { sku: p.sku } }); setReviews(x.data); }, 'Thanks for your review'); };
  return (
    <>
      <p className="muted"><Link to="/listings">Listings</Link> › <Link to={'/listings?category=' + p.category}>{p.category}</Link> › {p.name}</p>
      <div className="two">
        <div className="gal"><img src={p.image || typeImg(p.type)} onError={imgError(p)} alt={p.name} /></div>
        <div>
          <div className="row between" style={{ marginTop: 0 }}><h1 style={{ margin: 0 }}>{p.name}</h1><span style={{ position: 'relative', width: 40, height: 40 }}><Heart id={p._id} /></span></div>
          <Stars v={p.ratingAvg} n={p.ratingCount} />
          <p>{p.description}</p>
          <p className="muted">Lender delivery coverage: {p.coverage?.mode === 'nationwide' ? 'All of India' : p.coverage?.mode === 'radius' ? `${p.coverage.radiusKm} km from the lender (PIN-code centre)` : ['cities', 'states', 'pincodes'].includes(p.coverage?.mode) ? (p.coverage[p.coverage.mode] || []).join(', ') : p.city}. Eligibility is confirmed using your delivery PIN at checkout.</p>
          <div className="price" style={{ fontSize: '1.7rem' }}>{money(rent)}<small> /month</small> {tenure !== 3 && rent < base && <s className="muted" style={{ fontSize: '1rem' }}>{money(base)}</s>}</div>
          <label>Choose tenure</label>
          <div className="pills" role="radiogroup" aria-label="Tenure">{p.tenureOptions.map(t => { const r = rentFor(p.monthlyRent, t), off = Math.round((1 - r / base) * 100);
            return <button key={t} role="radio" aria-checked={tenure === t} className={'pill' + (tenure === t ? ' on' : '')} onClick={() => setTenure(t)}>{t} {t === 1 ? 'month' : 'months'}<br />{money(r)}/mo{off > 0 && <small>{off}% off</small>}</button>; })}</div>
          <p className="muted">Refundable security deposit: <b>{money(p.securityDeposit)}</b> · {p.available > 0 ? <>In stock ({p.available}) · Delivery by <b>{fdate(eta)}</b></> : <b style={{ color: 'var(--bad)' }}>Out of stock</b>}</p>
          {canRent ? <>
            <label>Quantity</label><input type="number" min="1" max={Math.max(1, p.available)} value={qty} onChange={e => setQty(Math.max(1, Math.min(+e.target.value || 1, p.available || 1)))} style={{ width: 110 }} />
            <div className="row"><button disabled={p.available < 1} onClick={() => { add(p, tenure, qty); nav('/cart'); }}>Add to cart</button>
              <button className="alt" disabled={p.available < 1} onClick={() => { add(p, tenure, qty); nav('/checkout'); }}>Rent now</button></div>
          </> : <p className="muted">Log in with a customer account to rent.</p>}
          <div className="perkrow"><span>🔧 Free maintenance</span><span>🚚 Free relocation</span><span>💸 Refundable deposit</span><span>✅ Quality checked</span></div>
        </div>
      </div>
      <h2 style={{ marginTop: 40 }}>Customer reviews</h2>{box}
      {!reviews.length && <p className="muted">No reviews yet.</p>}
      <div className="quotes">{reviews.slice(0, 6).map(r => <div className="quote" key={r._id}><Stars v={r.rating} /><p>{r.comment}</p><span>{r.userName} · {fdate(r.createdAt)}</span></div>)}</div>
      {user?.role === 'user' && <form className="card pad" style={{ maxWidth: 480, marginTop: 16 }} onSubmit={submitReview}>
        <b>Rented this? Write a review</b>
        <label>Rating</label><select value={rv.rating} onChange={e => setRv({ ...rv, rating: +e.target.value })}>{[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} stars</option>)}</select>
        <label>Comment</label><textarea rows={2} value={rv.comment} onChange={e => setRv({ ...rv, comment: e.target.value })} />
        <div className="row"><button>Submit review</button></div></form>}
      {!!p.similar?.length && <><h2 style={{ marginTop: 40 }}>Similar products</h2><div className="grid">{p.similar.map(s => <ProductCard key={s._id} p={s} />)}</div></>}
    </>
  );
}
