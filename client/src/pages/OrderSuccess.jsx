import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { fdate, money } from '../api';
import { useAuth } from '../context.jsx';

export default function OrderSuccess() {
  const { id } = useParams(), { user } = useAuth(), [o, setO] = useState(null);
  useEffect(() => { api.get('/orders/' + id).then(r => setO(r.data)).catch(() => setO(false)); }, [id]);
  if (o === false) return <p>Order not found.</p>;
  if (!o) return <p>Loading…</p>;
  return (
    <div className="card pad narrow" style={{ maxWidth: 620 }}>
      <h1 style={{ marginTop: 0 }}>🎉 Order placed!</h1>
      <p>Order <b>#{String(o._id).slice(-6).toUpperCase()}</b> · delivery on <b>{fdate(o.deliveryDate)}</b> to {o.address}, <span style={{ textTransform: 'capitalize' }}>{o.city}</span></p>
      <ul>{o.items.map(i => <li key={i._id}>{i.name} × {i.qty} · {i.tenure} months · {money(i.monthlyRent)}/mo</li>)}</ul>
      <p>{o.paymentStatus === 'paid' ? <>Paid <b>{money(o.payable)}</b> via {o.paymentMethod.toUpperCase()}.</> : <>Pay <b>{money(o.payable)}</b> on delivery.</>} Deposit {money(o.totalDeposit)} is refundable.</p>
      {user.kyc?.status !== 'verified' && <p className="msg">Next step: complete KYC so we can schedule your delivery. <Link to="/account">Submit KYC</Link></p>}
      <div className="row"><Link className="btn" to="/rentals">Track my rentals</Link><Link className="btn alt" to="/listings">Keep browsing</Link></div>
    </div>
  );
}
