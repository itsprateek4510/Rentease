import { useState } from 'react';
import api from '../api';
import { useFlash } from '../ui.jsx';

export default function Contact() {
  const [f, setF] = useState({ name: '', email: '', phone: '', message: '' }), [box, run] = useFlash(), set = k => e => setF({ ...f, [k]: e.target.value });
  return (
    <form className="card pad narrow" onSubmit={e => { e.preventDefault(); run(async () => { await api.post('/contact', f); setF({ name: '', email: '', phone: '', message: '' }); }, "Thanks! We'll get back to you within one working day."); }}>
      <h2>Contact us</h2><p className="muted">support@rentease.in · +91 98765 43210 · Mon to Sat, 9am to 7pm</p>{box}
      <label>Name</label><input required value={f.name} onChange={set('name')} /><label>Email</label><input type="email" required value={f.email} onChange={set('email')} />
      <label>Phone</label><input value={f.phone} onChange={set('phone')} /><label>How can we help?</label><textarea required rows={4} value={f.message} onChange={set('message')} />
      <div className="row"><button>Send message</button></div>
    </form>
  );
}
