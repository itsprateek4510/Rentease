import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context.jsx';
import { ProductCard } from '../ui.jsx';

export default function Wishlist() {
  const { user } = useAuth(), [list, setList] = useState(null);
  useEffect(() => { api.get('/wishlist').then(r => setList(r.data)); }, [user.wishlist.length]);
  return (<><h1>My wishlist</h1>{list && !list.length && <p>Nothing saved yet. Tap the heart on any product. <Link to="/listings">Browse products</Link></p>}
    <div className="grid">{(list || []).map(p => <ProductCard key={p._id} p={p} />)}</div></>);
}
