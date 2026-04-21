# Intermittent PDF Loading Failures (404 / Silent Failure)

Description

Users are reporting inconsistent behavior when trying to open lesson PDFs. The issue manifests in two ways:

404 Error: The request to the storage bucket or CDN returns a Not Found error.

Silent Failure: The PDF viewer opens, but the content never loads (spinner hangs indefinitely or a blank screen appears).

This appears to be intermittent and may be related to race conditions during asset fetching or stale signed URLs.

Acceptance Criteria
Identify the root cause of the intermittent 404 errors (check URL expiration or CDN propagation).

Resolve the "silent failure" where the UI doesn't handle a failed fetch gracefully.

Implement a retry mechanism for transient network failures.

Ensure a user-friendly error message is displayed if the PDF absolutely cannot be loaded.