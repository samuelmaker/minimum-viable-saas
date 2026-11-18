import { test } from 'node:test';
import assert from 'node:assert/strict';
import { billingUrl } from '../utils/firebase-data.mjs';

test('billing redirects allow exact HTTPS Stripe origins', () => {
  assert.equal(billingUrl('https://checkout.stripe.com/c/pay/cs_test_example', 'checkout'), 'https://checkout.stripe.com/c/pay/cs_test_example');
  assert.equal(billingUrl('https://billing.stripe.com/p/session/test', 'portal'), 'https://billing.stripe.com/p/session/test');
  for (const value of ['javascript:alert(1)', 'http://checkout.stripe.com/c/pay/test',
    'https://checkout.stripe.com.evil.example/', 'https://checkout.stripe.com@evil.example/',
    'https://evil@checkout.stripe.com/', 'https://checkout.stripe.com:444/', '//checkout.stripe.com/']) {
    assert.throws(() => billingUrl(value, 'checkout'));
  }
});

test('custom billing domains require an explicit exact origin', () => {
  const prior = process.env.NEXT_PUBLIC_BILLING_ALLOWED_ORIGINS;
  try {
    process.env.NEXT_PUBLIC_BILLING_ALLOWED_ORIGINS = 'https://pay.example.com';
    assert.equal(billingUrl('https://pay.example.com/checkout', 'checkout'), 'https://pay.example.com/checkout');
    assert.throws(() => billingUrl('https://pay.example.com.evil.example/', 'checkout'));
    assert.throws(() => billingUrl('http://pay.example.com/', 'checkout'));
  } finally {
    if (prior === undefined) delete process.env.NEXT_PUBLIC_BILLING_ALLOWED_ORIGINS;
    else process.env.NEXT_PUBLIC_BILLING_ALLOWED_ORIGINS = prior;
  }
});
