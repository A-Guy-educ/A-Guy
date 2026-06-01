## Fix: Media Expiry Cleanup workflow failing with exit code 3

### Root Cause
The `media-cleanup.yml` workflow was using `${{ secrets.CRON_ENDPOINT }}` directly in the curl URL string. When this secret was not set (empty), the URL became just `/api/cron/media-expiry` - a relative path without a host. curl exit code 3 indicates "URL malformed" because curl cannot resolve a hostless URL.

### What Changed
Added a validation guard before the curl call to check if `CRON_ENDPOINT` is set. Also restructured secrets as env block for cleaner variable handling.

### Key Changes in .github/workflows/media-cleanup.yml
1. Added `if [ -z "$CRON_ENDPOINT" ]; then` check with descriptive error message
2. Changed secrets from inline `${{ secrets.X }}` to env block pattern
3. Uses explicit env block with CRON_ENDPOINT and CRON_SECRET

### After Merge
The workflow will now fail with a clear error message if CRON_ENDPOINT is not configured. Once the GitHub Actions environment secrets are set (CRON_ENDPOINT pointing to the Vercel deployment URL and CRON_SECRET matching the app's env var), the cron job will work.
