/**
 * GradientEdge — a ReactFlow custom edge that paints a linear gradient
 * from srcColor (source port type) to tgtColor (target port type).
 *
 * Used automatically by Canvas.jsx when the two port-type colors differ.
 * When they are the same, the standard edge with a solid stroke is used.
 */
import { getBezierPath } from 'reactflow'

export default function GradientEdge({
  id,
  sourceX, sourceY,
  targetX, targetY,
  sourcePosition,
  targetPosition,
  data = {},
  style = {},
  markerEnd,
}) {
  const [edgePath] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })

  const srcColor = data.srcColor || '#94a3b8'
  const tgtColor = data.tgtColor || '#94a3b8'
  // Reference the stable global gradient defined in Canvas.jsx's EdgeGradientDefs.
  // Keyed by color pair so the same gradient is reused across all edges of the same type pairing.
  const gradId = `ck8t-grad-${srcColor.replace('#', '')}-${tgtColor.replace('#', '')}`

  return (
    <path
      id={id}
      className="react-flow__edge-path"
      d={edgePath}
      markerEnd={markerEnd}
      style={{
        ...style,
        stroke: `url(#${gradId}) ${srcColor}`,
      }}
    />
  )
}
