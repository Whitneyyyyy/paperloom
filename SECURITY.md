# Security

## Supported scope

The current release is a local, single-user application. It binds to `127.0.0.1` and is not intended to be exposed directly to the public internet. It does not implement public user registration, password authentication or network-level multi-user access.

The local computer and its processes are part of the application's trust boundary. Server-side record isolation is not a replacement for verified authentication when adding remote hosting.

## Reporting a vulnerability

Use GitHub's **Security → Advisories → Report a vulnerability** when private vulnerability reporting is enabled for this repository. Maintainers should enable it before promoting a public release.

If that entry is unavailable, open an issue asking for a private reporting channel without including exploit details, personal data, cookies or credentials. No private contact email is embedded in this project.

## Data handling

- Keep `data/`, custom data directories, `.env`, local databases and private PDFs out of commits.
- Share a synthetic reproduction rather than a private manuscript.
- Back up your library before upgrading.
- Retain source, origin and owner authorization checks when changing storage or identity adapters.

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the local service's deployment boundary.
