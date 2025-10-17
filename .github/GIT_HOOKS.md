# Git Hooks Setup

This project uses [Husky](https://typicode.github.io/husky/) to run pre-commit checks automatically.

## What Gets Checked

Before every commit, the following checks run on **frontend files only**:

1. **ESLint** - Checks for code quality and Next.js best practices
2. **TypeScript** - Validates type correctness
3. **lint-staged** - Auto-fixes formatting issues

## Installation

Git hooks are automatically installed when you run:

```bash
npm install
```

in the `frontend` directory (via the `prepare` script).

## What Happens on Commit

When you run `git commit`:

```bash
git commit -m "feat: add new feature"
```

You'll see:
```
🔍 Running pre-commit checks...
📝 Frontend files changed, running checks...
🔧 Running ESLint...
✅ ESLint passed
📘 Running TypeScript type check...
✅ TypeScript check passed
🎨 Running lint-staged...
✅ lint-staged passed
✅ All pre-commit checks passed!
```

If any check fails, the commit will be **blocked** and you'll see error messages.

## Fixing Issues

### ESLint Errors

```bash
cd frontend
npm run lint:fix
```

### TypeScript Errors

Fix the errors shown in the output, then try committing again.

### Bypassing Checks (Emergency Only)

⚠️ **Not recommended** - only use in emergencies:

```bash
git commit -m "emergency fix" --no-verify
```

## Manual Checks

Run checks manually without committing:

```bash
cd frontend

# Run ESLint
npm run lint

# Run ESLint with auto-fix
npm run lint:fix

# Run TypeScript check
npm run type-check

# Run all (simulates pre-commit)
npm run lint && npm run type-check
```

## Configuration Files

- `.husky/pre-commit` - Pre-commit hook script
- `frontend/package.json` - lint-staged configuration
- `frontend/.prettierrc` - Prettier formatting rules
- `frontend/eslint.config.mjs` - ESLint rules

## Benefits

✅ **Catch errors early** - Before they reach CI/CD
✅ **Consistent code quality** - Automated enforcement
✅ **Save time** - No waiting for CI to fail
✅ **Auto-formatting** - Prettier fixes formatting automatically
✅ **Better PRs** - Clean, lint-free code

## Troubleshooting

### Hooks not running

```bash
# Reinstall hooks
cd frontend
npm run prepare
```

### Permission denied

```bash
chmod +x .husky/pre-commit
```

### Hooks running but not finding npm/node

Make sure Node.js is in your PATH. Add to `~/.zshrc` or `~/.bashrc`:

```bash
export PATH="/usr/local/bin:$PATH"
```

## Updating Hooks

To modify what gets checked:

1. Edit `.husky/pre-commit` for check logic
2. Edit `frontend/package.json` lint-staged section for file-specific actions
