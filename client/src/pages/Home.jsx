import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { ALL_TYPES, CAT_OF, money } from '../api';
import { useCity } from '../context.jsx';
import { ProductCard } from '../ui.jsx';

const ORDER = ['@packages', 'purifier', 'bed', 'sofa', 'mattress', 'wardrobe', 'fridge', 'tv', 'washing machine', 'ac', 'chair', 'study table', 'center table', 'bedside table', 'drawers'];
const tile = k => k === '@packages' ? { to: '/packages', label: 'Packages', em: '📦' } : (() => { const t = ALL_TYPES.find(x => x[0] === k); return { to: `/listings?category=${CAT_OF[k]}&type=${encodeURIComponent(k)}`, label: t[1], em: t[2] }; })();
const perks = [['Free maintenance', 'Any repair or replacement during your rental is on us.'], ['Free relocation', 'Moving within the city? We shift your rentals at no cost.'], ['Refundable deposit', 'A small security deposit, returned after pickup.'], ['Flexible tenure', 'Rent for 1 to 12 months and extend whenever you want.'], ['Verified quality', 'Every item is cleaned and quality-checked before delivery.']];
const steps = [['Choose your city and products', 'Prices and availability are shown for your city.'], ['Pick a tenure', 'The longer you rent, the lower your monthly rent.'], ['Complete KYC and pay', 'Quick ID check, then pay the first month and a refundable deposit.'], ['Doorstep delivery', 'We deliver and set everything up on your chosen date.'], ['Extend, upgrade or return', 'Extend any time or schedule a free pickup when you move.']];
const quotes = [['Moved to Bengaluru for work and had a bed, fridge and washing machine in two days.', 'Priya N., software engineer'], ['As a student, a monthly plan beats buying furniture I would leave behind.', 'Aarav S., MBA student'], ['Our fridge was fixed the next day. No calls, no hassle.', 'Rohan M., working professional']]; // sample feedback
const faqs = [['How does the deposit work?', 'It is a refundable amount per item. After pickup and inspection it is returned to you, minus any damage charge.'], ['Can I extend or return early?', 'Yes. Extend from My rentals, or schedule a pickup date when you want to return.'], ['What is KYC and why is it needed?', 'We verify an ID document before delivery. Submit it from your Account page.'], ['Do longer tenures cost less?', 'Yes. A 12-month plan costs 20% less per month than a 3-month plan.']];

export default function Home() {
  const { city } = useCity(), [products, setProducts] = useState([]), [packs, setPacks] = useState([]), [plans, setPlans] = useState([]), [coupons, setCoupons] = useState([]), [more, setMore] = useState(false), [i, setI] = useState(0);
  useEffect(() => { if (!city) return; api.get('/products', { params: { city } }).then(r => setProducts(r.data)); api.get('/packages', { params: { city } }).then(r => setPacks(r.data)); api.get('/packages', { params: { city, kind: 'plan' } }).then(r => setPlans(r.data)); }, [city]);
  useEffect(() => { api.get('/coupons').then(r => setCoupons(r.data)); }, []);
  const minOf = l => { const v = l.filter(p => p.available).map(p => p.rent); return v.length ? Math.min(...v) : 0; };
  const slides = [
    { k: 'Plus by RentEase', t: 'Full home furnishing.', s: plans.length ? `Plans starting at ${money(minOf(plans))}/mo` : 'Plans for 1 RK, 1 BHK and 2 BHK homes', cta: 'Rent now', to: '/plans', q: 'livingroom,sofa/all?lock=21' },
    { k: 'Packages', t: 'Checkout our Packages', s: packs.length ? `Starting from ${money(minOf(packs))}/mo` : 'Bundles for students, bachelors and families', cta: 'Rent packages now', to: '/packages', q: 'apartment,interior/all?lock=22' },
    { k: 'Relocation', t: 'Shifting homes made easy', s: 'Packers and movers with transparent prices', cta: 'Know more', to: '/relocation', q: 'moving,boxes/all?lock=23' },
    { k: 'Business', t: 'Furnish offices and co-living spaces', s: 'Bulk rentals with dedicated support', cta: 'Get a quote', to: '/business', q: 'office,interior/all?lock=24' }
  ];
  useEffect(() => { const t = setInterval(() => setI(x => (x + 1) % 4), 6000); return () => clearInterval(t); }, []);
  const top = [...products].sort((a, b) => b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount).slice(0, 8);
  const cheap = products.filter(p => p.monthlyRent * 0.8 < 500).slice(0, 8);
  const rest = ALL_TYPES.map(t => t[0]).filter(k => !ORDER.includes(k)), s = slides[i];
  return (
    <>
      <section className="sec" style={{ paddingBottom: 10 }}>
        <div className="homegrid">
          <Link className="promo" to="/listings?category=appliance&type=purifier" style={{ backgroundImage: 'linear-gradient(rgba(0,0,0,.2),rgba(0,0,0,.45)),url("https://loremflickr.com/600/700/kitchen,faucet/all?lock=3")' }}>
            <span className="ptag" aria-hidden="true" /><span className="plabel"><small>EXPLORE</small><br />WATER PURIFIERS ↗</span></Link>
          <div className="tiles5">{[...ORDER, ...(more ? rest : [])].map(k => { const t = tile(k); return <Link key={k} to={t.to} className="tl"><span className="em" aria-hidden="true">{t.em}</span><span>{t.label}</span></Link>; })}</div>
        </div>
        <p><button className="link" onClick={() => setMore(m => !m)} style={{ color: 'var(--ink)' }}>{more ? 'Show fewer categories ↑' : 'View More categories ↓'}</button></p>
      </section>

      <section className="sec" style={{ paddingTop: 10 }} aria-roledescription="carousel" aria-label="Offers">
        <div className="bn" style={{ backgroundImage: `url("https://loremflickr.com/1200/420/${s.q}")` }}>
          <div className="bnred"><div className="bnlogo">{s.k}</div><h2>{s.t}</h2><p>{s.s}</p><Link to={s.to} className="btn" style={{ background: '#fff', color: 'var(--brand)' }}>{s.cta}</Link></div>
          <button className="arr l" aria-label="Previous slide" onClick={() => setI((i + 3) % 4)}>‹</button><button className="arr r" aria-label="Next slide" onClick={() => setI((i + 1) % 4)}>›</button>
        </div>
      </section>

      {!!top.length && <section className="band"><div className="sec"><div className="row between"><h2>Top rated in <span style={{ textTransform: 'capitalize' }}>{city}</span></h2><Link to="/listings?sort=rating">View all</Link></div>
        <div className="rail">{top.map(p => <ProductCard key={p._id} p={p} />)}</div></div></section>}

      {!!packs.length && <section className="sec"><div className="row between"><h2>Packages</h2><Link to="/packages">View all</Link></div><p className="sub">Bundle your essentials and save on rent.</p>
        <div className="rail">{packs.map(p => <Link key={p._id} to="/packages" className="pk" style={{ textDecoration: 'none', color: 'inherit', flexBasis: 290 }}>
          <span className="tag">Save {p.discountPercent}%</span><h3>{p.name}</h3><p className="muted">{p.tagline}</p>
          {p.available ? <><div className="price">{money(p.rent)}<small>/mo</small> <s className="muted">{money(p.originalRent)}</s></div><div className="muted">{p.items.length} items · 6 month plan</div></> : <div className="muted">Not available in {city}</div>}</Link>)}</div></section>}

      {!!cheap.length && <section className="band"><div className="sec"><div className="row between"><h2>Under ₹500 a month</h2><Link to="/listings?sort=low">View all</Link></div>
        <div className="rail">{cheap.map(p => <ProductCard key={p._id} p={p} />)}</div></div></section>}

      <section className="dark"><div className="sec"><h2>Why RentEase</h2><p className="sub" style={{ color: '#c9cad1' }}>Live well without the cost and hassle of owning.</p>
        <div className="perks">{perks.map(([t, d]) => <div className="perk" key={t}><h3>{t}</h3><p>{d}</p></div>)}</div></div></section>

      <section className="sec"><h2>How it works</h2><div className="steps">{steps.map(([t, d], k) => <div className="step" key={t}><b>{k + 1}</b><h3 style={{ fontSize: '1rem' }}>{t}</h3><p>{d}</p></div>)}</div></section>

      {!!coupons.length && <section className="band"><div className="sec"><h2>Offers for you</h2><p className="sub">Apply these codes in your cart.</p>
        <div className="offers">{coupons.map(c => <div className="offer" key={c._id}><b>{c.code}</b><p>{c.description}</p></div>)}</div></div></section>}

      <section className="sec"><h2>What renters say</h2><p className="sub">Sample feedback from students and working professionals.</p>
        <div className="quotes">{quotes.map(([q, n]) => <div className="quote" key={n}><p>“{q}”</p><span>{n}</span></div>)}</div></section>

      <section className="band"><div className="sec"><h2>Frequently asked questions</h2>{faqs.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}<p><Link to="/faq">See all FAQs</Link></p></div></section>

      <section className="cta"><h2>Own furniture or appliances?</h2><p>List them on RentEase, set your own rent and manage deliveries, returns and maintenance from one dashboard.</p><Link to="/register" className="btn">Become a vendor</Link></section>
    </>
  );
}
