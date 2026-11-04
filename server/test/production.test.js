const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const previous = process.env.NODE_ENV;
afterEach(() => { process.env.NODE_ENV = previous; mock.restoreAll(); });
test('production never prints OTP email or SMS when delivery is unconfigured', async () => {
  process.env.NODE_ENV = 'production';
  const log = mock.method(console, 'log', () => {});
  await assert.rejects(require('../utils/mailer').sendMail('user@example.com', 'OTP', 'secret'), /not configured/);
  await assert.rejects(require('../utils/sms').sendSms('9876543210', 'secret'), /not configured/);
  assert.equal(log.mock.calls.length, 0);
});
