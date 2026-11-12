# Contributing & Workflow Notes

This repository is built one small, tested feature at a time so every change is easy to follow and verify.

## Branching

- `main`: stable code that builds and passes tests.
- `feature/<name>`: new features (for example, `feature/cube-representation`).
- `fix/<name>`: bug fixes.

## Commit style

We use short, clear conventional commits:

- `feat(cube): ...` for new features
- `fix(cv): ...` for bug fixes
- `test(solver): ...` for tests and benchmarks
- `docs: ...` for documentation updates
- `chore: ...` for setup and maintenance

## Rules before merging to `main`

1. Build and run the relevant tests locally.
2. Check `git status` and `git diff` so no build files, virtualenvs, secrets, or raw datasets get committed.
3. Update `CHANGELOG.md` and `docs/roadmap.md` when a milestone wraps up.

