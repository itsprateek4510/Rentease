import { useEffect, useState } from 'react';
import api from '../api';
import { useCity } from '../context.jsx';
import PillBand from '../components/PillBand.jsx';

export default function Stores() {
  const { city, areas } = useCity(), [sel, setSel] = useState(city || ''), [list, setList] = useState([]);
  useEffect(() => { api.get('/stores', { params: sel ? { city: sel } : {} }).then(r => setList(r.data)); }, [sel]);
  return (
    <>
      <PillBand crumbs={[['Home', '/'], ['Stores']]} />
      <div className="pagehead"><h1>Experience stores</h1><p>See, touch and try our products before you rent</p></div>
      <div className="wrap">
        <label htmlFor="sc">City</label><select id="sc" value={sel} onChange={e => setSel(e.target.value)} style={{ maxWidth: 260, textTransform: 'capitalize' }}><option value="">All cities</option>{areas.map(a => <option key={a._id} value={a.name}>{a.name}</option>)}</select>
        <div className="grid" style={{ marginTop: 16 }}>{list.map(s => <div className="card pad" key={s._id}><h3 style={{ marginTop: 0 }}>{s.name}</h3><p className="muted">📍 {s.address}<br />📞 {s.phone}<br />🕙 {s.hours}</p>
          <a className="btn alt" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`}>Get directions</a></div>)}</div>
        {!list.length && <p>No stores in this city yet.</p>}
        <p className="muted">Store details are demo data.</p>
      </div>
    </>
  );
}
