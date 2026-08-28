You are a Senior Staff Software Engineer, Security Engineer, Open Source Maintainer, API Designer, DevOps Engineer, Technical Writer, and Release Manager.

Your task is to perform a COMPLETE production-grade audit of this TypeScript Open Source SDK.

Do NOT only review the code.
Review the ENTIRE repository as if you are approving it for production release.

Your review should follow modern industry standards including:

- Google Engineering Practices
- Microsoft TypeScript Guidelines
- Airbnb Style Guide
- OWASP Top 10
- OWASP ASVS
- OpenSSF Best Practices
- CNCF Recommendations
- Semantic Versioning
- Conventional Commits
- npm Best Practices
- GitHub Open Source Best Practices
- Supply Chain Security
- Modern SDK Design Principles

--------------------------------------------------------
1. PROJECT STRUCTURE
--------------------------------------------------------

Review:

- folder structure
- package organization
- module boundaries
- dependency graph
- circular dependencies
- code duplication
- dead code
- unnecessary files
- missing files
- barrel exports
- tree-shaking compatibility

Score out of 10.

--------------------------------------------------------
2. TYPESCRIPT QUALITY
--------------------------------------------------------

Review:

- strict mode
- typing quality
- any usage
- unknown usage
- type safety
- generic correctness
- inference quality
- discriminated unions
- enums
- interfaces vs types
- overloads
- declaration files
- public API types

Find every issue.

Suggest better patterns.

--------------------------------------------------------
3. CODE QUALITY
--------------------------------------------------------

Check:

- readability
- maintainability
- SOLID
- DRY
- KISS
- YAGNI
- clean architecture
- separation of concerns
- abstraction quality
- naming conventions
- file naming
- function size
- class size
- complexity
- code smells

Rate every module.

--------------------------------------------------------
4. API DESIGN
--------------------------------------------------------

Review SDK usability.

Check:

- intuitive API
- fluent API
- naming consistency
- discoverability
- DX (Developer Experience)
- backwards compatibility
- extensibility
- ergonomics

Suggest improvements.

--------------------------------------------------------
5. ERROR HANDLING
--------------------------------------------------------

Review:

- error hierarchy
- custom errors
- stack traces
- retry logic
- timeout handling
- cancellation
- AbortSignal support
- validation
- defensive programming

--------------------------------------------------------
6. SECURITY AUDIT
--------------------------------------------------------

Perform an OWASP style audit.

Check for:

- command injection
- path traversal
- prototype pollution
- XSS
- SSRF
- insecure deserialization
- ReDoS
- unsafe regex
- eval()
- Function()
- child_process usage
- shell execution
- dependency vulnerabilities
- secret leakage
- API keys
- tokens
- credentials
- unsafe logging
- insecure randomness
- crypto misuse

Review npm supply-chain risks.

Review package-lock security.

Review dependency risks.

Suggest fixes.

--------------------------------------------------------
7. PERFORMANCE
--------------------------------------------------------

Review:

- allocations
- memory leaks
- async bottlenecks
- event loop blocking
- bundle size
- lazy loading
- unnecessary object creation
- caching
- streaming
- concurrency
- async correctness

--------------------------------------------------------
8. TESTING
--------------------------------------------------------

Review:

- unit tests
- integration tests
- coverage
- edge cases
- mocking quality
- flaky tests
- snapshot usage

Suggest missing tests.

Estimate coverage quality.

--------------------------------------------------------
9. LINTING & FORMATTING
--------------------------------------------------------

Review:

- ESLint
- Prettier
- tsconfig
- strict mode
- compiler options
- path aliases
- project references

--------------------------------------------------------
10. BUILD SYSTEM
--------------------------------------------------------

Review:

- tsup
- rollup
- vite
- webpack
- esbuild

Check:

- ESM
- CommonJS
- exports
- package.json
- sideEffects
- types
- module resolution

--------------------------------------------------------
11. PACKAGE QUALITY
--------------------------------------------------------

Review package.json

Check:

- keywords
- exports
- files
- engines
- funding
- homepage
- bugs
- repository
- publishConfig
- peerDependencies
- optionalDependencies

Check npm best practices.

--------------------------------------------------------
12. GITHUB REPOSITORY
--------------------------------------------------------

Review:

README.md

CHANGELOG.md

LICENSE

CONTRIBUTING.md

CODE_OF_CONDUCT.md

SECURITY.md

SUPPORT.md

CODEOWNERS

FUNDING.yml

Issue Templates

PR Templates

GitHub Discussions

Labels

Releases

Versioning

Badges

Examples

--------------------------------------------------------
13. DOCUMENTATION
--------------------------------------------------------

Review:

installation

quick start

API reference

examples

migration guide

FAQ

architecture

contributing guide

security policy

release process

developer guide

Rate documentation quality.

--------------------------------------------------------
14. CI/CD
--------------------------------------------------------

Review GitHub Actions.

Check:

lint

build

tests

typecheck

coverage

release

npm publish

security scanning

dependency updates

codeql

secret scanning

SBOM generation

license scanning

artifact signing

--------------------------------------------------------
15. DEPENDENCY AUDIT
--------------------------------------------------------

Review every dependency.

Identify:

unused

outdated

duplicate

heavy

unsafe

abandoned

Suggest replacements.

--------------------------------------------------------
16. LICENSE COMPLIANCE
--------------------------------------------------------

Verify:

license compatibility

third-party licenses

copyright notices

NOTICE files

SPDX identifiers

--------------------------------------------------------
17. OPEN SOURCE READINESS
--------------------------------------------------------

Evaluate whether this repository is ready for public open-source adoption.

Check:

examples

documentation

API stability

versioning

maintainer friendliness

community friendliness

onboarding

--------------------------------------------------------
18. RELEASE READINESS
--------------------------------------------------------

Determine whether this SDK is production ready.

Provide:

Release Blockers

Major Issues

Minor Issues

Suggestions

--------------------------------------------------------
19. FINAL REPORT
--------------------------------------------------------

Produce:

Overall Score (100)

Architecture Score

Security Score

Performance Score

Documentation Score

Developer Experience Score

Testing Score

Maintainability Score

Production Readiness Score

Open Source Readiness Score

--------------------------------------------------------
20. PRIORITY ACTION ITEMS
--------------------------------------------------------

Categorize findings into:

🔴 Critical
🟠 High
🟡 Medium
🟢 Low

Each issue must include:

- file
- line number (if possible)
- description
- why it matters
- recommended fix
- code example

--------------------------------------------------------
21. POSITIVE FEEDBACK
--------------------------------------------------------

Also identify:

best designed modules

cleanest code

good practices

innovative patterns

strengths

--------------------------------------------------------
22. FINAL VERDICT
--------------------------------------------------------

Choose one:

✅ Production Ready

⚠ Production Ready with Minor Fixes

⚠ Needs Significant Improvements

❌ Not Ready

Explain why.

Never stop after reviewing only a few files.
Review every accessible file in the repository.