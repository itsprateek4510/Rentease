import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import { useFlash } from '../ui.jsx';

export default function Forgot({ reset }) {
  const { token } = useParams(), nav = useNavigate(), [v, setV] = useState(''), [box, run, setM] = useFlash(), [dev, setDev] = useState('');
  const submit = e => { e.preventDefault(); run(async () => {
    if (reset) { await api.post('/auth/reset-password/' + token, { password: v }); nav('/login'); }
    else { const { data } = await api.post('/auth/forgot-password', { email: v }); setM({ t: data.message }); setDev(data.devLink || ''); }
  }); };
  return (
    <form className="card pad narrow" onSubmit={submit}>
      <h2>{reset ? 'Choose a new password' : 'Reset your password'}</h2>{box}
      {!reset && <p className="muted">Enter your account email and we'll send a reset link that works for one hour.</p>}
      <label>{reset ? 'New password' : 'Email'}</label>
      <input type={reset ? 'password' : 'email'} minLength={reset ? 6 : undefined} required value={v} onChange={e => setV(e.target.value)} />
      <div className="row"><button>{reset ? 'Save password' : 'Send reset link'}</button><Link to="/login">Back to log in</Link></div>
      {dev && <p className="muted">Dev mode, no email service yet: <a href={dev}>open reset link</a></p>}
    </form>
  );
}
