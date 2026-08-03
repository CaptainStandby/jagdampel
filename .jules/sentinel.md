# Sentinel Security Learnings

## 1. Missing `noreferrer` on external links (`target="_blank"`)

- **Context**: When using `target="_blank"` on an external anchor `<a>` element, omitting `noreferrer` can allow the target page to access the referrer header (potentially leaking private URLs) and access the parent window context (reverse tabnabbing, though mitigated by `noopener` or modern browsers).
- **Fix**: Ensure that any anchor link targeting external websites with `target="_blank"` includes `rel="noopener noreferrer"`.
- **Verification**: Search for `<a ` tags combined with `target="_blank"` across the codebase to ensure all occurrences conform to using `rel="noopener noreferrer"`.

## 2025-02-23 - [Unbounded length limit on URL parameters]
**Vulnerability:** URL parameters reading values directly into client state without bounding length constraint can lead to processing denial of service risks.
**Learning:** React state reading from `window.location.search` was loading unconstrained parameter lengths (e.g., search text) which could slow down rendering and memory allocation.
**Prevention:** Cap the length of parameters read from untrusted sources before parsing or passing to UI components.
