/**
 * MasterSlaveGroupOverlay — visual compound node group box.
 *
 * Renders a dashed-border group box around each master_agent + its registered
 * slave_agent blocks on the canvas.  The overlay sits inside the ReactFlow
 * pane so it moves and zooms with the canvas.
 *
 * Usage:
 *   <MasterSlaveGroupOverlay nodes={rfNodes} viewport={viewport} />
 *
 * Props:
 *   nodes    — WorkflowNode[]  — current ReactFlow node list
 *   viewport — { x, y, zoom } — current ReactFlow viewport
 *
 * Wires:
 *   - reads masterSlaveRegistry from workspace-store
 *   - calls unregisterSlave on right-click "Remove from group"
 */
import { useCallback } from 'react'
import { useWorkspaceStore } from '../stores/workspace-store'

const GROUP_PADDING = 28           // px — spacing around bounding box
const GROUP_BORDER_RADIUS = 14     // px
const MASTER_BLOCK_W = 240         // px — default node width used for bbox calculation
const MASTER_BLOCK_H = 200         // px
const GROUP_FILL = 'rgba(217, 119, 6, 0.04)'
const GROUP_STROKE = '#D97706'
const GROUP_LABEL_BG = '#D97706'

/**
 * Compute the bounding box that contains all provided nodes.
 * ReactFlow nodes have { position: {x,y}, width?, height? }.
 */
function computeBBox(nodes, padding) {
  if (!nodes.length) return null
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const n of nodes) {
    const x = n.position?.x ?? 0
    const y = n.position?.y ?? 0
    const w = n.width  ?? n.data?.width  ?? MASTER_BLOCK_W
    const h = n.height ?? n.data?.height ?? MASTER_BLOCK_H
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + w)
    maxY = Math.max(maxY, y + h)
  }
  return {
    x:      minX - padding,
    y:      minY - padding,
    width:  (maxX - minX) + padding * 2,
    height: (maxY - minY) + padding * 2,
  }
}

export function MasterSlaveGroupOverlay({ nodes, viewport }) {
  const registry        = useWorkspaceStore((s) => s.masterSlaveRegistry)
  const unregisterSlave = useWorkspaceStore((s) => s.unregisterSlave)
  const nodesById       = Object.fromEntries((nodes || []).map((n) => [n.id, n]))

  const handleSlaveRightClick = useCallback((e, masterId, slaveId) => {
    e.preventDefault()
    e.stopPropagation()
    const menu = document.createElement('div')
    menu.className = 'bs-group-ctx-menu'
    menu.style.cssText = `
      position: fixed; left: ${e.clientX}px; top: ${e.clientY}px;
      background: #1e1e2e; border: 1px solid #374151; border-radius: 8px;
      padding: 4px 0; z-index: 9999; min-width: 180px; box-shadow: 0 8px 24px rgba(0,0,0,.5);
      font-size: 12px; color: #e5e7eb;
    `
    const item = document.createElement('div')
    item.textContent = '✕  Remove from master group'
    item.style.cssText = `padding: 8px 14px; cursor: pointer; color: #f87171;`
    item.onmouseenter = () => { item.style.background = '#27273f' }
    item.onmouseleave = () => { item.style.background = 'transparent' }
    item.onclick = () => {
      unregisterSlave(masterId, slaveId)
      document.body.removeChild(menu)
    }
    menu.appendChild(item)
    document.body.appendChild(menu)
    const dismiss = () => { if (document.body.contains(menu)) document.body.removeChild(menu) }
    setTimeout(() => document.addEventListener('click', dismiss, { once: true }), 10)
  }, [unregisterSlave])

  if (!registry || Object.keys(registry).length === 0) return null

  const groups = []
  for (const [masterId, slaves] of Object.entries(registry)) {
    if (!slaves.length) continue
    const masterNode = nodesById[masterId]
    if (!masterNode) continue
    const slaveNodes = slaves.map((r) => nodesById[r.slaveId]).filter(Boolean)
    if (!slaveNodes.length) continue

    const allGroupNodes = [masterNode, ...slaveNodes]
    const bbox = computeBBox(allGroupNodes, GROUP_PADDING)
    if (!bbox) continue

    const masterLabel = masterNode.data?.title || 'Master'
    groups.push({ masterId, masterLabel, bbox, slaves, slaveNodes })
  }

  if (!groups.length) return null

  const { x: vpX = 0, y: vpY = 0, zoom = 1 } = viewport || {}

  return (
    <div
      className="bs-master-slave-overlay"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,           // behind nodes (ReactFlow nodes sit at zIndex 1+)
        overflow: 'visible',
      }}
    >
      <svg
        style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible', width: '100%', height: '100%' }}
      >
        <defs>
          <marker id="ms-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L9,3 z" fill={GROUP_STROKE} opacity="0.7" />
          </marker>
        </defs>
        {groups.map(({ masterId, masterLabel, bbox }) => {
          // Transform bbox from flow-space to screen-space
          const sx = bbox.x * zoom + vpX
          const sy = bbox.y * zoom + vpY
          const sw = bbox.width  * zoom
          const sh = bbox.height * zoom
          const labelX = sx + 10
          const labelY = sy + 4
          const labelFontSize = Math.max(9, Math.min(12, 12 * zoom))

          return (
            <g key={masterId}>
              {/* Dashed group border */}
              <rect
                x={sx} y={sy} width={sw} height={sh}
                rx={GROUP_BORDER_RADIUS * zoom} ry={GROUP_BORDER_RADIUS * zoom}
                fill={GROUP_FILL}
                stroke={GROUP_STROKE}
                strokeWidth={1.5}
                strokeDasharray={`${6 * zoom} ${4 * zoom}`}
                opacity={0.85}
              />
              {/* Label badge */}
              <rect
                x={labelX} y={labelY}
                width={Math.min(sw - 20, (masterLabel.length * 7 + 22) * zoom)}
                height={18 * zoom}
                rx={4 * zoom}
                fill={GROUP_LABEL_BG}
                opacity={0.9}
              />
              <text
                x={labelX + 8 * zoom}
                y={labelY + 12 * zoom}
                fontSize={labelFontSize}
                fill="#fff"
                fontFamily="system-ui, sans-serif"
                fontWeight="600"
                pointerEvents="none"
              >
                ♛ {masterLabel}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Pointer-events-enabled slave badge layer */}
      {groups.map(({ masterId, slaves, slaveNodes }) =>
        slaveNodes.map((slaveNode, i) => {
          const reg = slaves[i]
          if (!reg) return null
          const nx = slaveNode.position?.x * zoom + vpX
          const ny = slaveNode.position?.y * zoom + vpY
          const badgeSize = Math.max(14, 18 * zoom)
          return (
            <div
              key={`${masterId}-${reg.slaveId}`}
              title={`Registered to master. Right-click to remove.`}
              onContextMenu={(e) => handleSlaveRightClick(e, masterId, reg.slaveId)}
              style={{
                position: 'absolute',
                left: nx - badgeSize / 2,
                top: ny - badgeSize / 2,
                width: badgeSize,
                height: badgeSize,
                borderRadius: '50%',
                background: '#0284C7',
                border: `${Math.max(1, 2 * zoom)}px solid #fff`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: Math.max(8, 10 * zoom),
                color: '#fff',
                fontWeight: 700,
                cursor: 'context-menu',
                pointerEvents: 'auto',
                zIndex: 2,
                userSelect: 'none',
                boxShadow: '0 1px 4px rgba(0,0,0,.4)',
              }}
            >
              S
            </div>
          )
        })
      )}
    </div>
  )
}

/**
 * useMasterSlaveDropTarget
 *
 * Hook that extends a Canvas drop handler to auto-register a slave_agent block
 * when it is dropped onto a master_agent node.
 *
 * Call this inside CanvasInner and merge the returned `onDrop` with the
 * existing canvas onDrop (call this handler FIRST; it returns true if the
 * event was consumed, so the caller can short-circuit).
 *
 * @param {{ nodes: object[], getBlock: (t:string)=>object|null }} opts
 * @returns {{ tryMasterSlaveRegister: (e, blockType, position) => boolean }}
 */
export function useMasterSlaveDropTarget({ nodes, getBlock: _getBlock }) {
  const registerSlaveToMaster = useWorkspaceStore((s) => s.registerSlaveToMaster)

  /**
   * If `blockType` is 'slave_agent' and the drop landed on a master_agent node,
   * register the slave and return true.  Otherwise return false.
   *
   * @param {DragEvent}  e         — the drop event
   * @param {string}     blockType — the dragged block type
   * @param {{x,y}}      position  — flow-space drop position
   * @param {string}     newNodeId — the ID of the freshly-added slave node
   */
  const tryMasterSlaveRegister = useCallback((e, blockType, position, newNodeId) => {
    if (blockType !== 'slave_agent') return false
    // Find a master_agent node whose bounding box contains the drop position
    const masterNode = (nodes || []).find((n) => {
      if (n.data?.blockType !== 'master_agent') return false
      const nx = n.position?.x ?? 0
      const ny = n.position?.y ?? 0
      const nw = n.width ?? MASTER_BLOCK_W
      const nh = n.height ?? MASTER_BLOCK_H
      return (
        position.x >= nx - GROUP_PADDING &&
        position.x <= nx + nw + GROUP_PADDING &&
        position.y >= ny - GROUP_PADDING &&
        position.y <= ny + nh + GROUP_PADDING
      )
    })
    if (!masterNode || !newNodeId) return false

    // Read capabilityLabel from the drag dataTransfer (set by BlockPalette) or fallback
    const capability = e.dataTransfer?.getData('application/ck8t-slave-capability') || 'specialist'
    registerSlaveToMaster(masterNode.id, newNodeId, capability, newNodeId)
    return true
  }, [nodes, registerSlaveToMaster])

  return { tryMasterSlaveRegister }
}
