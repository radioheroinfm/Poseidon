# profile.ts:42 `(name ?? '').trim is not a function`

`normalizeProfileKey(name)` requires `string | null | undefined`.
A non-string truthy value (Proxy, `{}`, Promise) makes `(name ?? '')` return that value → `.trim` undefined.

Likely callers pass a whole profile object or a stub Proxy as `name`.

Fix direction: ProfileInfo-shaped returns with **string** `name` / `display_name`; never Proxy for those keys.
