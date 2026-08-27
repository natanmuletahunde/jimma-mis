# Jimma City Digital Street Address MIS — Documentation Package

Prepared 27 August 2026.

## Documents

1. **01-functional-and-non-functional-requirements.pdf** — Functional scope, quality requirements, and acceptance checklist.
2. **02-technology-and-deployment-strategy.pdf** — Technology stack, architecture, deployment/release strategy, backup, and operations.
3. **03-hands-on-user-manual-with-screenshots.pdf** — Sign-in, registration, offline collection, review, approval, SMS alerts, and troubleshooting.
4. **04-user-list-and-access-matrix.pdf** — Supported roles, permissions, demo/test accounts, provisioning checklist, and a user register template.
5. **05-property-registration-workflow.pdf** — Status flow, actor responsibilities, address code generation, notifications, and exception handling.

The `assets/` folder contains the logo and the current application screenshots used by the user manual. `build_docs.py` regenerates the PDFs when the implemented workflow changes.

## Distribution note

Demo credentials are included in the access-matrix document for controlled training only. Change or disable them before production use. Never distribute API keys, SMTP passwords, or other secrets with this package.
