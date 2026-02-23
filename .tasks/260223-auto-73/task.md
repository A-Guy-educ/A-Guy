# Task

Thanks for assigning this issue to me. I'm starting to work on it and will keep this PR's description up to date as I form a plan and make progress.

<!-- START COPILOT ORIGINAL PROMPT -->



<details>

<summary>Original prompt</summary>

> 
> ----
> 
> *This section details on the original issue you should resolve*
> 
> <issue_title>[MEDIUM] Bug:  Loading Text Does Not Align With Active Locale</issue_title>
> <issue_description># Description
> 
> In the Development environment, the loading indicator text ("Loading..." / "טוען...") does not consistently match the active website language.
> 
> Observed behavior (Dev only):
> 
> * The website may render in Hebrew.
> * The loading indicator still displays in English ("Loading...").
> 
> Since the current Production environment reflects an older version of Dev, the focus should be on correcting behavior in Development, as it will become the next Production release.
> 
> This is not a missing translation issue. Both language keys exist. The problem is that the loading text in Dev does not reliably follow the active locale used by the rest of the page.
> 
> ---
> 
> ## Expected Behavior
> 
> In Development:
> 
> * If the website is rendered in Hebrew → the loading text must be "טוען..."
> * If the website is rendered in English → the loading text must be "Loading..."
> 
> The loading text must be derived from the same locale resolution mechanism used for the page content.
> 
> ---
> 
> ## Impact
> 
> * Inconsistent UI language in the upcoming release.
> * Reduced UX coherence.
> * Potential indication of a mismatch between locale resolution and UI rendering layers in Dev.
> </issue_description>
> 
> <agent_instructions># Task: Fix Loading Text Locale Mismatch (Development)
> 
> ## Context
> 
> In the Development environment, the loading indicator text does not consistently match the active website language.
> 
> Observed behavior:
> 
> * The website may render in Hebrew.
> * The loading indicator still displays in English ("Loading...").
> 
> Production currently reflects an older Dev version, so the focus is to correct behavior in Development before it is released.
> 
> This is not a missing translation issue. Both language keys already exist.
> 
> ---
> 
> ## Goal
> 
> Ensure that the loading indicator text always matches the currently resolved active locale in Development.
> 
> Expected behavior:
> 
> * If the website is rendered in Hebrew → show "טוען..."
> * If the website is rendered in English → show "Loading..."
> 
> The loading text must use the same locale resolution mechanism as the rest of the page content.
> 
> ---
> 
> ## Requirements
> 
> 1. Identify where the loading text is rendered.
> 2. Verify how the active locale is passed to that component.
> 3. Ensure the loading text is derived via the existing translation mechanism (not hardcoded).
> 4. Confirm the correct locale is used in Dev for both Hebrew and English.
> 5. Do not introduce new locale detection logic.
> 6. Do not change the overall locale resolution architecture.
> 
> ---
> 
> ## Definition of Done
> 
> * In Development:
> 
>   * Hebrew UI → "טוען..."
>   * English UI → "Loading..."
> * No hardcoded loading strings remain.
> * No regression in other translated content.
> * No change in routing or middleware behavior.
> </agent_instructions>
> 
> ## Comments on the Issue (you are @copilot in this section)
> 
> <comments>
> </comments>
> 


</details>



<!-- START COPILOT CODING AGENT SUFFIX -->

- Fixes A-Guy-educ/A-Guy#503

<!-- START COPILOT CODING AGENT TIPS -->
---

🔒 GitHub Advanced Security automatically protects Copilot coding agent pull requests. You can protect all pull requests by enabling Advanced Security for your repositories. [Learn more about Advanced Security.](https://gh.io/cca-advanced-security)
