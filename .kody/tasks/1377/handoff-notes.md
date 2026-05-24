Fixed Prettier formatting failure in CI "Fast Gate - Check formatting with Prettier" step.

Root cause: kody.config.json had code style issues flagged by Prettier (trailing commas, quote style, or line-length - standard Prettier violations).

Fix: Ran `pnpm format` which auto-fixed kody.config.json using Prettier's --write. Verified with `pnpm format:check` which now passes with "All matched files use Prettier code style!"

CI step should now pass on re-run.
