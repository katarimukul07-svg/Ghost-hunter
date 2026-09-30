# Security policy

Production ranked activation remains disabled. See [the POC](docs/SECURITY_POC.md)
and [applicability register](docs/SECURITY_REGISTER.md) before activating services.

Report suspected vulnerabilities privately to the repository owner through an
available private channel. Do not open public issues containing credentials,
player data or exploit details against live services. Do not test production or
third-party infrastructure without explicit authorization.

If a credential is exposed, record only its type, path and safe fingerprint;
revoke/rotate it through the provider, check access records and remove exposure.
Deleting the current file does not remove Git history. No public credential
should be treated as safe because this repository is public.

Run the security gate and authorization tests for changes to backend, identity,
builds or dependencies. New feature PRs must update the applicability register.
Owner review and required CI remain mandatory; never bypass protections or merge
a PR automatically as part of security testing.
