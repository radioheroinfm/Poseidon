/**
 * Safe Proxy around HermesDesktop P0 implementation.
 * - Missing keys: nested stub
 * - on*: returns unsubscribe () => void (NOT a Promise) — React useEffect safe
 * - Known boolean flags: false (not truthy Proxy)
 */

const seen = new Set<string>();

/** Static false flags from upstream preload (must not be truthy stubs) */
const BOOLEAN_FLAGS = new Set([
  'glassSupported',
  'translucencySupported',
  'localModelsEnabled',
  'assumeFreshInstall',
]);

function logOnce(path: string, kind: string) {
  if (seen.has(path)) return;
  seen.add(path);
  console.warn(`[Poseidon stub] hermesDesktop.${path} (${kind})`);
}

function isOnHandler(name: string): boolean {
  return /^on[A-Z]/.test(name);
}

function stubValue(path: string, leaf: string): unknown {
  // Event subscriptions: hermesDesktop.onFoo(cb) -> unsubscribe fn
  if (isOnHandler(leaf)) {
    const subscribe = (..._args: unknown[]) => {
      logOnce(path, 'on-subscribe');
      return () => {
        /* unsubscribe no-op */
      };
    };
    return subscribe;
  }

  const fn = async (..._args: unknown[]) => {
    logOnce(path, 'invoke');
    return null;
  };

  return new Proxy(fn, {
    get(_t, prop, receiver) {
      if (prop === 'then') return undefined;
      if (typeof prop === 'symbol') return Reflect.get(_t, prop, receiver);
      if (prop === 'toJSON') return () => null;
      if (prop === 'toString') return () => `[PoseidonStub ${path}]`;
      const childLeaf = String(prop);
      const child = `${path}.${childLeaf}`;
      logOnce(child, 'get');
      return stubValue(child, childLeaf);
    },
    apply(_t, _this, _args) {
      logOnce(path, 'call');
      return Promise.resolve(null);
    },
  });
}

/** Wrap a real P0 object: real keys work, missing keys stubbed safely. */
export function withHermesStubs<T extends object>(real: T): T {
  return new Proxy(real, {
    get(target, prop, receiver) {
      if (typeof prop === 'symbol') return Reflect.get(target, prop, receiver);
      const key = String(prop);

      if (prop in target) {
        return Reflect.get(target, prop, receiver);
      }

      // Boolean capability flags must be false, not truthy proxies
      if (BOOLEAN_FLAGS.has(key)) {
        logOnce(key, 'bool-false');
        return false;
      }

      logOnce(key, 'missing');
      return stubValue(key, key);
    },
    has() {
      return true;
    },
  }) as T;
}
