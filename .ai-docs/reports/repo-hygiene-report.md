# Repo Hygiene Report

- Generated: **2026-06-02T11:02:46.258Z**
- Tool: **knip** (report-only)
- Exit status: **NON-ZERO (findings or warnings)**

## Notes

This job is informational and does not open a PR.
Use it to schedule cleanup tasks (dead files/exports/deps).

## knip output

```
[dotenv@17.2.3] injecting env (0) from .env -- tip: 🔄 add secrets lifecycle management: https://dotenvx.com/ops
[dotenv@17.2.3] injecting env (4) from .env.test -- tip: 🔐 encrypt with Dotenvx: https://dotenvx.com
[dotenv@17.2.3] injecting env (0) from .env -- tip: 🔄 add secrets lifecycle management: https://dotenvx.com/ops
[dotenv@17.2.3] injecting env (4) from .env.test -- tip: ⚙️  specify custom .env file path with { path: '/custom/path/.env' }
[dotenv@17.2.3] injecting env (0) from .env -- tip: 🗂️ backup and recover secrets: https://dotenvx.com/ops
[dotenv@17.2.3] injecting env (4) from .env.test -- tip: 🛠️  run anywhere with `dotenvx run -- yourcommand`
[dotenv@17.2.3] injecting env (0) from .env -- tip: 🔄 add secrets lifecycle management: https://dotenvx.com/ops
[dotenv@17.2.3] injecting env (4) from .env.test -- tip: 🔑 add access controls to secrets: https://dotenvx.com/ops
Unused dependencies (5)
@anthropic-ai/sdk          package.json:111:6
@modelcontextprotocol/sdk  package.json:115:6
@rollup/rollup-darwin-x64  package.json:139:6
katex                      package.json:157:6
react-quill-new            package.json:175:6
Unused devDependencies (2)
@eslint/eslintrc    package.json:191:6
eslint-config-next  package.json:208:6
Unlisted dependencies (10)
@storybook/react  src/ui/web/components/accent-picker.stories.tsx:1:37
@storybook/react  src/ui/web/components/animated-counter.stories.tsx:1:37
@storybook/react  src/ui/web/components/badge.stories.tsx:1:37
@storybook/react  src/ui/web/components/button.stories.tsx:1:37
@storybook/react  src/ui/web/components/card.stories.tsx:1:37
@storybook/react  src/ui/web/components/confetti.stories.tsx:3:37
@storybook/react  src/ui/web/components/input.stories.tsx:1:37
@storybook/react  src/ui/web/components/motion.stories.tsx:1:37
@storybook/react  src/ui/web/components/onboarding-tip.stories.tsx:1:37
@storybook/react  src/ui/web/components/skeleton.stories.tsx:1:37
Unlisted binaries (1)
docker-compose  package.json
Duplicate exports (37)
scenario00|default                              scripts/system-test/scenarios/00-minimal-test.ts
scenario02|default                              scripts/system-test/scenarios/02-full-high-complexity.ts
AccountRole|Role                                src/infra/auth/roles.ts
isAccountRole|isRole                            src/infra/auth/roles.ts
parseAccountRole|parseRole                      src/infra/auth/roles.ts
ACCOUNT_ROLE_LABEL|ROLE_LABEL                   src/infra/auth/roles.ts
ALL_ACCOUNT_ROLES|ALL_ROLES                     src/infra/auth/roles.ts
ChatRole|ChatMessageRole                        src/infra/llm/chat-message-role.ts
isChatRole|isChatMessageRole                    src/infra/llm/chat-message-role.ts
AdminChatLauncher|default                       src/ui/admin/AdminChatLauncher/index.tsx
ContextExerciseViewer|default                   src/ui/admin/context-exercise-viewer/index.tsx
CouponUsageModal|default                        src/ui/admin/Coupons/CouponUsageModal/index.tsx
CreateCouponModal|default                       src/ui/admin/Coupons/CreateCouponModal/index.tsx
CouponEditView|default                          src/ui/admin/Coupons/EditView/index.tsx
CouponsListView|default                         src/ui/admin/Coupons/ListView/index.tsx
ConvertContextButton|default                    src/ui/admin/exercise-conversion/ConvertContextButton/index.tsx
ConvertContextModal|default                     src/ui/admin/exercise-conversion/ConvertContextModal/index.tsx
ConvertLatexBlockButton|default                 src/ui/admin/exercise-conversion/ConvertLatexBlockButton/index.tsx
ConvertV2Button|default                         src/ui/admin/exercise-conversion/ConvertV2Button/index.tsx
ConvertV3Button|default                         src/ui/admin/exercise-conversion/ConvertV3Button/index.tsx
FullConvertLatexButton|default                  src/ui/admin/exercise-conversion/FullConvertLatexButton/index.tsx
FullConvertMediaButton|default                  src/ui/admin/exercise-conversion/FullConvertMediaButton/index.tsx
LatexImportSection|default                      src/ui/admin/exercise-conversion/LatexImportSection/index.tsx
LessonConversionPanel|default                   src/ui/admin/exercise-conversion/LessonConversionPanel/index.tsx
TexFileUpload|default                           src/ui/admin/exercise-conversion/TexFileUpload/index.tsx
TexImportButton|default                         src/ui/admin/exercise-conversion/TexImportButton/index.tsx
V2StatusPanel|default                           src/ui/admin/exercise-conversion/V2StatusPanel/index.tsx
V3PreviewPanel|default                          src/ui/admin/exercise-conversion/V3PreviewPanel/index.tsx
ExercisePreview|default                         src/ui/admin/ExercisePreview/index.tsx
LessonDuplicationReviewSidebarLink|default      src/ui/admin/LessonDuplicationReview/SidebarLink/index.tsx
PdfConversionSidebarLink|default                src/ui/admin/PdfConversion/SidebarLink/index.tsx
TypeBadgeCell|default                           src/ui/admin/ProductItems/TypeBadgeCell/index.tsx
ProductsEditView|default                        src/ui/admin/Products/EditView/index.tsx
ProductsSaveButton|default                      src/ui/admin/Products/SaveButton/index.tsx
TransactionPaymentDetail|TransactionDetailView  src/ui/admin/TransactionEditView/index.tsx
UserEmail|default                               src/ui/admin/UserEmail/index.tsx
VersionInfo|default                             src/ui/admin/VersionInfo/index.tsx

ERROR: Error loading src/payload.config.ts (ParseError: Unexpected token, expected ","  )
ERROR: Please fix or visit https://knip.dev/reference/known-issues
Configuration hints (10)
**/*.test.*                knip.json  Remove from ignore
**/*.spec.*                knip.json  Remove from ignore
**/*.d.ts                  knip.json  Remove from ignore
node_modules/**            knip.json  Remove from ignore
.next/**                   knip.json  Remove from ignore
dist/**                    knip.json  Remove from ignore
build/**                   knip.json  Remove from ignore
coverage/**                knip.json  Remove from ignore
src/pages/**/*.{ts,tsx}    knip.json  Refine entry pattern (no matches)
.json                      knip.json  Extension in project not registered as a compiler
```
