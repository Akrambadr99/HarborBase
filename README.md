<p align="center">
  <img src="docs/media/project-banner.svg" alt="SkillOrbit — Versioned learning rules, assessments and credential eligibility" width="100%">
</p>

<p align="center"><strong>Versioned learning rules, assessments and credential eligibility</strong></p>

<p align="center"><a href="#overview">Overview</a> · <a href="#explore">Explore</a> · <a href="#getting-started">Getting started</a></p>

<p align="center"><code>React</code> · <code>TypeScript</code> · <code>Vite</code></p>

## Overview

**SkillOrbit** is a React and TypeScript application for versioned learning rules, assessments and credential eligibility. Explore its records, workflows, and operational views from the local workspace.

**Repository:** `HarborBase` · **Application name:** SkillOrbit. The application branding and code are unchanged.

This project belongs to a related operations-application portfolio and shares foundation code and conventions with sibling repositories.

![SkillOrbit: actual local application overview with fixture data](docs/media/overview.png)

*Actual application capture using local fixture data.*

## Explore

- Courses
- Prerequisite rules
- Assessment attempts
- Course completions
- Certifications
- Certification requirements
- Credential awards
- Recertification requests

## Getting started

Node.js requirement: `>=20.19 <21`. Use the package manager specified in [package.json](package.json).

```bash
git clone https://github.com/Akrambadr99/HarborBase.git
cd HarborBase
npm ci
npm run dev
```

Open the URL printed by the development server.

### Development commands

| Command | Script defined by this project |
| --- | --- |
| `npm run dev` | `vite` |
| `npm run typecheck` | `tsc -b` |
| `npm run lint` | `eslint . --max-warnings 0` |
| `npm run test` | `vitest run` |
| `npm run test:e2e` | `playwright test` |
| `npm run build` | `npm run typecheck && vite build && node scripts/check-entry-budget.mjs` |

See the project guide below for browser installation and any service-specific setup.

## Project notes

The preview uses local fixture data. Workflow and role controls demonstrate application behavior; this page does not imply a certified, hosted, or production-integrated service.

<details>
<summary><strong>Project guide, technical details, and existing documentation</strong></summary>

# SkillOrbit

A domain-specific React application rebuilt as part of a ten-product engineering portfolio. See the source domain engine and its tests for the core invariants.

</details>

---

<p align="center"><a href="https://github.com/Akrambadr99?tab=repositories">Explore the portfolio</a></p>
