import { useState } from 'react';
import api from '../api';
import { money } from '../api';
import { useAuth, useCity } from '../context.jsx';
import PillBand from '../components/PillBand.jsx';
import { useFlash } from '../ui.jsx';

const SIZES = { '1 RK': 2999, '1 BHK': 4999, '2 BHK': 7499, '3 BHK': 10999 };
export default function Relocation() {
  const { city } = useCity(), { user } = useAuth(), [box, run] = useFlash();
  const [f, setF] = useState({ from: city, to: city, home: '1 BHK', date: '', name: user?.name === 'New user' ? '' : user?.name || '', phone: user?.phone || '' });
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const estimate = Math.round(SIZES[f.home] * (f.from && f.to && f.from !== f.to ? 2.5 : 1));
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <PillBand crumbs={[['Home', '/'], ['Relocation']]} />
      <div className="pagehead"><h1>Shifting homes made easy</h1><p>Packing, loading, transport and unloading with transparent prices. Moving your RentEase rentals within the city is free.</p></div>
      <div className="wrap two">
        <div><h2>How it works</h2><ol className="muted" style={{ lineHeight: 2 }}><li>Tell us your move details and get an instant estimate.</li><li>Our team calls to confirm a free home survey.</li><li>We pack, move and unpack on your chosen date.</li></ol>
          <div className="perkrow"><span>📦 Quality packing material</span><span>🛡️ Damage cover</span><span>📍 Live tracking</span></div></div>
        <form className="card pad" onSubmit={e => { e.preventDefault(); run(async () => { await api.post('/requests', { type: 'relocation', name: f.name, phone: f.phone, city: f.from, details: { from: f.from, to: f.to, home: f.home, date: f.date, estimate } }); }, 'Request received! Our team will call you within one working day.'); }}>
          <h3 style={{ marginTop: 0 }}>Get an estimate</h3>{box}
          <div className="bar"><div><label>Moving from</label><input required value={f.from} onChange={set('from')} placeholder="Any Indian city" /></div>
            <div><label>Moving to</label><input required value={f.to} onChange={set('to')} placeholder="Any Indian city" /></div></div>
          <div className="bar"><div><label>Home size</label><select value={f.home} onChange={set('home')}>{Object.keys(SIZES).map(s => <option key={s}>{s}</option>)}</select></div>
            <div><label>Move date</label><input type="date" required min={today} value={f.date} onChange={set('date')} /></div></div>
          <p className="price" style={{ margin: '10px 0' }}>Estimated cost {money(estimate)}<small> (final quote after survey)</small></p>
          <label>Your name</label><input required value={f.name} onChange={set('name')} /><label>Mobile number</label><input required inputMode="numeric" maxLength={10} value={f.phone} onChange={e => setF({ ...f, phone: e.target.value.replace(/\D/g, '') })} />
          <div className="row"><button>Request a call back</button></div>
        </form>
      </div>
    </>
  );
}
