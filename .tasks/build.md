# Build Agent Report: Add Comment Feature to Preview Comments Page

## Changes

- **Created** `src/ui/cody/components/AddCommentDialog.tsx` - New dialog component for adding simple comments (without @cody action) with markdown preview support
- **Modified** `src/ui/cody/components/PreviewActions.tsx` - Added "Comment" button next to "Fix" button in the action bar, integrated AddCommentDialog
- **Modified** `src/ui/cody/components/PreviewModal.tsx` - Added comments refresh mechanism (commentsKey state) to reload comment list after adding a comment

## Implementation Details

1. **AddCommentDialog**: Similar to FixRequestDialog but:
   - Uses blue color scheme instead of orange
   - Posts plain comment via `prsApi.postComment()` instead of requesting a fix
   - Shows "Add Comment" instead of "Request Fix"
   - UI text explains it's posted directly without triggering Cody

2. **PreviewActions**: Added:
   - Import for `AddCommentDialog` and `prsApi`
   - New `showCommentDialog` state
   - New `handleCommentSubmit` function that posts comment and triggers refresh
   - "Comment" button in the action bar (blue colored)
   - `AddCommentDialog` component in the JSX

3. **PreviewModal**: Added:
   - `commentsKey` state to force refresh PRCommentList
   - `handleCommentAdded` callback passed to PreviewActions
   - `key={commentsKey}` prop on PRCommentList to force re-render

## Tests Written

- No new tests required (existing tests pass)

## Quality

- TypeScript: PASS
- Lint: PASS
- Format: PASS
- Unit Tests: PASS (3577 passed)
