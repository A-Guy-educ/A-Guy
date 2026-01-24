# Release Management

This project uses [semantic-release](https://github.com/semantic-release/semantic-release) for fully automated version management and release publishing.

## Prerequisites

**Node.js 22+ required** - semantic-release v25 requires Node.js 22 or higher. Install using nvm (`nvm install 22 && nvm use 22`) or download from [nodejs.org](https://nodejs.org/).

## How It Works

**Semantic-release analyzes your commit messages** to automatically:
- Determine the next version number
- Generate release notes
- Update CHANGELOG.md
- Create a git tag
- Publish a GitHub release

## Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/) format, enforced by commitlint:

```
<type>(<scope>): <subject>

<body>
```

### Commit Types & Version Bumps

| Type | Version Bump | Example |
|------|--------------|---------|
| `feat:` | **Minor** (1.0.0 → 1.1.0) | `feat: add user profile page` |
| `fix:` | **Patch** (1.0.0 → 1.0.1) | `fix: repair broken login form` |
| `perf:` | **Patch** (1.0.0 → 1.0.1) | `perf: optimize image loading` |
| `docs:` | **Patch** (1.0.0 → 1.0.1) | `docs: update API documentation` |
| `refactor:` | **Patch** (1.0.0 → 1.0.1) | `refactor: simplify auth logic` |
| `build:` | **Patch** (1.0.0 → 1.0.1) | `build: update webpack config` |
| `feat!:` or `BREAKING CHANGE:` | **Major** (1.0.0 → 2.0.0) | `feat!: redesign authentication system` |

**No version bump:**
- `ci:` - CI configuration changes
- `chore:` - Maintenance tasks
- `test:` - Adding/updating tests
- `style:` - Code formatting (no logic changes)

### Breaking Changes

To trigger a major version bump, use one of these:

**Option 1: Exclamation mark**
```
feat!: redesign user authentication

BREAKING CHANGE: Authentication now requires OAuth 2.0
```

**Option 2: Footer**
```
feat: add new payment provider

BREAKING CHANGE: PaymentService.process() now returns Promise instead of callback
```

## Release Workflow

### Automatic Releases (Recommended)

1. **Develop on `dev` branch** with conventional commits
2. **Merge to `main`** (manually or via automated weekly merge)
3. **GitHub Actions automatically runs** semantic-release
4. **Release is published** if there are releasable commits

```
dev branch → merge to main → semantic-release runs → release created
```

### Manual Trigger

You can manually trigger a release from the GitHub Actions UI:
1. Go to **Actions** → **Release** workflow
2. Click **Run workflow**
3. Select `main` branch
4. Click **Run workflow**

## Testing Releases Locally

Before pushing, test what semantic-release will do:

```bash
# Dry run - see what would happen without making changes
pnpm release:dry-run
```

This will show:
- What version would be released
- What commits would be included
- What the changelog would look like

## Release Artifacts

Each release creates:

1. **Git Tag** - `v1.2.3` format
2. **GitHub Release** - with auto-generated release notes
3. **Updated CHANGELOG.md** - committed to the repository
4. **Updated package.json** - version bumped automatically

## Examples

### Feature Release (Minor Version)

```bash
# Commits on dev
git commit -m "feat: add user dashboard

Adds a new dashboard page with user statistics and activity overview."

git commit -m "feat: add export functionality

Users can now export their data as CSV or JSON."

# Merge to main → semantic-release runs
# Result: 1.0.0 → 1.1.0
```

### Bug Fix Release (Patch Version)

```bash
git commit -m "fix: resolve login timeout issue

Increases session timeout from 5 to 15 minutes to prevent
unexpected logouts during active sessions."

# Merge to main → semantic-release runs
# Result: 1.1.0 → 1.1.1
```

### Breaking Change (Major Version)

```bash
git commit -m "feat!: redesign authentication system

BREAKING CHANGE: All users must re-authenticate after this update.
The new system uses OAuth 2.0 instead of session-based auth."

# Merge to main → semantic-release runs
# Result: 1.1.1 → 2.0.0
```

## Configuration

### semantic-release Configuration

Configuration is in [`.releaserc.json`](../.releaserc.json):

- **Branches:** Only `main` triggers releases
- **Plugins:**
  - `commit-analyzer` - Determines version from commits
  - `release-notes-generator` - Creates release notes
  - `changelog` - Updates CHANGELOG.md
  - `npm` - Updates package.json (no publish to npm)
  - `git` - Commits changes and creates tags
  - `github` - Creates GitHub releases

### GitHub Actions Workflow

The release workflow ([`.github/workflows/release.yml`](../.github/workflows/release.yml)):

- **Triggers:** Push to `main` or manual dispatch
- **Skips:** Commits with `[skip ci]` (prevents infinite loops)
- **Permissions:** Needs write access to create releases and tags

## Troubleshooting

### No Release Created

**Possible reasons:**
- No releasable commits since last release
- Only commits with types that don't trigger releases (ci, chore, test, style)
- All commits since last release were already released

**Solution:** Check commit history and ensure you're using releasable commit types.

### Release Failed

**Check:**
1. GitHub Actions logs for error details
2. Ensure `GITHUB_TOKEN` has correct permissions
3. Verify no conflicts in CHANGELOG.md or package.json
4. Run `pnpm release:dry-run` locally to debug

### Dependabot PRs

Dependabot automatically creates PRs with conventional commits:
- `build(deps): bump package-name` → triggers patch release
- You can merge multiple dependency PRs before releasing

## Best Practices

1. **Write clear commit messages** - They become your release notes
2. **Use conventional commits** - Required for semantic-release
3. **Batch related changes** - Group related features in one commit
4. **Test before merging to main** - Main branch should always be releasable
5. **Review generated changelog** - Check GitHub releases page after deployment
6. **Use dry-run locally** - Test what will happen before pushing

## Related Documentation

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
- [semantic-release Documentation](https://semantic-release.gitbook.io/)
- [Project Commitlint Config](../commitlint.config.js):
