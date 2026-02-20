# Clarification Needed: 260214-seo-meta-tags

I have some questions about the requirements. Please answer each question:

## DATA (Default metadata values)

1. **Question:** What should the global default **site title** be?
   - **Option A:** Static title only (e.g., `A-Guy`)
   - **Option B:** Default + template (e.g., `A-Guy | %s`)
   - **Your answer:** \_\_\_

2. **Question:** What should the global default **meta description** be?

3. **Question:** Do you want to include **meta keywords**?
   - **Option A:** Include keywords
   - **Option B:** Omit keywords (modern SEO best practice)

## BEHAVIOR (URLs + social metadata)

4. **Question:** What is the canonical **site URL** for `og:url`?
   - **Option A:** `https://www.aguy.co.il`
   - **Option B:** Use env var

5. **Question:** What should the default **Open Graph image** be?
   - **Option A:** Use existing `/website-template-OG.webp`
   - **Option B:** Create new asset

6. **Question:** What should `og:type` be globally?
   - **Option A:** `website`

7. **Question:** Twitter card settings:
   - **twitter:card:** `summary_large_image`
   - **twitter:site:** `@aguy`

## LOCATION

8. **Question:** Confirm the root layout file to update.
   - **Answer:** `src/app/(frontend)/layout.tsx`

## ASSETS

9. **Question:** Which favicon assets should we support?
   - **Option A:** Minimal: `public/favicon.ico` + `public/favicon.svg`
   - **Answer:** We already have favicon.ico and favicon.svg in public/

## OPTIONAL

10. **Question:** Do you need locale-aware metadata?
    - **Option A:** Single global default

---

## Your Answers

Please reply with your answers (1-10).
