# Security and learning-data handling

EE_Review has no account system, application database or answer-upload API.
The application stores progress, exercise attempts, design answers, simulation
check entries and fault-finding state in the current browser's localStorage.
There is no automatic expiration. Storage can be removed by clearing site data;
private browsing, quota limits and browser policies can also prevent retention.

The **Learning data** control downloads a JSON copy or deletes the course's
`AD_course_v1.*` and `design:*` records. Deletion does not clear unrelated keys,
browser caches or downloaded files. A failed deletion is reported, not presented
as success. Failed saves remain in page memory and display a warning. There is
no restore/import feature yet. An export made while storage is blocked may be
incomplete and carries that fact in its metadata.

Browser storage is scoped by origin, not repository URL. Other applications on
the same `jfalvarez1.github.io` origin can access it; the historical `design:`
prefix can also collide with another application using that prefix. Do not enter
confidential board/project information into the public site. Offline files and
different localhost ports may have different storage behavior.

GitHub Pages receives normal requests for the hosted course. The online MathJax
script is fetched from jsDelivr. These third parties have their own access-log
and retention policies; the course cannot erase those logs. The application
does not intentionally send learning records to either service. Executable
third-party scripts nevertheless share the page's browser privileges.

## Local preview server

`python tools/serve.py` binds to loopback by default. Use `--lan` deliberately to
share with devices on a trusted network. There is no authentication or TLS in
this development server. It serves only `index.html`, `components.html`, `assets`,
`lessons` and `docs`; hidden paths, directory listings and symlink escapes to
private content are denied. Keep private data out of these public directories.
Generic `python -m http.server` does not provide this repository's restrictions.

## Reporting a problem

Use the repository's private vulnerability reporting facility if it is enabled.
Do not put credentials, private learning records or private board files into a
public issue. If private reporting is unavailable, a public issue can request a
private contact method without including exploit details or sensitive data.

This policy and the regression checks describe specific boundaries. They are
not a claim of a complete security audit or a guarantee that all legacy code is
free of vulnerabilities.
