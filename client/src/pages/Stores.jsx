import { useEffect, useState } from 'react';
import api, { errMsg } from '../api';
import { useCity } from '../context.jsx';
import PillBand from '../components/PillBand.jsx';

export default function Stores() {
  const { city } = useCity(), [sel, setSel] = useState(city || ''), [list, setList] = useState([]), [error, setError] = useState('');
  useEffect(() => { let active = true; setError(''); api.get('/stores', { params: sel ? { city: sel } : {} }).then(r => { if (active) setList(r.data); }).catch(e => { if (active) setError(errMsg(e)); }); return () => { active = false; }; }, [sel]);
  return (
    <>
      <PillBand crumbs={[['Home', '/'], ['Stores']]} />
      <div className="pagehead"><h1>Experience stores</h1><p>See, touch and try our products before you rent</p></div>
      <div className="wrap">
        {error && <p className="msg err" role="alert">{error}</p>}
        <label htmlFor="sc">City (leave blank for all cities)</label><input id="sc" value={sel} onChange={e => setSel(e.target.value)} placeholder="Any Indian city" style={{ maxWidth: 260 }} />
        <div className="grid" style={{ marginTop: 16 }}>{list.map(s => <div className="card pad" key={s._id}><h3 style={{ marginTop: 0 }}>{s.name}</h3><p className="muted">📍 {s.address}<br />📞 {s.phone}<br />🕙 {s.hours}</p>
          <a className="btn alt" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`}>Get directions</a></div>)}</div>
        {!list.length && <p>No stores in this city yet.</p>}
        <p className="muted">Store details are demo data.</p>
      </div>
    </>
  );
}
