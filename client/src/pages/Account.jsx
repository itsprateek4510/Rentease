import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth, useCity } from '../context.jsx';
import { Tag, useFlash } from '../ui.jsx';

export default function Account() {
  const { user, setUser, login, refresh } = useAuth(), { areas } = useCity(), nav = useNavigate();
  const [p, setP] = useState({ name: user.name === 'New user' ? '' : user.name, email: user.email || '', phone: user.phone || '', city: user.city || '' }), [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [a, setA] = useState({ label: 'Home', line: '', city: areas[0]?.name || '', pincode: '' }), [k, setK] = useState({ docType: 'aadhaar', docNumber: '' });
  const [b1, r1] = useFlash(), [b2, r2] = useFlash(), [b3, r3] = useFlash(), [b4, r4] = useFlash();
  return (
    <>
      <h1>My account</h1>
      <div className="two">
        <form className="card pad" onSubmit={e => { e.preventDefault(); r1(async () => { const { data } = await api.put('/auth/profile', p); setUser(u => ({ ...u, ...data })); if (data.needsVerification) nav('/verify', { state: { email: data.verificationEmail, devOtp: data.devOtp } }); }, 'Profile saved'); }}>
          <h3 style={{ marginTop: 0 }}>Profile</h3>{b1}<p className="muted">{user.email || 'No email added'} · {user.role}{user.credits > 0 && ` · ${user.credits} rent credit`}</p>
          <label>Name</label><input required value={p.name} onChange={e => setP({ ...p, name: e.target.value })} />
          <label>Email</label><input type="email" value={p.email} onChange={e => setP({ ...p, email: e.target.value })} />
          <label>Verified phone</label><input value={p.phone} readOnly /><small className="muted">Phone numbers are verified through OTP login, not editable profile text.</small>
          <label>City</label><input value={p.city} onChange={e => setP({ ...p, city: e.target.value })} />
          <div className="row"><button>Save profile</button></div>
        </form>
        {user.hasPassword ? <form className="card pad" onSubmit={e => { e.preventDefault(); r2(async () => { const { data } = await api.put('/auth/change-password', pw); login(data.token, { ...user, ...data.user }); setPw({ currentPassword: '', newPassword: '' }); }, 'Password changed. Other devices were signed out.'); }}>
          <h3 style={{ marginTop: 0 }}>Change password</h3>{b2}
          <label>Current password</label><input type="password" required value={pw.currentPassword} onChange={e => setPw({ ...pw, currentPassword: e.target.value })} />
          <label>New password</label><input type="password" required minLength={6} value={pw.newPassword} onChange={e => setPw({ ...pw, newPassword: e.target.value })} />
          <div className="row"><button>Change password</button></div>
        </form> : <div className="card pad"><h3>Account security</h3><p>You sign in with Google or a one-time code. No password is stored for this account.</p></div>}
      </div>
      {user.role === 'user' && <div className="two" style={{ marginTop: 22 }}>
        <form className="card pad" onSubmit={e => { e.preventDefault(); r3(async () => { await api.put('/kyc', k); await refresh(); setK({ ...k, docNumber: '' }); }, 'KYC submitted. We will verify it shortly.'); }}>
          <h3 style={{ marginTop: 0 }}>KYC verification <Tag s={user.kyc?.status || 'none'} /></h3>{b3}
          <p className="muted">We verify an ID before delivery. Only the last 4 digits of your document number are stored.{user.kyc?.note && ` Note: ${user.kyc.note}`}</p>
          {user.kyc?.status === 'verified' ? <p>Your {user.kyc.docType} ({user.kyc.docNumber}) is verified.</p> : <>
            <label>Document</label><select value={k.docType} onChange={e => setK({ ...k, docType: e.target.value })}><option value="aadhaar">Aadhaar</option><option value="pan">PAN</option><option value="passport">Passport</option><option value="driving licence">Driving licence</option></select>
            <label>Document number</label><input required minLength={6} value={k.docNumber} onChange={e => setK({ ...k, docNumber: e.target.value })} />
            <div className="row"><button>{user.kyc?.status === 'pending' ? 'Resubmit' : 'Submit for verification'}</button></div></>}
        </form>
        <div className="card pad"><h3 style={{ marginTop: 0 }}>Saved addresses</h3>{b4}
          {!user.addresses?.length && <p className="muted">No saved addresses.</p>}
          {user.addresses?.map(x => <div key={x._id} className="opt"><span style={{ flex: 1 }}><b>{x.label}</b><br />{x.line}, <span style={{ textTransform: 'capitalize' }}>{x.city}</span> {x.pincode}</span>
            <button className="alt" onClick={() => r4(async () => { const { data } = await api.delete('/addresses/' + x._id); setUser(u => ({ ...u, addresses: data })); })}>Delete</button></div>)}
          <form onSubmit={e => { e.preventDefault(); r4(async () => { const { data } = await api.post('/addresses', a); setUser(u => ({ ...u, addresses: data })); setA({ ...a, line: '', pincode: '' }); }, 'Address saved'); }}>
            <label>Address</label><input required value={a.line} onChange={e => setA({ ...a, line: e.target.value })} />
            <div className="row"><input required value={a.city} onChange={e => setA({ ...a, city: e.target.value })} aria-label="City" placeholder="Any Indian city" style={{ flex: 1 }} />
              <input required pattern="\d{6}" maxLength={6} placeholder="Pincode" value={a.pincode} onChange={e => setA({ ...a, pincode: e.target.value.replace(/\D/g, '') })} style={{ flex: 1 }} /></div>
            <div className="row"><button>Add address</button></div></form>
        </div>
      </div>}
    </>
  );
}
