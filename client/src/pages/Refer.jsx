import { useState } from 'react';
import api from '../api';
import { money } from '../api';
import { useAuth } from '../context.jsx';
import { useFlash } from '../ui.jsx';

export default function Refer() {
  const { user, refresh } = useAuth(), [code, setCode] = useState(''), [box, run] = useFlash(), [copied, setCopied] = useState(false);
  const msg = `Rent furniture and appliances on RentEase. Use my code ${user.referralCode} when you sign up and we both get ₹200 rent credit!`;
  return (
    <>
      <h1>Refer &amp; Earn</h1>
      <div className="two">
        <div className="card pad"><h3 style={{ marginTop: 0 }}>Your referral code</h3>
          <p className="price" style={{ fontSize: '2rem', letterSpacing: '.1em' }}>{user.referralCode}</p>
          <div className="row"><button onClick={() => { navigator.clipboard?.writeText(user.referralCode); setCopied(true); }}>{copied ? 'Copied!' : 'Copy code'}</button>
            <a className="btn alt" target="_blank" rel="noreferrer" href={'https://wa.me/?text=' + encodeURIComponent(msg)}>Share on WhatsApp</a></div>
          <p className="muted">When a friend signs up with your code, you both get ₹200 rent credit.</p></div>
        <div className="card pad"><h3 style={{ marginTop: 0 }}>Your rent credit</h3><p className="price" style={{ fontSize: '2rem' }}>{money(user.credits)}</p>
          <p className="muted">Use it at checkout to reduce your first month's rent.</p>
          <form onSubmit={e => { e.preventDefault(); run(async () => { await api.post('/auth/referral', { code }); await refresh(); setCode(''); }, '₹200 credit added to your account'); }}>
            {box}<label>Have a friend's code?</label><div className="row" style={{ marginTop: 0 }}><input value={code} onChange={e => setCode(e.target.value.toUpperCase())} style={{ maxWidth: 200 }} aria-label="Referral code" /><button className="alt">Apply</button></div>
            <p className="muted">Works only before your first order.</p></form></div>
      </div>
    </>
  );
}
