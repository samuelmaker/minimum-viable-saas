import { collection, doc, getDoc, getDocs, setDoc, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getFirebase, getCustomClaimRole } from './auth/firebase-client.mjs';

function currentUid() {
  const uid = getFirebase().auth.currentUser?.uid;
  if (!uid) throw new Error('Sign in before accessing customer data');
  return uid;
}

export function billingUrl(value, kind) {
  const url = new URL(value);
  const expected = kind === 'portal' ? 'billing.stripe.com' : 'checkout.stripe.com';
  const extra = (process.env.NEXT_PUBLIC_BILLING_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
  if (url.protocol !== 'https:' || url.username || url.password ||
      (url.origin !== 'https://' + expected && !extra.includes(url.origin))) {
    throw new Error('Untrusted billing destination');
  }
  return url.href;
}

export async function loadProducts() {
  const { db } = getFirebase();
  const products = await getDocs(query(collection(db, 'product'), where('active', '==', true)));
  const prices = await Promise.all(products.docs.map(async product => {
    const result = await getDocs(query(collection(product.ref, 'prices'), orderBy('unit_amount')));
    return result.docs.filter(price => price.data().active !== false).map(price => {
      const data = price.data();
      return { productId: product.id, name: product.data().name, priceId: price.id, value: price.id,
        content: `${new Intl.NumberFormat('en-US', { style: 'currency', currency: data.currency }).format(data.unit_amount / 100)} per ${data.interval}` };
    });
  }));
  return prices.flat();
}

export async function loadContent(name) {
  const results = await getDocs(collection(getFirebase().db, name));
  return results.docs.map(doc => ({ ...doc.data(), id: doc.id }));
}

export function watchSubscription(onChange, onError) {
  const { db } = getFirebase();
  return onSnapshot(query(collection(db, 'customer', currentUid(), 'subscriptions'), where('status', '==', 'active')), snapshot => {
    (async () => {
      const role = await getCustomClaimRole();
      if (snapshot.empty) { onChange(''); return; }
      const subscription = snapshot.docs[0].data();
      const price = await getDoc(subscription.price);
      const data = price.data();
      onChange(`You are paying ${new Intl.NumberFormat('en-US', { style: 'currency', currency: data.currency }).format(data.unit_amount / 100)} per ${data.interval}, giving you the role: ${role || 'none'}.`);
    })().catch(onError);
  }, onError);
}

export async function portalUrl() {
  currentUid();
  const extension = process.env.NEXT_PUBLIC_STRIPE_EXTENSION_ID || 'firestore-stripe-subscriptions';
  if (!/^[a-z0-9-]+$/.test(extension)) throw new Error('Invalid extension instance ID');
  const createPortal = httpsCallable(getFirebase().functions, `ext-${extension}-createPortalLink`);
  const { data } = await createPortal({ returnUrl: window.location.origin });
  return billingUrl(data.url, 'portal');
}

export async function checkoutUrl(price, returnUrl, { signal, timeout = 30000 } = {}) {
  const session = doc(collection(getFirebase().db, 'customer', currentUid(), 'checkout_sessions'));
  return new Promise((resolve, reject) => {
    let unsubscribe = () => {};
    let settled = false;
    const finish = (error, url) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      unsubscribe();
      error ? reject(error) : resolve(url);
    };
    const abort = () => finish(new Error('Checkout cancelled'));
    const timer = setTimeout(() => finish(new Error('Checkout timed out')), timeout);
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener('abort', abort, { once: true });
    unsubscribe = onSnapshot(session, snapshot => {
      const data = snapshot.data();
      if (data?.error) finish(new Error('Checkout failed'));
      else if (data?.url) {
        try { finish(null, billingUrl(data.url, 'checkout')); } catch (error) { finish(error); }
      }
    }, error => finish(error));
    setDoc(session, { price, success_url: returnUrl, cancel_url: returnUrl }).catch(error => finish(error));
  });
}
