## 2026-08-02 - Security Headers and External Link Privacy

**Vulnerability:** Missing Content Security Policy and external links leaking referrer data via missing `noreferrer`.
**Learning:** In static site generation tools like Astro, external links created with `target="_blank"` should also include `rel="noopener noreferrer"`. Additionally, static sites should implement a base `Content-Security-Policy` (to mitigate XSS, noting that `unsafe-inline` should ideally be removed in favor of nonces/hashes for stronger protection) and `referrer` meta tags (e.g. `no-referrer`) to reduce information leakage.
**Prevention:** Always add CSP (with hardening directives like `base-uri 'none'` and `object-src 'none'`) and referrer-policy meta tags in the base layout (`Layout.astro`), and ensure `target="_blank"` links include both `noopener` and `noreferrer`.
