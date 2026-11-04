import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api, { home } from '../api';
import { useAuth } from '../context.jsx';
import { useFlash } from '../ui.jsx';

export default function Verify() {
  const { state } = useLocation(), nav = useNavigate(), { login } = useAuth(), [box, run] = useFlash();
  const [email, setEmail] = useState(state?.email || ''), [sent, setSent] = useState(!!state?.email), [otp, setOtp] = useState('');
  const [dev, setDev] = useState(state?.devOtp || ''), [wait, setWait] = useState(state?.email ? 60 : 0);
  useEffect(() => { if (wait <= 0) return; const t = setTimeout(() => setWait(w => w - 1), 1000); return () => clearTimeout(t); }, [wait]);
  const send = e => { e?.preventDefault(); run(async () => { const { data } = await api.post('/auth/send-otp', { email }); setSent(true); setDev(data.devOtp || ''); setWait(60); }, 'If that email is registered, a code is on its way'); };
  const verify = e => { e.preventDefault(); run(async () => {
    const { data } = await api.post('/auth/verify-otp', { email, otp });
    login(data.token, data.user);
    nav(home(data.user));
  }); };
  return (
    <div className="card pad narrow">
      <h2>{sent ? 'Enter your code' : 'Log in with an email code'}</h2>{box}
      {!sent ? (
        <form onSubmit={send}>
          <p className="muted">We'll email a 6-digit code. It also verifies new accounts.</p>
          <label>Email</label><input type="email" required value={email} onChange={e => setEmail(e.target.value)} />
          <div className="row"><button>Send code</button><Link to="/login">Use a password instead</Link></div>
        </form>
      ) : (
        <form onSubmit={verify}>
          <p className="muted">We sent a 6-digit code to {email}. It expires in 10 minutes.</p>
          {dev && <p className="msg">Dev mode, no email service set up. Your code is <b>{dev}</b></p>}
          <label>6-digit code</label>
          <input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}" required autoFocus
            style={{ letterSpacing: '.4em', fontSize: '1.3rem', textAlign: 'center' }} />
          <div className="row"><button>Verify and continue</button>
            <button type="button" className="alt" disabled={wait > 0} onClick={send}>{wait > 0 ? `Resend in ${wait}s` : 'Resend code'}</button></div>
          <p className="muted"><a href="#change" onClick={e => { e.preventDefault(); setSent(false); setOtp(''); }}>Use a different email</a></p>
        </form>
      )}
    </div>
  );
}
