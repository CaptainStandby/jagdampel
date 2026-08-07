# Sentinel Security Learnings

## 1. Missing `noreferrer` on external links (`target="_blank"`)

- **Context**: When using `target="_blank"` on an external anchor `<a>` element, omitting `noreferrer` can allow the target page to access the referrer header (potentially leaking private URLs) and access the parent window context (reverse tabnabbing, though mitigated by `noopener` or modern browsers).
- **Fix**: Ensure that any anchor link targeting external websites with `target="_blank"` includes `rel="noopener noreferrer"`.
- **Verification**: Search for `<a ` tags combined with `target="_blank"` across the codebase to ensure all occurrences conform to using `rel="noopener noreferrer"`.
<<<<<<< HEAD
=======

## 2026-08-06 - Content Security Policy (CSP) implementation

**Vulnerability**: The static Astro site was lacking a Content Security Policy (CSP). Without a CSP, the application is more susceptible to Cross-Site Scripting (XSS) attacks, as the browser will execute any inline scripts or load resources from any domain.
**Learning**: Even for statically generated sites (like this Astro app), a CSP is a critical defense-in-depth measure. While the risk might seem lower without complex backend logic, XSS can still occur through DOM manipulation or third-party dependencies. Astro provides built in support for generating strict CSPs that include auto-generated hashes for bundled scripts, eliminating the need for `unsafe-inline` in the `script-src` directive for standard client-side hydration. `unsafe-inline` is still required in `style-src-attr` to support components like `<noscript>` which may have inline styles, or dynamic react inline styles.
**Prevention**: Use Astro's built-in `security.csp` configuration in `astro.config.mjs` to implement a strict Content Security Policy. A strict baseline for static sites often includes `default-src 'self'`, `img-src 'self' data:`, and `connect-src 'self'`, while relying on Astro's built-in hashing for scripts.
>>>>>>> d9832e9 (⚡ performance: safely memoize available tags in SeasonMatrix before early return)
