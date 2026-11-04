import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../api';
import { useAuth } from '../context.jsx';
import { ProductCard } from '../ui.jsx';

export default function Wishlist() {
  const { user } = useAuth(), [list, setList] = useState(null), [error, setError] = useState('');
  useEffect(() => { setError(''); api.get('/wishlist').then(r => setList(r.data)).catch(e => setError(errMsg(e))); }, [user.wishlist.length]);
  return (<><h1>My wishlist</h1>{error && <p className="msg err" role="alert">{error}</p>}{list && !list.length && <p>Nothing saved yet. Tap the heart on any product. <Link to="/listings">Browse products</Link></p>}
    <div className="grid">{(list || []).map(p => <ProductCard key={p._id} p={p} />)}</div></>);
}
