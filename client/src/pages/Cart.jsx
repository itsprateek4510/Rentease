import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { errMsg, lineRent, money } from '../api';
import { useCart } from '../context.jsx';
import { imgError, typeImg } from '../ui.jsx';

export default function Cart() {
  const { items, update, remove, coupon, setCoupon, monthly, deposit, saving, discount } = useCart(), nav = useNavigate();
  const [code, setCode] = useState(''), [err, setErr] = useState(''), [offers, setOffers] = useState([]);
  useEffect(() => { api.get('/coupons').then(r => setOffers(r.data)).catch(() => {}); }, []);
  const apply = async c => { setErr(''); try { const { data } = await api.post('/coupons/validate', { code: c || code, subtotal: monthly }); setCoupon(data); setCode(''); } catch (e) { setErr(errMsg(e)); } };
  if (!items.length) return <><h1>Your cart is empty</h1><p className="muted">Add something you like and rent it by the month.</p><Link className="btn" to="/listings">Browse products</Link> <Link className="btn alt" to="/packages">View packages</Link></>;
  return (
    <>
      <h1>Your cart</h1>
      <div className="cols2">
        <div>
          {items.map(i => (
            <div className="line" key={i.product._id}>
              <img src={i.product.image || typeImg(i.product.type)} onError={imgError(i.product)} alt="" />
              <div className="grow">
                <b>{i.product.name}</b> {i.bundle && <span className="tag">Package −{i.bundle.pct}%</span>}
                <div className="muted">Deposit {money(i.product.securityDeposit)} each</div>
                <div className="row">
                  <select aria-label="Tenure" value={i.tenure} onChange={e => update(i.product._id, { tenure: +e.target.value })} style={{ width: 'auto' }}>{i.product.tenureOptions.map(t => <option key={t} value={t}>{t} {t === 1 ? 'month' : 'months'}</option>)}</select>
                  <input type="number" aria-label="Quantity" min="1" max={i.product.available} value={i.qty} onChange={e => update(i.product._id, { qty: Math.max(1, Math.min(+e.target.value || 1, i.product.available)) })} style={{ width: 80 }} />
                  <button className="alt" onClick={() => remove(i.product._id)}>Remove</button></div>
              </div>
              <div style={{ textAlign: 'right' }}><div className="price">{money(lineRent(i) * i.qty)}<small>/mo</small></div></div>
            </div>))}
          <div className="card pad"><b>Coupons</b>
            <div className="row"><input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Enter coupon code" aria-label="Coupon code" style={{ maxWidth: 220 }} /><button className="alt" onClick={() => apply()}>Apply</button></div>
            {err && <div className="msg err">{err}</div>}
            {coupon && <div className="msg">{coupon.code} applied: you save {money(coupon.discount)} on the first month. <button className="link" onClick={() => setCoupon(null)}>Remove</button></div>}
            <div className="row">{offers.map(o => <button key={o._id} className="pill" onClick={() => apply(o.code)} title={o.description}>{o.code}</button>)}</div>
          </div>
        </div>
        <aside className="sum" aria-label="Price summary">
          <h3 style={{ marginTop: 0 }}>Price summary</h3>
          <div><span>Monthly rent</span><span>{money(monthly)}</span></div>
          {saving > 0 && <div style={{ color: 'var(--ok)' }}><span>Package savings (per month)</span><span>{money(saving)}</span></div>}
          <div><span>Refundable deposit</span><span>{money(deposit)}</span></div>
          {discount > 0 && <div style={{ color: 'var(--ok)' }}><span>Coupon discount</span><span>−{money(discount)}</span></div>}
          <div className="tot"><span>Pay now</span><span>{money(monthly + deposit - discount)}</span></div>
          <p className="muted">Then {money(monthly)} every month. Deposit is refunded after pickup.</p>
          <button style={{ width: '100%' }} onClick={() => nav('/checkout')}>Proceed to checkout</button>
        </aside>
      </div>
    </>
  );
}
