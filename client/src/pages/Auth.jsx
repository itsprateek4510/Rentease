import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { errMsg, home } from '../api';
import { useAuth } from '../context.jsx';

export default function Auth({ register }) {
  const [f, setF] = useState({ role: 'user' }), [err, setErr] = useState(''), { login } = useAuth(), nav = useNavigate();
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const toVerify = d => nav('/verify', { state: { email: d.email, devOtp: d.devOtp } });
  const submit = async e => {
    e.preventDefault(); setErr('');
    try {
      const { data } = await api.post('/auth/' + (register ? 'register' : 'login'), f);
      if (data.needsVerification) return toVerify(data);
      login(data.token, data.user);
      nav(home(data.user));
    } catch (ex) {
      if (ex.response?.data?.needsVerification) return toVerify(ex.response.data);
      setErr(errMsg(ex));
    }
  };
  return (
    <form className="card pad narrow" onSubmit={submit}>
      <h2>{register ? 'Create your account' : 'Log in'}</h2>
      {err && <div className="msg err" role="alert">{err}</div>}
      {register && <><label>Full name</label><input required onChange={set('name')} />
        <label>City</label><input onChange={set('city')} />
        <label>I want to</label>
        <select onChange={set('role')}><option value="user">Rent products</option><option value="vendor">List products as a vendor</option></select></>}
      <label>Email</label><input type="email" required onChange={set('email')} />
      <label>Password</label><input type="password" required minLength={register ? 8 : 6} onChange={set('password')} />
      {!register && <p style={{ margin: '8px 0 0' }}><Link to="/forgot">Forgot password?</Link> · <Link to="/verify">Log in with an email code</Link></p>}
      {register && <p className="muted">We'll email you a 6-digit code to verify your address.</p>}
      <div className="row"><button>{register ? 'Sign up' : 'Log in'}</button>
        <Link to={register ? '/login' : '/register'}>{register ? 'Have an account?' : 'New here? Sign up'}</Link></div>
    </form>
  );
}
