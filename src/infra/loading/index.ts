// Core store (singleton + factory for testing)
export {
  loadingManager,
  createLoadingManager,
  type LoadingType,
  type LoadingOperation,
  type LoadingSnapshot,
  type LoadingManagerInstance,
} from './LoadingManager'

// Hooks (direct store access, no context needed)
export { useLoadingState } from './hooks/useLoadingState'
export { useAsyncAction } from './hooks/useAsyncAction'
export { useRouterWithLoading } from './hooks/useRouterWithLoading'

// Utilities
export {
  asyncAction,
  createAsyncAction,
  type ActionResult,
  type AsyncActionOptions,
} from './AsyncAction'
export { resolveHrefToString, buildCurrentPath } from './utils/resolveHref'

// Components
export { RouteLoadingIndicator } from './components/RouteLoadingIndicator'
export { SystemLink } from './components/SystemLink'
export { Spinner } from './components/Spinner'
// NOTE: LoadingBoundary and skeletons deferred to future task (not in this PR)

// Keys
export { LOADING_KEYS, type LoadingKey } from './keys'
