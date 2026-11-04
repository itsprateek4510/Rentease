import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import api, { lineRent, money } from '../api';
import { useAuth, useCart, useCity } from '../context.jsx';
import { useFlash } from '../ui.jsx';

const PAY = [['upi', 'UPI', 'Pay with any UPI app'], ['card', 'Credit / debit card', 'Visa, Mastercard, RuPay'], ['netbanking', 'Net banking', 'All major banks'], ['cod', 'Pay on delivery', 'Cash or UPI to our delivery partner']];

export default function Checkout() {
  const { items, clear, monthly, deposit, discount, coupon } = useCart(), { user, refresh } = useAuth(), { city, location, setOpen } = useCity(), nav = useNavigate(), [box, run] = useFlash();
  const saved = (user.addresses || []).filter(a => a.city.toLowerCase() === city.toLowerCase());
  const [sel, setSel] = useState(saved[0]?._id || 'new'), [f, setF] = useState({ label: 'Home', line: '', pincode: location.pincode || '' }), [keep, setKeep] = useState(true);
  const [date, setDate] = useState(''), [pay, setPay] = useState('upi'), [busy, setBusy] = useState(false), [useCr, setUseCr] = useState(false);
  const [checkoutKey] = useState(() => crypto.randomUUID());
  if (!items.length) return <Navigate to="/cart" />;
  if (!city) return <div><p>Choose your delivery location in India before checkout.</p><button onClick={() => setOpen(true)}>Choose location</button></div>;
  const today = new Date().toISOString().slice(0, 10), credit = useCr ? Math.max(0, Math.min(user.credits || 0, monthly - discount)) : 0;
  const place = e => { e.preventDefault(); setBusy(true); run(async () => {
    const a = sel === 'new' ? f : saved.find(x => x._id === sel);
    if (!a) throw new Error('Please select a delivery address');
    const { data } = await api.post('/orders', { items: items.map(i => ({ product: i.product._id, tenure: i.tenure, qty: i.qty, bundle: i.bundle?.slug })),
      address: a.line, pincode: a.pincode, city, deliveryDate: date, couponCode: coupon?.code, paymentMethod: pay, useCredits: useCr }, { headers: { 'Idempotency-Key': checkoutKey } });
    // Address-book failure must not turn a successfully placed order into a retry.
    if (sel === 'new' && keep) { try { await api.post('/addresses', { ...f, city, state: location.state }); } catch { /* order remains successful */ } }
    clear(); refresh().catch(() => {}); nav('/order-success/' + data._id);
  }).then(ok => ok || setBusy(false)); };
  return (
    <form onSubmit={place}>
      <h1>Checkout</h1>{box}
      <div className="cols2">
        <div>
          <div className="card pad"><h3 style={{ marginTop: 0 }}>1. Delivery address in <span style={{ textTransform: 'capitalize' }}>{city}</span></h3>
            <p className="muted">Delivery is checked against each lender’s coverage using your PIN code. Check out one lender at a time.</p>
            {saved.map(a => <label key={a._id} className={'opt' + (sel === a._id ? ' on' : '')}><input type="radio" name="addr" checked={sel === a._id} onChange={() => setSel(a._id)} /><span><b>{a.label}</b><br />{a.line} {a.pincode}</span></label>)}
            <label className={'opt' + (sel === 'new' ? ' on' : '')}><input type="radio" name="addr" checked={sel === 'new'} onChange={() => setSel('new')} /><span>Add a new address</span></label>
            {sel === 'new' && <>
              <label>Label</label><select value={f.label} onChange={e => setF({ ...f, label: e.target.value })}><option>Home</option><option>Office</option><option>Other</option></select>
              <label>Address</label><textarea required rows={2} value={f.line} onChange={e => setF({ ...f, line: e.target.value })} />
              <label>Pincode</label><input required pattern="\d{6}" maxLength={6} value={f.pincode} onChange={e => setF({ ...f, pincode: e.target.value.replace(/\D/g, '') })} />
              <label className="row" style={{ fontWeight: 400 }}><input type="checkbox" style={{ width: 'auto' }} checked={keep} onChange={e => setKeep(e.target.checked)} />Save this address</label></>}
          </div>
          <div className="card pad" style={{ marginTop: 14 }}><h3 style={{ marginTop: 0 }}>2. Delivery date</h3>
            <input type="date" required min={today} value={date} onChange={e => setDate(e.target.value)} aria-label="Delivery date" style={{ maxWidth: 220 }} /></div>
          <div className="card pad" style={{ marginTop: 14 }}><h3 style={{ marginTop: 0 }}>3. Payment</h3>
            {PAY.map(([k, l, d]) => <label key={k} className={'opt' + (pay === k ? ' on' : '')}><input type="radio" name="pay" checked={pay === k} onChange={() => setPay(k)} /><span><b>{l}</b><br /><span className="muted">{d}</span></span></label>)}
            {user.credits > 0 && <label className="opt"><input type="checkbox" checked={useCr} onChange={e => setUseCr(e.target.checked)} /><span>Use my rent credit (<b>{money(user.credits)}</b> available)</span></label>}
            <p className="muted">Demo payment gateway: no real money is charged.</p></div>
        </div>
        <aside className="sum"><h3 style={{ marginTop: 0 }}>Order summary</h3>
          {items.map(i => <div key={i.product._id}><span>{i.product.name} × {i.qty}<br /><small className="muted">{i.tenure} months</small></span><span>{money(lineRent(i) * i.qty)}</span></div>)}
          <div><span>Monthly rent</span><span>{money(monthly)}</span></div><div><span>Refundable deposit</span><span>{money(deposit)}</span></div>
          {discount > 0 && <div style={{ color: 'var(--ok)' }}><span>Coupon {coupon.code}</span><span>−{money(discount)}</span></div>}
          {credit > 0 && <div style={{ color: 'var(--ok)' }}><span>Rent credit</span><span>−{money(credit)}</span></div>}
          <div className="tot"><span>{pay === 'cod' ? 'Pay on delivery' : 'Pay now'}</span><span>{money(monthly + deposit - discount - credit)}</span></div>
          <button style={{ width: '100%', marginTop: 10 }} disabled={busy}>{busy ? 'Placing order…' : 'Place order'}</button>
        </aside>
      </div>
    </form>
  );
}
