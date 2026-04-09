import type { GuidedExplanationV1 } from '@/infra/contracts/guided-explanation/v1'

/**
 * Hand-converted triangle-congruence proof, derived directly from the
 * manager's reference HTML (`פתרון לתרגיל - מודרך - דוגמה.html`).
 *
 * This fixture serves three purposes:
 *   1. Drives the dev-only demo page that proves the engine can reproduce
 *      the reference animation without author-supplied JavaScript.
 *   2. Acts as the canonical few-shot example for the future Gemini prompt.
 *   3. Provides fixture data for unit tests of the runner.
 *
 * NOTE: class names in the SVG use the engine's `ge-` prefix so they hook
 * into the scoped CSS in `guided-explanation.css`. The original file used
 * unprefixed names (`draw-path`, `fade-element`) which would have collided
 * with other page content.
 */
const TRIANGLE_SVG = `
<svg viewBox="0 0 450 300" xmlns="http://www.w3.org/2000/svg">
  <g font-family="sans-serif" font-size="16" font-weight="500" fill="currentColor">
    <path id="poly-ABC" class="ge-highlight-poly" d="M 350 50 L 325 230 L 225 150 Z" stroke="none" />
    <path id="poly-EDC" class="ge-highlight-poly" d="M 100 50 L 125 230 L 225 150 Z" stroke="none" />

    <path id="line-AC" class="ge-draw-path" d="M 350 50 L 225 150" fill="none" stroke="#2563eb" stroke-width="3" stroke-linecap="round"/>
    <path id="line-CD" class="ge-draw-path" d="M 225 150 L 125 230" fill="none" stroke="#2563eb" stroke-width="3" stroke-linecap="round"/>
    <path id="line-EC" class="ge-draw-path" d="M 100 50 L 225 150" fill="none" stroke="#2563eb" stroke-width="3" stroke-linecap="round"/>
    <path id="line-CB" class="ge-draw-path" d="M 225 150 L 325 230" fill="none" stroke="#2563eb" stroke-width="3" stroke-linecap="round"/>

    <path id="line-AB" class="ge-draw-path" d="M 350 50 L 325 230" fill="none" stroke="#ef4444" stroke-width="3" stroke-linecap="round"/>
    <path id="line-ED" class="ge-draw-path" d="M 100 50 L 125 230" fill="none" stroke="#ef4444" stroke-width="3" stroke-linecap="round"/>

    <text id="label-A" x="365" y="45" text-anchor="middle" class="ge-fade-element">A</text>
    <text id="label-E" x="85" y="45" text-anchor="middle" class="ge-fade-element">E</text>
    <text id="label-B" x="340" y="250" text-anchor="middle" class="ge-fade-element">B</text>
    <text id="label-D" x="110" y="250" text-anchor="middle" class="ge-fade-element">D</text>
    <text id="label-C" x="225" y="175" text-anchor="middle" class="ge-fade-element">C</text>

    <g id="ticks-AC-EC" class="ge-fade-element" stroke="#10b981" stroke-width="3" stroke-linecap="round">
      <g transform="translate(287.5, 100) rotate(-38.6)">
        <line x1="0" y1="-8" x2="0" y2="8" />
      </g>
      <g transform="translate(162.5, 100) rotate(-141.3)">
        <line x1="0" y1="-8" x2="0" y2="8" />
      </g>
    </g>

    <g id="ticks-BC-CD" class="ge-fade-element" stroke="#f59e0b" stroke-width="3" stroke-linecap="round">
      <g transform="translate(275, 190) rotate(38.6)">
        <line x1="-4" y1="-8" x2="-4" y2="8" />
        <line x1="4" y1="-8" x2="4" y2="8" />
      </g>
      <g transform="translate(175, 190) rotate(141.3)">
        <line x1="-4" y1="-8" x2="-4" y2="8" />
        <line x1="4" y1="-8" x2="4" y2="8" />
      </g>
    </g>

    <g id="angles-C" class="ge-draw-path-fast" fill="none" stroke="#8b5cf6" stroke-width="3">
      <path d="M 248.4 131.3 A 30 30 0 0 1 248.4 168.7" stroke-linecap="round"/>
      <path d="M 201.6 131.3 A 30 30 0 0 0 201.6 168.7" stroke-linecap="round"/>
    </g>

    <g id="ticks-AB-ED" class="ge-fade-element" stroke="#6366f1" stroke-width="3" stroke-linecap="round">
      <g transform="translate(337.5, 140) rotate(97.9)">
        <line x1="-6" y1="-8" x2="-6" y2="8" />
        <line x1="0" y1="-8" x2="0" y2="8" />
        <line x1="6" y1="-8" x2="6" y2="8" />
      </g>
      <g transform="translate(112.5, 140) rotate(82.1)">
        <line x1="-6" y1="-8" x2="-6" y2="8" />
        <line x1="0" y1="-8" x2="0" y2="8" />
        <line x1="6" y1="-8" x2="6" y2="8" />
      </g>
    </g>
  </g>
</svg>
`.trim()

export const triangleProofFixture: GuidedExplanationV1 = {
  version: 'guided-explanation/v1',
  title: 'תרגיל 16: הוכחת חפיפת משולשים',
  subtitle: 'לחצו על לחצן ההפעלה כדי לבנות את ההוכחה שלב אחר שלב',
  direction: 'rtl',
  locale: 'he',
  scene: {
    svg: TRIANGLE_SVG,
    viewBox: '0 0 450 300',
    aspectRatio: '16/9',
  },
  proofTable: {
    columns: ['#', 'טענה', 'נימוק'],
    rows: [
      { id: 'row-1', claim: 'BC = CD', reason: 'נתון' },
      { id: 'row-2', claim: 'AC = EC', reason: 'נתון' },
      {
        id: 'row-3',
        claim: '∠ACB = ∠ECD',
        reason: 'זוויות קודקודיות בין ישרים שוות',
      },
      {
        id: 'row-4',
        claim: '△ABC ≅ △EDC',
        reason: 'משפט חפיפה ראשון - צ.ז.צ (לפי 1, 2 ו-3)',
        emphasis: 'primary',
      },
      {
        id: 'row-5',
        claim: 'ED = AB',
        reason: 'צלעות מתאימות שוות במשולשים חופפים',
        emphasis: 'danger',
      },
    ],
  },
  narrationBox: {
    placeholder: 'הקריינות תופיע כאן... לחצו על הפעלה כדי להתחיל.',
  },
  controls: {
    playLabel: 'הסבר ובניית ההוכחה',
    resetLabel: 'איפוס',
  },
  steps: [
    {
      id: 'intro',
      narrate: {
        display: 'בואו נוכיח את התרגיל שורה אחר שורה. נתונים הקטעים AD ו-BE הנחתכים בנקודה C.',
        speech:
          'בּוֹאוּ נוֹכִיחַ אֶת הַתַּרְגִּיל, שׁוּרָה אַחַר שׁוּרָה. נְתוּנִים הַקְּטָעִים, אֵיי דִי וּ-בִּי אִי, הַנֶּחְתָּכִים בִּנְקוּדָּה סִי.',
      },
      actions: [
        { op: 'show', id: 'label-A' },
        { op: 'show', id: 'label-C' },
        { op: 'show', id: 'label-D' },
        { op: 'draw', id: 'line-AC' },
        { op: 'draw', id: 'line-CD' },
        { op: 'wait', ms: 500 },
        { op: 'show', id: 'label-B' },
        { op: 'show', id: 'label-E' },
        { op: 'draw', id: 'line-EC' },
        { op: 'draw', id: 'line-CB' },
        { op: 'wait', ms: 800 },
      ],
    },
    {
      id: 'connect-vertices',
      narrate: {
        display: 'נחבר את הקודקודים ליצירת המשולשים, כפי שמופיע בשרטוט.',
        speech:
          'נְחַבֵּר אֶת הַקּוּדְקוּדִים לִיצִירַת הַמְּשׁוּלָּשִׁים, כְּפִי שֶׁמּוֹפִיעַ בַּשִּׂרְטוּט.',
      },
      actions: [
        { op: 'draw', id: 'line-AB' },
        { op: 'draw', id: 'line-ED' },
        { op: 'wait', ms: 800 },
      ],
    },
    {
      id: 'row-1-given-bc-cd',
      narrate: {
        display: 'נתון לנו ש-BC שווה ל-CD. נרשום זאת בטבלה כטענה הראשונה, והנימוק הוא נתון.',
        speech:
          'נָתוּן לָנוּ שֶׁ-בִּי סִי שָׁוֶה לְ-סִי דִי. נִרְשׁוֹם זֹאת בַּטַּבְלָה כַּטַּעֲנָה הָרִאשׁוֹנָה, וְהַנִּימּוּק הוּא: נָתוּן.',
      },
      actions: [
        { op: 'show', id: 'ticks-BC-CD' },
        { op: 'highlightRow', rowId: 'row-1' },
      ],
    },
    {
      id: 'row-2-given-ac-ec',
      narrate: {
        display: 'בנוסף נתון ש-AC שווה ל-EC. נמלא זאת בשורה השנייה, וגם כאן הנימוק הוא נתון.',
        speech:
          'בְּנוֹסָף נָתוּן, שֶׁ-אֵיי סִי שָׁוֶה לְ-אִי סִי. נְמַלֵּא זֹאת בַּשּׁוּרָה הַשְּׁנִיָּה, וְגַם כָּאן הַנִּימּוּק הוּא: נָתוּן.',
      },
      actions: [
        { op: 'show', id: 'ticks-AC-EC' },
        { op: 'highlightRow', rowId: 'row-2' },
      ],
    },
    {
      id: 'row-3-vertical-angles',
      narrate: {
        display:
          'הזוויות שנוצרות בנקודת החיתוך C הן זוויות קודקודיות, ולכן הן שוות. נרשום זאת בשורה מספר שלוש.',
        speech:
          'הַזָּוִיּוֹת שֶׁנּוֹצָרוֹת בִּנְקוּדַּת הַחִיתּוּךְ סִי, הֵן זָוִיּוֹת קוֹדְקוֹדִיּוֹת, וְלָכֵן הֵן שָׁווֹת. נִרְשׁוֹם זֹאת בְּשׁוּרָה מִסְפָּר שָׁלוֹשׁ.',
      },
      actions: [
        { op: 'draw', id: 'angles-C' },
        { op: 'highlightRow', rowId: 'row-3' },
      ],
    },
    {
      id: 'row-4-congruence',
      narrate: {
        display:
          'כעת מצאנו שתי צלעות וזווית הכלואה ביניהן שוות. לכן, המשולשים חופפים לפי משפט צלע-זווית-צלע.',
        speech:
          'כָּעֵת מָצָאנוּ, שְׁתֵּי צְלָעוֹת וְזָוִוית הַכְּלוּאָה בֵּינֵיהֶן שָׁווֹת. לָכֵן הַמְּשׁוּלָּשִׁים חוֹפְפִים. לְפִי מִשְׁפַּט צֵלָע-זָוִוית-צֵלָע.',
      },
      actions: [
        { op: 'show', id: 'poly-ABC' },
        { op: 'show', id: 'poly-EDC' },
        { op: 'highlightRow', rowId: 'row-4' },
      ],
    },
    {
      id: 'row-5-conclusion',
      narrate: {
        display:
          "בסעיף ב' התבקשנו להוכיח ש-ED שווה ל-AB. מכיוון שהמשולשים חופפים, הצלעות המתאימות שוות, וסיימנו.",
        speech:
          'בְּסָעִיף בֵּית הִתְבַּקַּשְׁנוּ לְהוֹכִיחַ שֶׁ-אִי דִי שָׁוֶה לְ-אֵיי בִּי. מִכֵּיוָן שֶׁהַמְּשׁוּלָּשִׁים חוֹפְפִים, הַצְּלָעוֹת הַמַּתְאִימוֹת שָׁווֹת, וְסִיַּימְנוּ.',
      },
      actions: [
        { op: 'show', id: 'ticks-AB-ED' },
        { op: 'highlightRow', rowId: 'row-5' },
      ],
    },
  ],
}
