import { useEffect, useState } from 'react';
import api, { fdate, money } from '../api';
import { Tag, useFlash } from '../ui.jsx';
import { MaintTable, Orders } from './Vendor.jsx';

const blank = { code: '', description: '', type: 'percent', value: '', minOrder: '', maxDiscount: '' };
export default function Admin() {
  const [tab, setTab] = useState('reports'), [d, setD] = useState({ reports: null, users: [], orders: [], disputes: [], areas: [], maint: [], coupons: [], messages: [], requests: [] });
  const [area, setArea] = useState(''), [cp, setCp] = useState(blank), [box, run] = useFlash();
  const load = () => Promise.all([api.get('/admin/reports'), api.get('/admin/users'), api.get('/orders/manage/list'), api.get('/disputes'), api.get('/areas'), api.get('/maintenance/manage/list'), api.get('/admin/coupons'), api.get('/admin/messages'), api.get('/admin/requests')])
    .then(([r, u, o, di, a, m, c, ms, rq]) => setD({ reports: r.data, users: u.data, orders: o.data, disputes: di.data, areas: a.data, maint: m.data, coupons: c.data, messages: ms.data, requests: rq.data }));
  useEffect(() => { run(load); }, []);
  const act = (fn, ok) => run(async () => { await fn(); await load(); }, ok);
  const r = d.reports;
  const kpis = r && [['Active rentals', r.activeRentals], ['Monthly recurring revenue', money(r.mrr)], ['Total collected', money(r.revenue)], ['Product utilization', r.utilizationRate + '%'],
    ['Customer retention', r.retentionRate + '%'], ['Avg maintenance resolution', r.avgMaintenanceHours + ' hrs'], ['Open maintenance', r.openMaintenance], ['Open disputes', r.openDisputes],
    ['KYC awaiting review', r.pendingKyc], ['New messages', r.newMessages], ['New service requests', r.newRequests], ['Damage charges collected', money(r.damageRevenue)], ['Total orders', r.totalOrders], ['Customers', r.totalUsers], ['Listings', r.totalProducts]];
  const tabs = [['reports', 'Reports'], ['orders', 'Orders'], ['maintenance', 'Maintenance'], ['disputes', 'Disputes'], ['users', 'Users and KYC'], ['coupons', 'Coupons'], ['areas', 'Cities'], ['requests', 'Requests'], ['messages', 'Messages']];
  const kyc = (u, status) => act(() => api.put(`/admin/users/${u._id}/kyc`, { status, note: status === 'rejected' ? prompt('Reason for rejection') || '' : '' }));
  return (
    <>
      <h1>Admin dashboard</h1>{box}
      <div className="tabs">{tabs.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'reports' && <div className="kpis">{kpis?.map(([l, v]) => <div className="kpi" key={l}><span className="muted">{l}</span><b>{v}</b></div>)}</div>}
      {tab === 'orders' && <Orders orders={d.orders} act={act} />}
      {tab === 'maintenance' && <MaintTable list={d.maint} act={act} />}
      {tab === 'disputes' && (!d.disputes.length ? <p>No disputes.</p> : d.disputes.map(x => (
        <div className="card pad" key={x._id} style={{ marginBottom: 10 }}>
          <div className="row" style={{ marginTop: 0 }}><Tag s={x.status} /><span className="tag">{x.type.replace('_', ' ')}</span><b>{x.user?.name}</b><span className="muted">{fdate(x.createdAt)}</span></div>
          <p>{x.message}</p>{x.resolution && <p className="muted">Resolution: {x.resolution}</p>}
          {x.status === 'open' && <div className="row">
            <button onClick={() => { const t = prompt('Resolution note'); t !== null && act(() => api.put('/disputes/' + x._id, { status: 'resolved', resolution: t })); }}>Resolve</button>
            <button className="danger" onClick={() => { const t = prompt('Reason for rejecting'); t !== null && act(() => api.put('/disputes/' + x._id, { status: 'rejected', resolution: t })); }}>Reject</button></div>}
        </div>)))}
      {tab === 'users' && <div className="scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>City</th><th>KYC</th><th>Joined</th><th></th></tr></thead><tbody>
        {d.users.map(u => <tr key={u._id}><td>{u.name}</td><td>{u.email}</td><td>{u.role}</td><td>{u.city}</td>
          <td>{u.role === 'user' ? <><Tag s={u.kyc?.status || 'none'} />{u.kyc?.docType && <div className="muted">{u.kyc.docType} {u.kyc.docNumber}</div>}</> : '–'}</td><td>{fdate(u.createdAt)}</td>
          <td>{u.kyc?.status === 'pending' && <><button onClick={() => kyc(u, 'verified')}>Approve KYC</button> <button className="alt" onClick={() => kyc(u, 'rejected')}>Reject</button> </>}
            {u.role !== 'admin' && <button className={u.active ? 'danger' : ''} onClick={() => act(() => api.put(`/admin/users/${u._id}/toggle`))}>{u.active ? 'Deactivate' : 'Activate'}</button>}</td></tr>)}
      </tbody></table></div>}
      {tab === 'coupons' && <>
        <form className="card pad" style={{ marginBottom: 16 }} onSubmit={e => { e.preventDefault(); act(() => api.post('/admin/coupons', { ...cp, value: +cp.value, minOrder: +cp.minOrder || 0, maxDiscount: +cp.maxDiscount || undefined }), 'Coupon added').then(() => setCp(blank)); }}>
          <h3 style={{ marginTop: 0 }}>Add coupon</h3>
          <div className="bar"><input required placeholder="CODE" value={cp.code} onChange={e => setCp({ ...cp, code: e.target.value.toUpperCase() })} aria-label="Code" />
            <select value={cp.type} onChange={e => setCp({ ...cp, type: e.target.value })} aria-label="Type"><option value="percent">Percent off</option><option value="flat">Flat ₹ off</option></select>
            <input required type="number" placeholder="Value" value={cp.value} onChange={e => setCp({ ...cp, value: e.target.value })} aria-label="Value" />
            <input type="number" placeholder="Min monthly rent" value={cp.minOrder} onChange={e => setCp({ ...cp, minOrder: e.target.value })} aria-label="Minimum order" />
            <input type="number" placeholder="Max discount" value={cp.maxDiscount} onChange={e => setCp({ ...cp, maxDiscount: e.target.value })} aria-label="Maximum discount" /></div>
          <input placeholder="Description shown to customers" value={cp.description} onChange={e => setCp({ ...cp, description: e.target.value })} aria-label="Description" />
          <div className="row"><button>Add coupon</button></div></form>
        <div className="scroll"><table><thead><tr><th>Code</th><th>Offer</th><th>Min rent</th><th>Active</th><th></th></tr></thead><tbody>
          {d.coupons.map(c => <tr key={c._id}><td><b>{c.code}</b></td><td>{c.description}</td><td>{money(c.minOrder)}</td><td><Tag s={c.active ? 'active' : 'cancelled'} /></td>
            <td><button className="alt" onClick={() => act(() => api.put('/admin/coupons/' + c._id, { active: !c.active }))}>{c.active ? 'Disable' : 'Enable'}</button> <button className="danger" onClick={() => act(() => api.delete('/admin/coupons/' + c._id))}>Delete</button></td></tr>)}</tbody></table></div></>}
      {tab === 'areas' && <>
        <p className="muted">These are popular-city shortcuts. Lenders control delivery coverage; this list does not restrict service across India.</p>
        <form className="row" onSubmit={e => { e.preventDefault(); act(() => api.post('/areas', { name: area }), 'City added').then(() => setArea('')); }}>
          <input placeholder="City name" value={area} onChange={e => setArea(e.target.value)} required style={{ maxWidth: 260 }} aria-label="City name" /><button>Add city</button></form>
        <div className="row">{d.areas.map(a => <span className="tag" key={a._id} style={{ textTransform: 'capitalize' }}>{a.name} <button className="link" style={{ color: 'var(--bad)' }} aria-label={'Remove ' + a.name} onClick={() => act(() => api.delete('/areas/' + a._id))}>×</button></span>)}</div></>}
      {tab === 'requests' && (!d.requests.length ? <p>No requests.</p> : <div className="scroll"><table><thead><tr><th>Type</th><th>Contact</th><th>City</th><th>Details</th><th>Status</th><th></th></tr></thead><tbody>
        {d.requests.map(x => <tr key={x._id}><td>{x.type}</td><td>{x.name}<div className="muted">{x.phone} {x.email}</div></td><td style={{ textTransform: 'capitalize' }}>{x.city}</td>
          <td className="muted">{Object.entries(x.details || {}).map(([k, v]) => `${k}: ${v}`).join(' · ')}</td><td><Tag s={x.status} /></td>
          <td>{x.status === 'new' && <button className="alt" onClick={() => act(() => api.put('/admin/requests/' + x._id, { status: 'contacted' }))}>Mark contacted</button>}
            {x.status !== 'closed' && <button style={{ marginLeft: 4 }} onClick={() => act(() => api.put('/admin/requests/' + x._id, { status: 'closed' }))}>Close</button>}</td></tr>)}</tbody></table></div>)}
      {tab === 'messages' && (!d.messages.length ? <p>No messages.</p> : d.messages.map(m => <div className="card pad" key={m._id} style={{ marginBottom: 8 }}>
        <div className="row" style={{ marginTop: 0 }}><Tag s={m.status} /><b>{m.name}</b><span className="muted">{m.email} {m.phone} · {fdate(m.createdAt)}</span></div><p>{m.message}</p>
        {m.status === 'new' && <button className="alt" onClick={() => act(() => api.put('/admin/messages/' + m._id, { status: 'done' }))}>Mark done</button>}</div>))}
    </>
  );
}
