import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import api from './api';
import { CityProvider } from './context.jsx';
import { CityModal } from './App.jsx';

let view;
beforeEach(() => {
  const values = new Map();
  vi.stubGlobal('localStorage', { getItem: k => values.get(k) || null, setItem: (k, v) => values.set(k, v) });
});
afterEach(() => { if (view) act(() => view.unmount()); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function render() {
  await act(async () => { view = create(<CityProvider><CityModal /></CityProvider>); });
}
const button = text => view.root.findAllByType('button').find(b => b.children.join('').includes(text));

test('failed city request still allows manual selection and closes the modal', async () => {
  vi.spyOn(api, 'get').mockRejectedValue(new Error('Network Error'));
  await render();
  expect(JSON.stringify(view.toJSON())).toContain('temporarily unavailable');
  const delhi = view.root.findAllByType('button').find(b => b.findAllByType('b').some(x => x.children[0] === 'Delhi'));
  expect(delhi).toBeDefined();
  act(() => delhi.props.onClick());
  expect(localStorage.getItem('city')).toBe('delhi');
  expect(view.toJSON()).toBeNull();
});

test('empty city list can be dismissed without claiming the location is unserved', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({ data: [] });
  await render();
  expect(JSON.stringify(view.toJSON())).not.toContain('We do not serve');
  act(() => button('Continue browsing').props.onClick());
  expect(view.toJSON()).toBeNull();
  expect(localStorage.getItem('city')).toBeNull();
});

test('geolocation resolves any Indian city rather than using the demo-city distance threshold', async () => {
  vi.spyOn(api, 'get').mockImplementation(url => Promise.resolve({ data: url === '/areas' ? [] : { city: 'kochi', state: 'Kerala', country: 'IN' } }));
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: success => success({ coords: { latitude: 28.61, longitude: 77.21 } }) } });
  await render();
  await act(async () => button('Fetch my location').props.onClick());
  expect(localStorage.getItem('city')).toBe('kochi');
  expect(view.toJSON()).toBeNull();
});

test('reverse lookup failure and denied permission still allow manual selection', async () => {
  vi.spyOn(api, 'get').mockImplementation(url => url === '/areas' ? Promise.resolve({ data: [{ _id: 'city', name: 'Delhi' }] }) : Promise.reject(new Error('Location lookup unavailable')));
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: success => success({ coords: { latitude: 0, longitude: 0 } }) } });
  await render();
  await act(async () => button('Fetch my location').props.onClick());
  expect(JSON.stringify(view.toJSON())).toContain('Location lookup unavailable');
  navigator.geolocation.getCurrentPosition = (success, error) => error();
  act(() => button('Fetch my location').props.onClick());
  expect(JSON.stringify(view.toJSON())).toContain('Could not get your location');
  act(() => view.root.findByProps({ className: 'tile' }).props.onClick());
  expect(localStorage.getItem('city')).toBe('delhi');
});

test('a customer can select a city anywhere in India without a backend city whitelist', async () => {
  vi.spyOn(api, 'get').mockRejectedValue(new Error('Offline'));
  await render();
  act(() => view.root.findByProps({ 'aria-label': 'City or town' }).props.onChange({ target: { value: 'Kohima' } }));
  act(() => view.root.findByProps({ 'aria-label': 'State or union territory' }).props.onChange({ target: { value: 'Nagaland' } }));
  act(() => view.root.findByProps({ 'aria-label': 'Choose an Indian location' }).props.onSubmit({ preventDefault() {} }));
  expect(localStorage.getItem('city')).toBe('kohima');
  expect(JSON.parse(localStorage.getItem('location')).state).toBe('Nagaland');
  expect(view.toJSON()).toBeNull();
});
