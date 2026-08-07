# Sentinel Security Learnings

## 1. Missing `noreferrer` on external links (`target="_blank"`)

- **Context**: When using `target="_blank"` on an external anchor `<a>` element, omitting `noreferrer` can allow the target page to access the referrer header (potentially leaking private URLs) and access the parent window context (reverse tabnabbing, though mitigated by `noopener` or modern browsers).
- **Fix**: Ensure that any anchor link targeting external websites with `target="_blank"` includes `rel="noopener noreferrer"`.
- **Verification**: Search for `<a ` tags combined with `target="_blank"` across the codebase to ensure all occurrences conform to using `rel="noopener noreferrer"`.
