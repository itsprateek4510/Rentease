import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import api, { setAccessToken } from './api';
import { AuthProvider, useAuth } from './context.jsx';
let auth, view, adapter;
function Probe() { auth = useAuth(); return null; }
beforeEach(() => {
  adapter = api.defaults.adapter;
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('localStorage', { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() });
});
afterEach(() => { if (view) act(() => view.unmount()); view = undefined; api.defaults.adapter = adapter; setAccessToken(''); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function render() { await act(async () => { view = create(<AuthProvider><Probe /></AuthProvider>); }); }
test('restores the cookie session without storing a JWT in localStorage', async () => {
  vi.spyOn(api, 'post').mockResolvedValue({ data: { token: 'access', user: { name: 'Customer' } } });
  await render();
  expect(auth.loading).toBe(false); expect(auth.user.name).toBe('Customer');
  expect(localStorage.setItem).not.toHaveBeenCalled();
  expect(localStorage.removeItem).toHaveBeenCalledWith('token');
});
test('logout revokes the server session and then clears the user', async () => {
  vi.spyOn(api, 'post').mockResolvedValue({ data: { token: 'access', user: { name: 'Customer' } } });
  await render();
  await act(async () => { expect(await auth.logout()).toBe(true); });
  expect(api.post).toHaveBeenLastCalledWith('/auth/logout', {}, { skipRefresh: true });
  expect(auth.user).toBeNull();
});
test('a failed logout does not pretend the server session has been revoked', async () => {
  vi.spyOn(api, 'post').mockResolvedValueOnce({ data: { token: 'access', user: { name: 'Customer' } } }).mockRejectedValue(new Error('Offline'));
  await render();
  await act(async () => { expect(await auth.logout()).toBe(false); });
  expect(auth.user.name).toBe('Customer'); expect(auth.authError).toContain('Could not sign out');
});
test('expired sessions clear the logged-in state', async () => {
  vi.spyOn(api, 'post').mockResolvedValue({ data: { token: 'access', user: { name: 'Customer' } } });
  await render();
  act(() => window.dispatchEvent(new Event('auth:expired')));
  expect(auth.user).toBeNull(); expect(auth.authError).toContain('session expired');
});
test('concurrent expired access tokens share one refresh request and retry with the new JWT', async () => {
  let refreshes = 0;
  setAccessToken('old-token');
  api.defaults.adapter = async config => {
    if (config.url === '/auth/refresh') { refreshes++; return { data: { token: 'new-token' }, status: 200, config }; }
    if (config.headers.Authorization === 'Bearer old-token') throw { config, response: { status: 401 } };
    return { data: config.headers.Authorization, status: 200, config };
  };
  const responses = await Promise.all([api.get('/one'), api.get('/two')]);
  expect(refreshes).toBe(1); expect(responses.map(r => r.data)).toEqual(['Bearer new-token', 'Bearer new-token']);
  expect(localStorage.setItem).not.toHaveBeenCalled();
});
test('a rejected refresh does not loop indefinitely', async () => {
  let requests = 0;
  setAccessToken('expired-token');
  api.defaults.adapter = async config => { requests++; throw { config, response: { status: 401 } }; };
  await expect(api.get('/protected')).rejects.toMatchObject({ response: { status: 401 } });
  expect(requests).toBe(2);
});
