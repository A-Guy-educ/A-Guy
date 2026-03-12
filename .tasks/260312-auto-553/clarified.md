# Clarified

1. Yes. The geometry editor is built on top of JSXGraph via a custom React wrapper (GeometryCanvas.tsx and JSXGraphBoard.tsx).
2. The geometry structure relies on a declarative Zod schema (GeometrySpecV1) defined in src/infra/contracts/graphics/geometry.v1.ts.
The point data is currently defined by GeometryPointSchema as follows:
const GeometryPointSchema = z.object({
  name: z.string(),
  x: z.number(),
  y: z.number(),
  position: PositionEnumSchema.optional(),
  fontSize: z.number().positive().optional(),
  visible: z.boolean().optional(),
})
What needs to be done: Although the schema supports it, the PointsPanel.tsx UI does not expose a dropdown for users to select this position, and GeometryCanvas.tsx does not currently map the point.position value to the JSXGraph label configuration. You will need to implement the UI dropdown and the canvas binding.
3. Currently, when a user clicks "Add Point" in the editor (src/ui/admin/ExerciseContentEditor/components/geometry/PointsPanel.tsx), the default object created is:
const newPoint: GeoPoint = {
  name: nextPointName(points),
  x: 0,
  y: 0,
  visible: true,
}
Current Behavior: The new point lacks an explicit position attribute. In GeometryCanvas.tsx, when the point is drawn onto the JSXGraph board, it is created with { withLabel: true, label: { fontSize: point.fontSize || 14 } }. Because no explicit position is mapped, it falls back to JSXGraph's default label position (which typically displays to the top-right or right of the point).
Task Alignment: To satisfy the requirement of defaulting to the right, you will want to update the PointsPanel.tsx handleAdd function to include position: 'r' explicitly, and ensure GeometryCanvas.tsx translates 'r' into the corresponding JSXGraph label offset/anchor configuration.
