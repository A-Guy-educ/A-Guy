# [BUG] Broken Lesson URL Generation (/view suffix)

Description

 

Problem Statement: Lesson links are incorrectly generated with a trailing /view path segment, which causes a routing error and prevents the page from loading correctly.

Example of Broken Link: https://www.aguy.co.il/courses/7th_grade_math/chapters/---/lessons/seder_peulot/view

Behavioral Requirements:

URL Sanitization: The link generation logic must be updated to ensure the /view suffix is never appended to lesson URLs.

Redirection/Handling: If an existing link contains /view, the system should ideally handle it by stripping the suffix to prevent 404 errors for legacy or cached links.

Acceptance Criteria:

[ ] Identify and update the specific service/component responsible for constructing lesson URLs.

[ ] Verify that all generated lesson links end at the lesson slug (e.g., .../lessons/seder_peulot/) without the /view addition.

[ ] Ensure all functional tests for lesson routing pass without errors.