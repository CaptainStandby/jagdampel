## 2026-08-02 - Security Headers and External Link Privacy

**Vulnerability:** Missing Content Security Policy and external links leaking referrer data via missing `noreferrer`.
**Learning:** In static site generation tools like Astro, external links created with `target="_blank"` should also include `rel="noopener noreferrer"`. Additionally, static sites should implement a base `Content-Security-Policy` and `referrer` meta tags to prevent XSS and reduce information leakage.
**Prevention:** Always add CSP and referrer-policy meta tags in the base layout (`Layout.astro`), and ensure `target="_blank"` links include both `noopener` and `noreferrer`.
