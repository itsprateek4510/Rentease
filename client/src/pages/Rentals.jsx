import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { fdate, money } from '../api';
import { Tag, useFlash } from '../ui.jsx';

const STEPS = [['placed', 'Placed'], ['scheduled', 'Scheduled'], ['active', 'Delivered'], ['return_requested', 'Return'], ['returned', 'Closed']];
const rank = s => ({ placed: 0, scheduled: 1, active: 2, return_requested: 3, returned: 4, damaged: 4 }[s] ?? -1);

export default function Rentals() {
  const [orders, setOrders] = useState([]), [maint, setMaint] = useState([]), [disputes, setDisputes] = useState([]), [pays, setPays] = useState([]);
  const [tab, setTab] = useState('active'), [box, run] = useFlash();
  const load = () => Promise.all([api.get('/orders/mine'), api.get('/maintenance/mine'), api.get('/disputes/mine'), api.get('/payments/mine')])
    .then(([o, m, d, p]) => { setOrders(o.data); setMaint(m.data); setDisputes(d.data); setPays(p.data); });
  useEffect(() => { run(load); }, []);
  const act = (fn, ok) => run(async () => { await fn(); await load(); }, ok);
  const live = ['placed', 'scheduled', 'active', 'return_requested'];
  const list = orders.filter(o => (tab === 'active') === live.includes(o.status));
  const names = o => o.items.map(i => `${i.name} ×${i.qty}`).join(', ');
  const months = o => Math.max(...o.items.map(i => i.tenure));

  return (
    <>
      <h1>My rentals</h1>{box}
      <div className="tabs">
        {[['active', 'Active rentals'], ['history', 'Rental history'], ['payments', 'Payments'], ['support', 'Support']].map(([k, l]) =>
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {['active', 'history'].includes(tab) && !list.length && <p>Nothing here yet. <Link to="/listings">Browse products</Link></p>}
      {['active', 'history'].includes(tab) && list.map(o => (
        <div className="card pad" key={o._id} style={{ marginBottom: 12 }}>
          <div className="row between" style={{ marginTop: 0 }}><b>Order #{String(o._id).slice(-6).toUpperCase()}</b><span><Tag s={o.status} /> <Tag s={o.paymentStatus} /></span></div>
          <div>{names(o)}</div>
          {rank(o.status) >= 0 && <div className="stepper" aria-label="Order progress">{STEPS.map(([k, l], i) => <span key={k} className={rank(o.status) >= i ? 'done' : ''}>{l}</span>)}</div>}
          <div className="muted">Delivery {fdate(o.deliveryDate)} to {o.address}, <span style={{ textTransform: 'capitalize' }}>{o.city}</span> · Ends {fdate(o.endDate)}{o.pickupDate && ` · Pickup ${fdate(o.pickupDate)}`}</div>
          <div>{money(o.totalMonthly)}/month · deposit {money(o.totalDeposit)}{o.couponCode && ` · coupon ${o.couponCode}`}{o.damageCharge > 0 && ` · damage charge ${money(o.damageCharge)}`}</div>
          {o.status === 'active' && <div className="muted">Rent paid for {o.paidMonths} of {months(o)} months</div>}
          <div className="row">
            {o.status !== 'cancelled' && <Link className="btn alt" to={'/invoice/' + o._id}>Invoice</Link>}
            {['placed', 'scheduled'].includes(o.status) && <button className="danger" onClick={() => confirm('Cancel this order? Any payment is refunded.') && act(() => api.put(`/orders/${o._id}/cancel`), 'Order cancelled')}>Cancel</button>}
            {['active', 'return_requested'].includes(o.status) && o.paidMonths < months(o) && <button onClick={() => act(() => api.put(`/orders/${o._id}/pay-rent`, { method: 'upi' }), 'Rent paid')}>Pay next rent ({money(o.totalMonthly)})</button>}
            {o.status === 'active' && <>
              <button className="alt" onClick={() => { const m = prompt('Extend by how many months?', '3'); m && act(() => api.put(`/orders/${o._id}/extend`, { months: +m }), 'Rental extended'); }}>Extend</button>
              <button className="alt" onClick={() => { const d = prompt('Pickup date (YYYY-MM-DD)'); d && act(() => api.put(`/orders/${o._id}/return`, { pickupDate: d }), 'Pickup scheduled'); }}>Schedule return</button>
              <button className="alt" onClick={() => { const d = prompt('Describe the problem'); d && act(() => api.post('/maintenance', { order: o._id, description: d }), 'Maintenance request sent'); }}>Request maintenance</button></>}
            {!['placed', 'cancelled'].includes(o.status) && <button className="alt" onClick={() => { const m = prompt('Describe your issue or damage dispute'); m && act(() => api.post('/disputes', { order: o._id, message: m, type: o.status === 'damaged' ? 'damage_claim' : 'dispute' }), 'Sent to admin'); }}>Raise dispute</button>}
          </div>
        </div>
      ))}
      {tab === 'payments' && (!pays.length ? <p>No payments yet.</p> : <div className="scroll"><table><thead><tr><th>Date</th><th>Type</th><th>Order</th><th>Method</th><th>Txn ID</th><th>Amount</th><th>Status</th></tr></thead><tbody>
        {pays.map(p => <tr key={p._id}><td>{fdate(p.paidAt || p.createdAt)}</td><td>{p.type}</td><td>#{String(p.order).slice(-6).toUpperCase()}</td><td>{p.method}</td><td>{p.txnId || '–'}</td><td>{money(p.amount)}</td><td><Tag s={p.status} /></td></tr>)}</tbody></table></div>)}
      {tab === 'support' && <>
        <h3>Maintenance</h3>
        {!maint.length && <p className="muted">No maintenance requests.</p>}
        {maint.map(m => <div className="card pad" key={m._id} style={{ marginBottom: 8 }}><Tag s={m.status} /> {m.description}<div className="muted">Raised {fdate(m.createdAt)}{m.resolvedAt && ` · resolved ${fdate(m.resolvedAt)}`}</div></div>)}
        <h3>Disputes and damage claims</h3>
        {!disputes.length && <p className="muted">No disputes.</p>}
        {disputes.map(d => <div className="card pad" key={d._id} style={{ marginBottom: 8 }}><Tag s={d.status} /> {d.message}{d.resolution && <div className="muted">Admin: {d.resolution}</div>}</div>)}
      </>}
    </>
  );
}
