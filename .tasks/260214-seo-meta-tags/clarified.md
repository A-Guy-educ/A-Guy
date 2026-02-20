# Clarified Spec: 260214-seo-meta-tags

## Answers to Questions

### DATA (Default metadata values)

1. **Site title:** A-Guy | תרגול מתמטיקה אינטראקטיבי
2. **Meta description:** פלטפורמה לתרגול מתמטיקה עם שיעורים מסודרים, תרגילים ממוקדים, משוב מיידי והסברים ברורים שלב אחר שלב – בנויה להתקדמות עקבית ואמיתית.
3. **Keywords:** Omit (modern SEO best practice)

### BEHAVIOR (URLs + social metadata)

4. **Canonical URL:** https://www.aguy.co.il/
5. **OG Image:** https://www.aguy.co.il/api/media/file/telescope.4ee60378.svg
6. **og:type:** website
7. **Twitter card:**
   - twitter:card = summary_large_image
   - twitter:site = @aguy

### LOCATION

8. **Layout file:** src/app/(frontend)/layout.tsx

### ASSETS

9. **Favicon:** Use SVG version of logo or favicon.ico derived from it
   - Apple touch icon: PNG 180x180 derived from icon
   - Theme color: #0f172a

### BRAND

- **Brand short:** מערכת אינטרקטיבית לתרגול מתמטיקה עם משוב מיידי והכוונה ברורה
- **Brand long:** A-Guy היא פלטפורמה ללמידת מתמטיקה מבוססת תרגול. המערכת בנויה משיעורים מסודרים, תרגילים ממוקדים, משוב מיידי והסברים מדויקים שמקדמים הבנה אמיתית.
- **Logo URL:** https://www.aguy.co.il/api/media/file/telescope.4ee60378.svg

### i18n

10. **Locale-aware:** Single global default (primary language: he-IL)

---

## Updated Requirements

- Global metadata in layout.tsx with title template "A-Guy | תרגול מתמטיקה אינטראקטיבי"
- Open Graph: title, description, image, url, type=website
- Twitter Cards: summary_large_image, @aguy
- Favicon: SVG from logo, apple-touch-icon 180x180
- Theme color: #0f172a
- Config as source of truth + CMS override for specific pages
