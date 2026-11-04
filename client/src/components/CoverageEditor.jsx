import { INDIAN_STATES } from '../locations';

export default function CoverageEditor({ value = { mode: 'city' }, onChange }) {
  const mode = value.mode || 'city', set = patch => onChange({ ...value, ...patch });
  return <fieldset style={{ marginTop: 16 }}>
    <legend>Where will you deliver this listing?</legend>
    <select aria-label="Delivery coverage" value={mode} onChange={e => set({ mode: e.target.value })}>
      <option value="city">Origin city only</option><option value="cities">Selected cities</option><option value="states">Selected states / UTs</option>
      <option value="pincodes">Selected PIN codes</option><option value="radius">Local radius</option><option value="nationwide">All of India</option>
    </select>
    {mode === 'city' && <p className="muted">Delivery stays within the origin city above.</p>}
    {mode === 'nationwide' && <p className="muted">Customers anywhere in India can order this item. You are responsible for delivery and pickup.</p>}
    {mode === 'cities' && <><label>Cities, separated by commas</label><input required aria-label="Delivery cities" value={(value.cities || []).join(',')} onChange={e => set({ cities: e.target.value.split(',') })} placeholder="Delhi,Jaipur,Lucknow" /></>}
    {mode === 'pincodes' && <><label>PIN codes, separated by commas</label><input required aria-label="Delivery PIN codes" value={(value.pincodes || []).join(',')} onChange={e => set({ pincodes: e.target.value.split(',') })} placeholder="110001,682001" /></>}
    {mode === 'states' && <><label>States / UTs (select one or more)</label><select multiple required aria-label="Delivery states" value={value.states || []} onChange={e => set({ states: Array.from(e.target.selectedOptions, o => o.value) })}>{INDIAN_STATES.map(s => <option key={s}>{s}</option>)}</select></>}
    {mode === 'radius' && <>
      <label>Delivery radius in kilometres</label><input required aria-label="Delivery radius" type="number" min="1" max="3000" value={value.radiusKm ?? ''} onChange={e => set({ radiusKm: Number(e.target.value) })} />
      <div className="two"><div><label>Origin latitude</label><input required type="number" step="any" min="-90" max="90" value={value.center?.lat ?? ''} onChange={e => set({ center: { ...value.center, lat: Number(e.target.value) } })} /></div>
        <div><label>Origin longitude</label><input required type="number" step="any" min="-180" max="180" value={value.center?.lng ?? ''} onChange={e => set({ center: { ...value.center, lng: Number(e.target.value) } })} /></div></div>
      <p className="muted">Distance is measured from this point to the delivery PIN-code centre, not an exact street address.</p>
    </>}
  </fieldset>;
}
