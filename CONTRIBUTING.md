# Contributing to Paperloom

Thanks for helping make research libraries easier to use. Small, well-explained improvements are welcome: metadata extraction examples, accessible interactions, clearer documentation, reproducible bug reports and focused pull requests.

## Run locally

Use Node.js 24.15 or newer. No npm runtime dependency installation is required.

```bash
npm start
npm run demo
```

Run one server at a time, or choose different ports. The demo uses synthetic documents in a separate directory. See [README.md](README.md) for configuration.

## Before opening a pull request

1. Explain the concrete problem and the resulting behavior.
2. Keep the change focused; include a screenshot when visible behavior changes.
3. Add a meaningful regression test when fixing a behavioral bug.
4. After changing shared modules under `lib/`, run `npm run prepare:client`.
5. Run `npm test` and `npm run check`.

## Good issues

- Describe the steps, what you expected and what happened.
- Include operating system, Node version and browser version where relevant.
- Reproduce with a synthetic or publicly shareable PDF when possible.
- Remove personal names, emails, local paths, cookies and private notes from logs and screenshots.
- Do not upload copyrighted or confidential papers without permission.

For vulnerabilities, follow [SECURITY.md](SECURITY.md) rather than posting exploit details in a public issue.

## Design and project scope

Paperloom uses a quiet black-and-white interface, with color reserved for category meanings and highlights. Prefer clear actions, editable automatic results and minimal repeated metadata. Unrelated papers should not be forced into the graph.

The current release targets a local single-user workflow. Authentication adapters, multi-user hosting and large-library computation should be discussed before implementation.

## Attribution and privacy

Project-level attribution uses **Paperloom contributors**. You may use a public pseudonym for contributions. Configure a GitHub-provided no-reply commit email if you do not want a private email in commit history. GitHub still displays the public account that owns a repository or authors a commit.

Contributions are provided under the project's [MIT License](LICENSE). Keep required third-party notices intact.
