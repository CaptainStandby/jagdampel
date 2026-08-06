# Sentinel Security Learnings

## 1. Missing `noreferrer` on external links (`target="_blank"`)

- **Context**: When using `target="_blank"` on an external anchor `<a>` element, omitting `noreferrer` can allow the target page to access the referrer header (potentially leaking private URLs) and access the parent window context (reverse tabnabbing, though mitigated by `noopener` or modern browsers).
- **Fix**: Ensure that any anchor link targeting external websites with `target="_blank"` includes `rel="noopener noreferrer"`.
- **Verification**: Search for `<a ` tags combined with `target="_blank"` across the codebase to ensure all occurrences conform to using `rel="noopener noreferrer"`.

## 2026-08-06 - Missing Content Security Policy (CSP)

**Vulnerability**: The static Astro site was lacking a Content Security Policy (CSP). Without a CSP, the application is more susceptible to Cross-Site Scripting (XSS) attacks, as the browser will execute any inline scripts or load resources from any domain.
**Learning**: Even for statically generated sites (like this Astro app), a CSP is a critical defense-in-depth measure. While the risk might seem lower without complex backend logic, XSS can still occur through DOM manipulation or third-party dependencies.
**Prevention**: Add a `<meta http-equiv="Content-Security-Policy" content="...">` tag to the global layout (e.g., `src/layouts/Layout.astro`). A strict baseline for static sites often includes `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self';`.
