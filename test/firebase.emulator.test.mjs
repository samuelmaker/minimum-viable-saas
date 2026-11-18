import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signOut, onAuthStateChanged, deleteUser } from 'firebase/auth';

if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8380' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9399') {
  throw new Error('Start the local Auth/Firestore emulators before running this suite');
}
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'demo-security-minimum';
process.env.NEXT_PUBLIC_FIREBASE_PUBLIC_API_KEY = 'local-test-key';
process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS = 'true';
const { getFirebase } = await import('../utils/auth/firebase-client.mjs');
const { checkoutUrl } = await import('../utils/firebase-data.mjs');
let environment;
before(async () => {
  environment = await initializeTestEnvironment({ projectId: 'demo-security-minimum', firestore: {
    host: '127.0.0.1', port: 8380, rules: await fs.readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
  } });
});
beforeEach(() => environment.clearFirestore());
after(async () => { await signOut(getFirebase().auth); await environment.cleanup(); });

test('real Firebase SDK state is anonymous until emulator sign-in and changes on sign-out', async () => {
  const auth = getFirebase().auth;
  await signOut(auth);
  const observed = [];
  const unsubscribe = onAuthStateChanged(auth, user => observed.push(user?.uid || null));
  const result = await createUserWithEmailAndPassword(auth, `security-${Date.now()}@example.com`, 'local-test-password');
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(auth.currentUser.uid, result.user.uid);
  assert.ok(observed.includes(result.user.uid));
  await deleteUser(result.user);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(auth.currentUser, null);
  assert.equal(observed.at(-1), null);
  unsubscribe();
});

test('customers cannot read another user or write server-owned billing data', async () => {
  await environment.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'customer/alice'), { stripeId: 'server-customer' });
    await setDoc(doc(context.firestore(), 'customer/alice/subscriptions/sub'), { status: 'active' });
  });
  const alice = environment.authenticatedContext('alice').firestore();
  const bob = environment.authenticatedContext('bob').firestore();
  await assertSucceeds(getDoc(doc(alice, 'customer/alice')));
  await assertFails(getDoc(doc(bob, 'customer/alice')));
  await assertFails(updateDoc(doc(alice, 'customer/alice'), { stripeId: 'forged' }));
  await assertFails(setDoc(doc(alice, 'customer/alice/subscriptions/forged'), { status: 'active' }));
});

test('checkout sessions allow only bounded creation fields and server-owned results', async () => {
  const alice = environment.authenticatedContext('alice').firestore();
  const ref = doc(alice, 'customer/alice/checkout_sessions/new');
  const input = { price: 'price_test', success_url: 'https://app.example', cancel_url: 'https://app.example' };
  await assertSucceeds(setDoc(ref, input));
  await assertFails(updateDoc(ref, { url: 'https://evil.example' }));
  await assertFails(setDoc(doc(alice, 'customer/alice/checkout_sessions/forged'), { ...input, url: 'https://evil.example' }));
  await assertFails(setDoc(doc(alice, 'customer/bob/checkout_sessions/new'), input));
  await assertFails(setDoc(doc(alice, 'product/forged'), { active: true }));
  await assertFails(setDoc(doc(alice, 'customer/alice/checkout_sessions/oversize'), { ...input, price: 'x'.repeat(201) }));
});

test('premium content requires signed premium claims; basic users cannot read it', async () => {
  await environment.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'content-basic/example'), { text: 'basic' });
    await setDoc(doc(context.firestore(), 'content-premium/example'), { text: 'premium' });
  });
  const basic = environment.authenticatedContext('alice', { stripeRole: 'basic' }).firestore();
  const premium = environment.authenticatedContext('bob', { stripeRole: 'premium' }).firestore();
  await assertSucceeds(getDoc(doc(basic, 'content-basic/example')));
  await assertFails(getDoc(doc(basic, 'content-premium/example')));
  await assertSucceeds(getDoc(doc(premium, 'content-premium/example')));
  await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(), 'content-basic/example')));
});

test('checkout uses the actual SDK UID, accepts a server result and stops waiting on timeout', async () => {
  const auth = getFirebase().auth;
  const user = (await createUserWithEmailAndPassword(auth, `checkout-${Date.now()}@example.com`, 'local-test-password')).user;
  const waiting = checkoutUrl('price_test', 'https://app.example');
  let session;
  for (let i = 0; i < 100 && !session; i++) {
    await environment.withSecurityRulesDisabled(async context => {
      const docs = await getDocs(collection(context.firestore(), `customer/${user.uid}/checkout_sessions`));
      if (!docs.empty) session = docs.docs[0].id;
    });
    if (!session) await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.ok(session);
  await environment.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), `customer/${user.uid}/checkout_sessions/${session}`), { url: 'https://checkout.stripe.com/c/pay/cs_test_example' }));
  assert.equal(await waiting, 'https://checkout.stripe.com/c/pay/cs_test_example');
  await assert.rejects(checkoutUrl('price_test', 'https://app.example', { timeout: 50 }), /timed out/);
  await deleteUser(user);
});
