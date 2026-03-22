/**
 * Minimal type declarations for JSXGraph
 * @see https://jsxgraph.org/docs/
 */

declare module 'jsxgraph' {
  export interface JXGBoardOptions {
    boundingbox?: [number, number, number, number]
    axis?: boolean
    grid?: boolean
    showNavigation?: boolean
    showCopyright?: boolean
    keepAspectRatio?: boolean
    pan?: { enabled?: boolean }
    zoom?: { enabled?: boolean }
    renderer?: string
    defaultAxes?: {
      x?: {
        ticks?: {
          visible?: boolean
          ticksDistance?: number
          label?: { offset?: [number, number] }
        }
        name?: string
        withLabel?: boolean
        label?: { position?: string; offset?: [number, number]; fontSize?: number }
      }
      y?: {
        ticks?: {
          visible?: boolean
          ticksDistance?: number
          label?: { offset?: [number, number] }
        }
        name?: string
        withLabel?: boolean
        label?: { position?: string; offset?: [number, number]; fontSize?: number }
      }
    }
  }

  export interface JXGElementAttributes {
    name?: string
    size?: number
    color?: string
    strokeColor?: string
    strokeWidth?: number
    fillColor?: string
    fillOpacity?: number
    fixed?: boolean
    visible?: boolean
    withLabel?: boolean
    label?: {
      position?: string
      offset?: [number, number]
      fontSize?: number
      cssStyle?: string
    }
    dash?: number
    opacity?: number
    radius?: number
    type?: string
    straightFirst?: boolean
    straightLast?: boolean
    snapToGrid?: boolean
    face?: string
    [key: string]: unknown
  }

  export interface JXGPoint {
    name: string
    id: string
    X(): number
    Y(): number
    moveTo(coords: [number, number], time?: number): void
    on(event: string, handler: () => void): void
    setAttribute(attrs: Partial<JXGElementAttributes>): void
    elType: string
  }

  export interface JXGElement {
    id: string
    name: string
    elType: string
    on(event: string, handler: () => void): void
    setAttribute(attrs: Partial<JXGElementAttributes>): void
    remove(): void
    X?: () => number
    Y?: () => number
    moveTo?: (coords: [number, number], time?: number) => void
  }

  export interface JXGBoard {
    create(
      elementType: string,
      parents: unknown[],
      attributes?: Partial<JXGElementAttributes>,
    ): JXGElement
    removeObject(element: JXGElement | string): void
    objects: Record<string, JXGElement>
    objectsList: JXGElement[]
    setBoundingBox(bbox: [number, number, number, number], keepAspectRatio?: boolean): void
    update(): void
    fullUpdate(): void
    suspendUpdate(): void
    unsuspendUpdate(): void
    containerObj: HTMLElement
    select(id: string): JXGElement | null
  }

  export interface JXG {
    JSXGraph: {
      initBoard(container: string | HTMLElement, options?: JXGBoardOptions): JXGBoard
      freeBoard(board: JXGBoard): void
    }
  }

  const JXG: JXG
  export default JXG
}
