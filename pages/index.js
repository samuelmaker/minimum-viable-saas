import React from 'react';
import Link from 'next/link';
import { useUser } from '../utils/auth/useUser';
import { loadProducts, loadContent, watchSubscription, portalUrl, checkoutUrl } from '../utils/firebase-data.mjs';

const Index = () => {
  const { user, loading, error: authError, logout } = useUser();
  const [products, setProducts] = React.useState([]);
  const [basicContent, setBasicContent] = React.useState([]);
  const [premiumContent, setPremiumContent] = React.useState([]);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const checkout = React.useRef(null);

  React.useEffect(() => {
    let active = true;
    setProducts([]); setBasicContent([]); setPremiumContent([]); setMessage(''); setError('');
    if (!user?.id) return;
    const fail = () => { if (active) setError('Some account data is unavailable. Please try again later.'); };
    loadProducts().then(data => { if (active) setProducts(data); }).catch(fail);
    const unsubscribe = watchSubscription(value => {
      if (!active) return;
      setMessage(value);
      loadContent('content-basic').then(data => { if (active) setBasicContent(data); }).catch(() => { if (active) setBasicContent([]); });
      loadContent('content-premium').then(data => { if (active) setPremiumContent(data); }).catch(() => { if (active) setPremiumContent([]); });
    }, fail);
    return () => { active = false; unsubscribe(); checkout.current?.abort(); };
  }, [user?.id]);

  const goToBillingPortal = async () => {
    setIsLoading(true); setError('');
    try { window.location.assign(await portalUrl()); }
    catch { setError('Unable to open billing. Please try again later.'); setIsLoading(false); }
  };
  const subscribe = async priceId => {
    if (!products.some(product => product.priceId === priceId) || isLoading) return;
    setIsLoading(true); setError('');
    checkout.current?.abort();
    checkout.current = new AbortController();
    try { window.location.assign(await checkoutUrl(priceId, window.location.origin, { signal: checkout.current.signal })); }
    catch { setError('Unable to start checkout. Please try again later.'); setIsLoading(false); }
  };
  if (loading) return <p role="status">Loading account…</p>;
  if (!user) {
    return (
      <div className="mx-auto max-w-xl my-4 bg-white">
        <div className="shadow-md rounded-lg">
          <div className="shadow-xs rounded-lg p-4 space-y-4">
            <p>Hi there!</p>
            <p>You are not signed in. </p>{authError && <p role="alert">{authError}</p>}{' '}
            <div>
              <Link legacyBehavior href={'/auth'}>
                <a className="px-4  py-2 bg-gray-300 rounded-md text-gray-900 font-medium  hover:bg-gray-400 transition duration-150 ease-in active:bg-gray-400">
                  Sign in
                </a>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="mx-auto max-w-xl flex items-center justify-center py-8">
        <div>Loading....</div>
      </div>
    );
  }
  return (
    <div>
      <div className="mx-auto max-w-xl flex items-center justify-between py-2">
        <div className="space-x-3">
          <Link legacyBehavior href={'/'}>
            <a>Home</a>
          </Link>
          <Link legacyBehavior href={'/example'}>
            <a>Another Page</a>
          </Link>
        </div>
        <div className="flex items-center space-x-3">
          <p className="text-sm">
            <strong>{user.email}</strong>
          </p>
          <button
            className="px-3 py-1 bg-gray-300 rounded-md text-gray-900 font-medium  hover:bg-gray-400 transition duration-150 ease-in active:bg-gray-400"
            onClick={() => logout()}
          >
            Log out
          </button>
        </div>
      </div>
      <div className="mx-auto max-w-xl my-4  space-y-4">
        <div className="shadow-md rounded-lg bg-white">
          <div className="shadow-xs rounded-lg p-4 space-y-4">
            <div className="space-y-4">
              <p>You're signed in.</p>
              <p>{message}</p>{(error || authError) && <p role="alert">{error || authError}</p>}

              <div className="space-x-3">
                <button
                  className="px-5 py-3 bg-blue-200 rounded-md text-blue-900 font-medium hover:bg-blue-300 transition duration-150 ease-in active:bg-blue-300"
                  onClick={goToBillingPortal}
                >
                  Manage Subscription →
                </button>
              </div>
            </div>

            {!message &&
              products &&
              products.map((p) => (
                <div key={p.productId + p.priceId}>
                  {p.name} {p.content}
                  <button onClick={() => subscribe(p.priceId)}>
                    Subscribe
                  </button>
                </div>
              ))}
          </div>
        </div>
        <div className="shadow-md rounded-lg bg-white">
          <div className="shadow-xs rounded-lg p-4 space-y-4">
            <strong>Basic Content</strong>
            <pre>{JSON.stringify(basicContent, null, 2)}</pre>
          </div>
        </div>
        <div className="shadow-md rounded-lg bg-white">
          <div className="shadow-xs rounded-lg p-4 space-y-4">
            <strong>Premium Content</strong>
            <pre>{JSON.stringify(premiumContent, null, 2)}</pre>
          </div>
        </div>
      </div>{' '}
    </div>
  );
};

export default Index;
