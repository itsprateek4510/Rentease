import { useState } from 'react';
import api from '../api';
import { useCity } from '../context.jsx';
import PillBand from '../components/PillBand.jsx';
import { useFlash } from '../ui.jsx';

export default function Business() {
  const { areas, city } = useCity(), [box, run] = useFlash(), [f, setF] = useState({ company: '', name: '', phone: '', email: '', city, units: '', need: '' }), set = k => e => setF({ ...f, [k]: e.target.value });
  return (
    <>
      <PillBand crumbs={[['Home', '/'], ['Business solutions']]} />
      <div className="pagehead"><h1>Business solutions</h1><p>Furnish offices, co-living spaces, hostels and rental homes without the capex</p></div>
      <div className="wrap two">
        <div><h2>Why businesses rent</h2><ul className="muted" style={{ lineHeight: 2 }}><li>Bulk pricing and custom tenures</li><li>One invoice, one point of contact</li><li>Free maintenance and replacement</li><li>Scale up or down as your team changes</li></ul></div>
        <form className="card pad" onSubmit={e => { e.preventDefault(); run(async () => { await api.post('/requests', { type: 'business', name: f.name, phone: f.phone, email: f.email, city: f.city, details: { company: f.company, units: +f.units || undefined, need: f.need } }); }, 'Request received! Our team will call you within one working day.'); }}>
          <h3 style={{ marginTop: 0 }}>Request a quote</h3>{box}
          <label>Company</label><input required value={f.company} onChange={set('company')} /><label>Your name</label><input required value={f.name} onChange={set('name')} />
          <div className="bar"><div><label>Mobile number</label><input required inputMode="numeric" maxLength={10} value={f.phone} onChange={e => setF({ ...f, phone: e.target.value.replace(/\D/g, '') })} /></div><div><label>Work email</label><input type="email" value={f.email} onChange={set('email')} /></div></div>
          <div className="bar"><div><label>City</label><select value={f.city} onChange={set('city')} style={{ textTransform: 'capitalize' }}>{areas.map(a => <option key={a._id} value={a.name}>{a.name}</option>)}</select></div><div><label>Number of units or seats</label><input type="number" min="1" value={f.units} onChange={set('units')} /></div></div>
          <label>What do you need?</label><textarea required rows={3} value={f.need} onChange={set('need')} />
          <div className="row"><button>Request a quote</button></div>
        </form>
      </div>
    </>
  );
}
