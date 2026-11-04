import { useEffect, useState } from 'react';
import api, { fdate, money } from '../api';
import { Tag, useFlash } from '../ui.jsx';
import CoverageEditor from '../components/CoverageEditor.jsx';

const blank = { name: '', category: 'furniture', type: '', brand: '', capacity: '', description: '', image: '', monthlyRent: '', securityDeposit: '', tenureOptions: '3,6,9,12', stock: 1, city: '', coverage: { mode: 'city' } };
const next = { placed: [['scheduled', 'Confirm delivery']], scheduled: [['active', 'Mark delivered']], active: [['returned', 'Mark returned'], ['damaged', 'Returned damaged']], return_requested: [['returned', 'Mark picked up'], ['damaged', 'Picked up damaged']] };

export function Orders({ orders, act }) {
  return !orders.length ? <p>No orders yet.</p> : (
    <div className="scroll"><table><thead><tr><th>Customer</th><th>Items</th><th>Delivery</th><th>Monthly</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      {orders.map(o => <tr key={o._id}>
        <td>{o.user?.name}<div className="muted">{o.user?.phone}</div><div className="muted">KYC: {o.user?.kyc?.status || 'none'} · {o.paymentStatus}</div></td>
        <td>{o.items.map(i => `${i.name} ×${i.qty}`).join(', ')}</td>
        <td>{fdate(o.deliveryDate)}<div className="muted">{o.address}, {o.city}</div>{o.pickupDate && <div className="muted">Pickup {fdate(o.pickupDate)}</div>}</td>
        <td>{money(o.totalMonthly)}</td>
        <td><Tag s={o.status} />{o.damageCharge > 0 && <div className="muted">Charge {money(o.damageCharge)}</div>}</td>
        <td>{(next[o.status] || []).map(([s, l]) => <button key={s} style={{ margin: 2 }} className={s === 'damaged' ? 'danger' : ''}
          onClick={() => { const body = { status: s }; if (s === 'damaged') { const c = prompt(`Damage charge (max deposit ${o.totalDeposit})`, '0'); if (c === null) return; body.damageCharge = +c; } act(() => api.put(`/orders/${o._id}/status`, body)); }}>{l}</button>)}</td>
      </tr>)}
    </tbody></table></div>
  );
}

export function MaintTable({ list, act }) {
  return !list.length ? <p>No maintenance requests.</p> : (
    <div className="scroll"><table><thead><tr><th>Customer</th><th>Problem</th><th>Raised</th><th>Status</th><th></th></tr></thead><tbody>
      {list.map(m => <tr key={m._id}><td>{m.user?.name}<div className="muted">{m.user?.phone}</div></td><td>{m.description}<div className="muted">{m.order?.address}</div></td>
        <td>{fdate(m.createdAt)}</td><td><Tag s={m.status} /></td>
        <td>{m.status === 'open' && <button onClick={() => act(() => api.put('/maintenance/' + m._id, { status: 'in_progress' }))}>Start</button>}
          {m.status !== 'resolved' && <button className="alt" style={{ marginLeft: 4 }} onClick={() => act(() => api.put('/maintenance/' + m._id, { status: 'resolved' }))}>Resolve</button>}</td></tr>)}
    </tbody></table></div>
  );
}

export default function Vendor() {
  const [tab, setTab] = useState('inventory'), [products, setProducts] = useState([]), [orders, setOrders] = useState([]), [maint, setMaint] = useState([]);
  const [form, setForm] = useState(blank), [editing, setEditing] = useState(null), [box, run] = useFlash();
  const load = () => Promise.all([api.get('/products/mine/list'), api.get('/orders/manage/list'), api.get('/maintenance/manage/list')])
    .then(([p, o, m]) => { setProducts(p.data); setOrders(o.data); setMaint(m.data); });
  useEffect(() => { run(load); }, []);
  const act = (fn, ok) => run(async () => { await fn(); await load(); }, ok);
  const set = k => e => setForm({ ...form, [k]: e.target.value });
  const save = e => { e.preventDefault();
    const coverage = form.coverage || { mode: 'city' };
    const body = { ...form, coverage: { ...coverage, ...(['cities', 'states', 'pincodes'].includes(coverage.mode) ? { [coverage.mode]: (coverage[coverage.mode] || []).map(s => s.trim()).filter(Boolean) } : {}) }, monthlyRent: +form.monthlyRent, securityDeposit: +form.securityDeposit, stock: +form.stock,
      tenureOptions: String(form.tenureOptions).split(',').map(Number).filter(Boolean) };
    act(() => editing ? api.put('/products/' + editing, body) : api.post('/products', body), editing ? 'Product updated' : 'Product added')
      .then(ok => { if (ok) { setForm(blank); setEditing(null); } }); };
  const edit = p => { setEditing(p._id); setForm({ ...p, tenureOptions: p.tenureOptions.join(',') }); window.scrollTo(0, 0); };

  return (
    <>
      <h1>Vendor desk</h1>{box}
      <div className="tabs">{[['inventory', 'Inventory'], ['orders', 'Deliveries and returns'], ['maintenance', 'Maintenance']].map(([k, l]) =>
        <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'inventory' && <>
        <form className="card pad" onSubmit={save} style={{ marginBottom: 20 }}>
          <h3>{editing ? 'Edit product' : 'Add a product'}</h3>
          <div className="two">
            <div><label>Name</label><input required value={form.name} onChange={set('name')} />
              <label>Category</label><select value={form.category} onChange={set('category')}><option value="furniture">Furniture</option><option value="appliance">Appliance</option><option value="babykids">Baby &amp; Kids</option><option value="electronics">Electronics</option><option value="fitness">Fitness</option><option value="others">Others</option></select>
              <label>Type (bed, sofa, fridge…)</label><input value={form.type || ''} onChange={set('type')} />
              <label>Image URL</label><input value={form.image || ''} onChange={set('image')} />
              <label>Brand</label><input value={form.brand || ''} onChange={set('brand')} /><label>Capacity (e.g. 1.5 Ton, 260 L)</label><input value={form.capacity || ''} onChange={set('capacity')} />
              <label>Description</label><textarea rows={2} value={form.description || ''} onChange={set('description')} /></div>
            <div><label>Monthly rent for a 3-month tenure (₹)</label><input type="number" required min="1" value={form.monthlyRent} onChange={set('monthlyRent')} />
              <label>Security deposit (₹)</label><input type="number" min="0" value={form.securityDeposit} onChange={set('securityDeposit')} />
              <label>Tenure options in months (comma separated)</label><input value={form.tenureOptions} onChange={set('tenureOptions')} />
              <label>Total stock</label><input type="number" min="0" value={form.stock} onChange={set('stock')} />
               <label>Origin city in India</label><input required value={form.city || ''} onChange={set('city')} />
               <CoverageEditor value={form.coverage || { mode: 'city' }} onChange={coverage => setForm({ ...form, coverage })} /></div>
          </div>
          <div className="row"><button>{editing ? 'Save changes' : 'Add product'}</button>
            {editing && <button type="button" className="alt" onClick={() => { setEditing(null); setForm(blank); }}>Cancel</button>}</div>
        </form>
        <div className="scroll"><table><thead><tr><th>Product</th><th>Rent</th><th>Deposit</th><th>Tenures</th><th>Available / Stock</th><th>City</th><th></th></tr></thead><tbody>
          {products.map(p => <tr key={p._id}><td>{p.name}</td><td>{money(p.monthlyRent)}</td><td>{money(p.securityDeposit)}</td><td>{p.tenureOptions.join(', ')}m</td>
             <td>{p.available} / {p.stock}</td><td>{p.city}<div className="muted">Coverage: {p.coverage?.mode || 'city'}</div></td>
            <td><button className="alt" onClick={() => edit(p)}>Edit</button> <button className="danger" onClick={() => confirm('Delete product?') && act(() => api.delete('/products/' + p._id), 'Deleted')}>Delete</button></td></tr>)}
        </tbody></table></div></>}
      {tab === 'orders' && <Orders orders={orders} act={act} />}
      {tab === 'maintenance' && <MaintTable list={maint} act={act} />}
    </>
  );
}
