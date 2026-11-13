/**
 * Safe Proxy around HermesDesktop P0 implementation.
 * Unknown keys return no-op functions / resolved null so upstream renderer
 * does not crash on undefined during Spike 1.
 *
 * Logged once per key to avoid spam.
 */

const seen = new Set<string>();

function logOnce(path: string, kind: string) {
  if (seen.has(path)) return;
  seen.add(path);
  console.warn(`[Poseidon stub] hermesDesktop.${path} (${kind}) — not implemented yet`);
}

function stubValue(path: string): unknown {
  // Callable stub
  const fn = async (..._args: unknown[]) => {
    logOnce(path, 'invoke');
    return null;
  };
  // Also usable as empty object tree via proxy
  return new Proxy(fn, {
    get(_t, prop, receiver) {
      if (prop === 'then') return undefined; // not a thenable by default
      if (typeof prop === 'symbol') return Reflect.get(_t, prop, receiver);
      if (prop === 'toJSON') return () => null;
      if (prop === 'valueOf') return () => fn;
      if (prop === 'toString') return () => `[PoseidonStub ${path}]`;
      const child = `${path}.${String(prop)}`;
      logOnce(child, 'get');
      return stubValue(child);
    },
    apply(_t, _this, args) {
      logOnce(path, 'call');
      return Promise.resolve(null);
    },
  });
}

/** Wrap a real P0 object: real keys work, missing keys stubbed. */
export function withHermesStubs<T extends object>(real: T): T {
  return new Proxy(real, {
    get(target, prop, receiver) {
      if (typeof prop === 'symbol') return Reflect.get(target, prop, receiver);
      if (prop in target) {
        const v = Reflect.get(target, prop, receiver);
        // Nested plain objects that we own can be used as-is
        return v;
      }
      const path = String(prop);
      logOnce(path, 'missing');
      return stubValue(path);
    },
    has(target, prop) {
      return true; // 'key' in hermesDesktop always true during spike
    },
  }) as T;
}
