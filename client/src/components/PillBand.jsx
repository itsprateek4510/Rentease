import { Link } from 'react-router-dom';
import { CATS } from '../api';

export default function PillBand({ crumbs = [], category }) {
  return (
    <div className="band2"><div className="in">
      <nav className="crumbs" aria-label="Breadcrumb">{crumbs.map(([l, to], i) => <span key={i}>{i > 0 && ' › '}{to ? <Link to={to}>{l}</Link> : l}</span>)}</nav>
      <div className="pills2">
        <Link to="/packages" className="pl">Packages</Link>
        {CATS.map(([k, l]) => <Link key={k} to={'/listings?category=' + k} className={'pl' + (category === k ? ' on' : '')}>{l}</Link>)}
      </div>
    </div></div>
  );
}
