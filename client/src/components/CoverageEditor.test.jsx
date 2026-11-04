import React, { useState } from 'react';
import { act, create } from 'react-test-renderer';
import { expect, test } from 'vitest';
import CoverageEditor from './CoverageEditor.jsx';
test('lenders can switch from local to nationwide or selected PIN codes', () => {
  let current, view;
  function Form() { const [value, setValue] = useState({ mode: 'city' }); current = value; return <CoverageEditor value={value} onChange={setValue} />; }
  act(() => { view = create(<Form />); });
  act(() => view.root.findByProps({ 'aria-label': 'Delivery coverage' }).props.onChange({ target: { value: 'nationwide' } }));
  expect(current.mode).toBe('nationwide');
  act(() => view.root.findByProps({ 'aria-label': 'Delivery coverage' }).props.onChange({ target: { value: 'pincodes' } }));
  act(() => view.root.findByProps({ 'aria-label': 'Delivery PIN codes' }).props.onChange({ target: { value: '110001,682001' } }));
  expect(current.pincodes).toEqual(['110001', '682001']);
  act(() => view.unmount());
});
