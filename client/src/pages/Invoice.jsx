import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api, { fdate, money } from '../api';
import { useAuth } from '../context.jsx';

export default function Invoice() {
  const { id } = useParams(), { user } = useAuth(), [o, setO] = useState(null);
  useEffect(() => { api.get('/orders/' + id).then(r => setO(r.data)).catch(() => setO(false)); }, [id]);
  if (o === false) return <p>Invoice not found.</p>;
  if (!o) return <p>Loading…</p>;
  return (
    <div className="card pad" style={{ maxWidth: 760, margin: '0 auto' }}>
      <div className="row between" style={{ marginTop: 0 }}><h1 style={{ margin: 0 }}>Invoice</h1><button className="noprint" onClick={() => window.print()}>Print / Save as PDF</button></div>
      <p className="muted">RentEase · support@rentease.in · Order #{String(o._id).slice(-6).toUpperCase()} · {fdate(o.createdAt)}</p>
      <p><b>Billed to:</b> {user.name}<br />{o.address}, <span style={{ textTransform: 'capitalize' }}>{o.city}</span> {o.pincode}</p>
      <table><thead><tr><th>Item</th><th>Qty</th><th>Tenure</th><th>Rent / month</th><th>Deposit</th></tr></thead><tbody>
        {o.items.map(i => <tr key={i._id}><td>{i.name}</td><td>{i.qty}</td><td>{i.tenure} months</td><td>{money(i.monthlyRent * i.qty)}</td><td>{money(i.deposit * i.qty)}</td></tr>)}</tbody></table>
      <div style={{ maxWidth: 320, marginLeft: 'auto', marginTop: 14 }}>
        <div className="row between"><span>Monthly rent</span><span>{money(o.totalMonthly)}</span></div>
        <div className="row between"><span>Refundable deposit</span><span>{money(o.totalDeposit)}</span></div>
        {o.discount > 0 && <div className="row between"><span>Coupon {o.couponCode}</span><span>−{money(o.discount)}</span></div>}
        {o.creditsUsed > 0 && <div className="row between"><span>Rent credit</span><span>−{money(o.creditsUsed)}</span></div>}
        <div className="row between"><b>{o.paymentStatus === 'paid' ? 'Paid' : 'Payable'} at checkout</b><b>{money(o.payable)}</b></div>
      </div>
      <p className="muted">Payment: {o.paymentMethod.toUpperCase()} ({o.paymentStatus}). Rent paid for {o.paidMonths} month(s). This is a demo invoice.</p>
    </div>
  );
}
