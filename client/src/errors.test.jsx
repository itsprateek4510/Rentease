import React from 'react';
import { act, create } from 'react-test-renderer';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import api from './api';
import Admin from './pages/Admin.jsx';
import Rentals from './pages/Rentals.jsx';
import Vendor from './pages/Vendor.jsx';
import Wishlist from './pages/Wishlist.jsx';
import Stores from './pages/Stores.jsx';
vi.mock('./context.jsx', () => ({ useAuth: () => ({ user: { wishlist: [] } }), useCity: () => ({ city: 'kochi', areas: [] }) }));
let view;
afterEach(() => { if (view) act(() => view.unmount()); vi.restoreAllMocks(); });
test.each([['Admin', Admin], ['Rentals', Rentals], ['Vendor', Vendor], ['Wishlist', Wishlist], ['Stores', Stores]])('%s shows a backend failure rather than an empty dashboard', async (name, Component) => {
  vi.spyOn(api, 'get').mockRejectedValue(new Error('Network unavailable'));
  await act(async () => { view = create(<MemoryRouter><Component /></MemoryRouter>); });
  expect(JSON.stringify(view.toJSON())).toContain('Network unavailable');
});
