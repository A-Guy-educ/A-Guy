# Smoke Checks

After any migration stage, verify these critical paths:

## Web Application

1. **Login page** - Navigate to `/login`
   - Expected: Page loads, no console errors
   - Auth form renders

2. **Home page** - Navigate to `/`
   - Expected: Hero section renders, navigation works

3. **Course page** - Navigate to `/courses`
   - Expected: Course cards load, filtering works

4. **Study page** - Navigate to a study page
   - Expected: Exercise content renders, interactive elements work

## Admin Panel

5. **Payload admin** - Navigate to `/admin`
   - Expected: Admin dashboard loads (HTTP 200 or 3xx redirect)
   - Collections accessible

## API Endpoints

6. **Health check** - `curl http://localhost:3000/api/health`
   - Expected: HTTP 200, non-empty JSON response

7. **PDF viewer** - `curl "http://localhost:3000/api/pdfjs-viewer?file=test.pdf"`
   - Expected: PDF viewer responds correctly

## Verification Commands

```bash
# All-in-one smoke test
./scripts/smoke-test.sh

# Individual checks
curl -s http://localhost:3000/api/health
```
