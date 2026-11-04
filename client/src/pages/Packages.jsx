import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { money, errMsg } from '../api';
import { useCart, useCity } from '../context.jsx';
import PillBand from '../components/PillBand.jsx';

export default function Packages({ plans }) {
  const { city, locationParams } = useCity(), { addMany } = useCart(), [list, setList] = useState([]), [error, setError] = useState(''), nav = useNavigate();
  useEffect(() => { let active = true; setList([]); setError(''); api.get('/packages', { params: { ...locationParams, kind: plans ? 'plan' : 'package' } }).then(r => { if (active) setList(r.data); }).catch(e => { if (active) setError(errMsg(e)); }); return () => { active = false; }; }, [locationParams, plans]);
  const addPack = p => { addMany(p.items.map(product => ({ product, tenure: product.tenureOptions.includes(6) ? 6 : product.tenureOptions[0], qty: 1, bundle: { slug: p.slug, pct: p.discountPercent } }))); nav('/cart'); };
  return (
    <>
      {error && <p className="msg err" role="alert">Could not load packages: {error}</p>}
      <PillBand crumbs={[['Home', '/'], [plans ? 'RentEase Plus' : 'Packages']]} />
      <div className="pagehead"><h1>{plans ? 'RentEase Plus' : 'Packages'}</h1><p>{plans ? 'Full home furnishing on one monthly plan, with free swaps' : 'Rent a complete setup in one go and save on monthly rent'}</p></div>
      <div className="wrap"><div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(310px,1fr))' }}>
        {list.map(p => (
          <div className="pk" key={p._id}>
            <div className="row between" style={{ marginTop: 0 }}><h3 style={{ margin: 0 }}>{p.name}</h3><span className="tag">Save {p.discountPercent}%</span></div>
            <p className="muted">{p.tagline}</p>
            {plans && <ul className="feat">{p.features.map(f => <li key={f}>✓ {f}</li>)}</ul>}
            <ul>{(p.items.length ? p.items : []).map(i => <li key={i._id}>{i.name}</li>)}</ul>
            {p.available ? <>
              <div className="price">{money(p.rent)}<small>/month</small> <s className="muted">{money(p.originalRent)}</s></div>
              <div className="muted">6 month plan · Deposit {money(p.deposit)} (refundable)</div>
              <div className="row"><button onClick={() => addPack(p)}>{plans ? 'Rent now' : 'Add package to cart'}</button></div></>
              : <p className="muted">Not fully available in <span style={{ textTransform: 'capitalize' }}>{city}</span> right now.</p>}
          </div>))}
      </div></div>
    </>
  );
}
