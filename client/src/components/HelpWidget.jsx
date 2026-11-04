import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context.jsx';
import { useFlash } from '../ui.jsx';

export default function HelpWidget() {
  const { user } = useAuth(), [open, setOpen] = useState(false), [f, setF] = useState({ phone: '', message: '' }), [box, run] = useFlash();
  return (
    <div className="help noprint">
      {open && <div className="hpanel" role="dialog" aria-label="Help">
        <b>How can we help?</b>
        <div className="hl"><Link to="/rentals" onClick={() => setOpen(false)}>📦 Track my order</Link><Link to="/faq" onClick={() => setOpen(false)}>❓ FAQs</Link><Link to="/relocation" onClick={() => setOpen(false)}>🚚 Relocation help</Link></div>
        <form onSubmit={e => { e.preventDefault(); run(async () => { await api.post('/contact', { name: user?.name || 'Website visitor', email: user?.email, phone: f.phone || user?.phone, message: f.message }); setF({ phone: '', message: '' }); }, 'Thanks! We will call you back soon.'); }}>
          {box}
          {!user?.phone && <input placeholder="Your phone number" required value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} aria-label="Phone" />}
          <textarea rows={2} required placeholder="Type your question" value={f.message} onChange={e => setF({ ...f, message: e.target.value })} aria-label="Message" style={{ marginTop: 6 }} />
          <button style={{ marginTop: 6, width: '100%' }}>Request a call back</button>
        </form>
        <p className="muted" style={{ margin: '8px 0 0' }}>Or call +91 98765 43210 (9am to 7pm)</p>
      </div>}
      <button className="hbtn" onClick={() => setOpen(o => !o)} aria-expanded={open}>🎧 Need Help?</button>
    </div>
  );
}
