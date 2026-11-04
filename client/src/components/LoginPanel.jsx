import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { errMsg, home } from '../api';
import { useAuth } from '../context.jsx';

const SLIDES = ['Rent Commitment Free', 'Free maintenance and relocation', 'Refundable security deposit'];

export default function LoginPanel({ onDone, art }) {
  const { login, refresh } = useAuth(), nav = useNavigate();
  const [mode, setMode] = useState('phone'), [step, setStep] = useState('phone'), [slide, setSlide] = useState(0);
  const [phone, setPhone] = useState(''), [agree, setAgree] = useState(false), [otp, setOtp] = useState(''), [dev, setDev] = useState(''), [wait, setWait] = useState(0);
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false), [prof, setProf] = useState({ name: '', email: '', code: '' }), [em, setEm] = useState({ email: '', password: '' });
  useEffect(() => { if (wait <= 0) return; const t = setTimeout(() => setWait(w => w - 1), 1000); return () => clearTimeout(t); }, [wait]);
  useEffect(() => { const t = setInterval(() => setSlide(s => (s + 1) % SLIDES.length), 3500); return () => clearInterval(t); }, []);
  const go = async fn => { setErr(''); setBusy(true); try { await fn(); } catch (e) { setErr(errMsg(e)); } setBusy(false); };
  const done = u => { onDone?.(u); if (u.role !== 'user') nav(home(u)); };
  const valid = /^[6-9]\d{9}$/.test(phone);
  const send = e => { e?.preventDefault(); go(async () => { const { data } = await api.post('/auth/phone/send', { phone, consent: agree }); setDev(data.devOtp || ''); setStep('otp'); setWait(30); }); };
  const verify = e => { e.preventDefault(); go(async () => {
    const { data } = await api.post('/auth/phone/verify', { phone, otp }); login(data.token, data.user);
    if (data.isNew || data.user.name === 'New user') setStep('profile'); else done(data.user);
  }); };
  const saveProfile = e => { e.preventDefault(); go(async () => {
    await api.put('/auth/profile', { name: prof.name, email: prof.email || undefined });
    if (prof.code) { try { await api.post('/auth/referral', { code: prof.code }); } catch (x) { await refresh(); throw x; } }
    done(await refresh());
  }); };
  const emailLogin = e => { e.preventDefault(); go(async () => {
    try { const { data } = await api.post('/auth/login', em); login(data.token, data.user); done(data.user); }
    catch (ex) { const d = ex.response?.data; if (d?.needsVerification) { onDone?.(); nav('/verify', { state: { email: d.email, devOtp: d.devOtp } }); return; } throw ex; }
  }); };

  return (
    <div className={'lp' + (art ? ' withart' : '')}>
      {art && <div className="lart"><div className="blob" aria-hidden="true">🛋️</div><h3>{SLIDES[slide]}</h3><div className="ldots" aria-hidden="true">{SLIDES.map((_, i) => <i key={i} className={i === slide ? 'on' : ''} />)}</div></div>}
      <div className="lform">
        {err && <div className="msg err" role="alert">{err}</div>}
        {mode === 'phone' && step === 'phone' && <form onSubmit={send}>
          <h2>Login to <span style={{ color: 'var(--brand)' }}>RentEase</span></h2><p className="muted">Enter phone number for OTP verification</p>
          <div className="phone"><span>+91</span><input type="tel" inputMode="numeric" autoFocus maxLength={10} placeholder="Enter Phone Number" aria-label="Phone number" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} /></div>
          <div className="consent"><b>SERVICE CONSENT</b><p>By continuing, you allow RentEase to use your phone number to create and secure your account, verify your identity with a one-time code, and send order and service updates. <Link to="/privacy" onClick={() => onDone?.()}>Read the privacy notice</Link>.</p></div>
          <label className="agree"><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />I agree to the <Link to="/terms" onClick={() => onDone?.()}>Terms &amp; Conditions</Link> and acknowledge the <Link to="/privacy" onClick={() => onDone?.()}>Privacy Policy</Link></label>
          <button style={{ width: '100%' }} disabled={!valid || !agree || busy}>{busy ? 'SENDING…' : 'CONTINUE'}</button>
          <p className="muted" style={{ textAlign: 'center' }}><button type="button" className="link" onClick={() => { setMode('email'); setErr(''); }}>Use email and password instead</button></p>
        </form>}
        {mode === 'phone' && step === 'otp' && <form onSubmit={verify}>
          <h2>Verify your number</h2><p className="muted">Enter the 6-digit code sent to +91 {phone}</p>
          {dev && <p className="msg">Dev mode, no SMS service set up. Your code is <b>{dev}</b></p>}
          <input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus aria-label="6-digit code" style={{ letterSpacing: '.4em', fontSize: '1.3rem', textAlign: 'center' }} />
          <div className="row"><button disabled={otp.length !== 6 || busy}>{busy ? 'VERIFYING…' : 'VERIFY'}</button>
            <button type="button" className="alt" disabled={wait > 0 || busy} onClick={send}>{wait > 0 ? `Resend in ${wait}s` : 'Resend code'}</button></div>
          <p className="muted"><button type="button" className="link" onClick={() => { setStep('phone'); setOtp(''); setErr(''); }}>Change number</button></p>
        </form>}
        {mode === 'phone' && step === 'profile' && <form onSubmit={saveProfile}>
          <h2>Welcome! Tell us about you</h2><p className="muted">This helps with delivery and your invoices.</p>
          <label>Full name</label><input required autoFocus value={prof.name} onChange={e => setProf({ ...prof, name: e.target.value })} />
          <label>Email (optional)</label><input type="email" value={prof.email} onChange={e => setProf({ ...prof, email: e.target.value })} />
          <label>Referral code (optional, you both get ₹200 credit)</label><input value={prof.code} onChange={e => setProf({ ...prof, code: e.target.value.toUpperCase() })} />
          <div className="row"><button disabled={busy}>Save and continue</button><button type="button" className="alt" onClick={async () => done(await refresh())}>Skip for now</button></div>
        </form>}
        {mode === 'email' && <form onSubmit={emailLogin}>
          <h2>Login with email</h2><p className="muted">For vendors, admins and email accounts.</p>
          <label>Email</label><input type="email" required autoFocus value={em.email} onChange={e => setEm({ ...em, email: e.target.value })} />
          <label>Password</label><input type="password" required value={em.password} onChange={e => setEm({ ...em, password: e.target.value })} />
          <p style={{ margin: '8px 0' }}><Link to="/forgot" onClick={() => onDone?.()}>Forgot password?</Link> · <Link to="/register" onClick={() => onDone?.()}>Sign up with email</Link></p>
          <button style={{ width: '100%' }} disabled={busy}>{busy ? 'LOGGING IN…' : 'LOGIN'}</button>
          <p className="muted" style={{ textAlign: 'center' }}><button type="button" className="link" onClick={() => { setMode('phone'); setStep('phone'); setErr(''); }}>Use phone number instead</button></p>
        </form>}
      </div>
    </div>
  );
}
