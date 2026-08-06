# Sentinel Security Learnings

## 1. Missing `noreferrer` on external links (`target="_blank"`)

- **Context**: When using `target="_blank"` on an external anchor `<a>` element, omitting `noreferrer` can allow the target page to access the referrer header (potentially leaking private URLs) and access the parent window context (reverse tabnabbing, though mitigated by `noopener` or modern browsers).
- **Fix**: Ensure that any anchor link targeting external websites with `target="_blank"` includes `rel="noopener noreferrer"`.
- **Verification**: Search for `<a ` tags combined with `target="_blank"` across the codebase to ensure all occurrences conform to using `rel="noopener noreferrer"`.

## 2026-08-06 - Missing Content Security Policy (CSP)

**Vulnerability**: The static Astro site was lacking a Content Security Policy (CSP). Without a CSP, the application is more susceptible to Cross-Site Scripting (XSS) attacks, as the browser will execute any inline scripts or load resources from any domain.
**Learning**: Even for statically generated sites (like this Astro app), a CSP is a critical defense-in-depth measure. While the risk might seem lower without complex backend logic, XSS can still occur through DOM manipulation or third-party dependencies.
**Prevention**: Add a `<meta http-equiv="Content-Security-Policy" content="...">` tag to the global layout (e.g., `src/layouts/Layout.astro`). A strict baseline for static sites often includes `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self';`.

## 2026-08-06 - CSP 'unsafe-inline' limitations in Astro Static Builds

**Vulnerability**: The Content Security Policy (CSP) uses `script-src 'unsafe-inline'` which weakens XSS mitigation.
**Learning**: Astro relies on injected inline scripts to hydrate `client:*` components (React islands). Implementing strict nonces or hashes for these dynamically generated inline scripts in a purely static build (`output: "static"`) is highly complex and not supported out-of-the-box by Astro without custom post-processing or a server middleware layer (which this static hosting setup does not have).
**Prevention**: While 'unsafe-inline' is present, the site does not process untrusted user input or URL parameters into the DOM, mitigating the primary vectors for XSS. The current CSP still provides value by restricting external script execution. Removing 'unsafe-inline' entirely would require moving to server-side rendering (SSR) to inject nonces per-request, or implementing a complex post-build hashing script.
