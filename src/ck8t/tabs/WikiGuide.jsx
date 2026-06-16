/**
 * Wiki Guide — Rich React-based documentation viewer.
 * Replaces the old iframe-based approach for full theme integration.
 */
import { useState, useMemo, useRef } from 'react'
import { getAllBlocks, CATEGORY_LABELS, CATEGORY_ORDER, groupBlocksByCategory } from '../blocks/registry'
import JsonView from '../run/JsonView'
import { Highlight, themes } from 'prism-react-renderer'
import './wiki-guide.css'

/* ── Helpers ── */
const hl = (json) => {
  const s = typeof json === 'string' ? json : JSON.stringify(json, null, 2)
  return s
    .replace(/("(?:\\.|[^"\\])*")\s*:/g, '<span class="hl-key">$1</span>:')
    .replace(/:\s*("(?:\\.|[^"\\])*")/g, ': <span class="hl-str">$1</span>')
    .replace(/:\s*(\d+(?:\.\d+)?)/g, ': <span class="hl-num">$1</span>')
    .replace(/:\s*(true|false|null)/g, ': <span class="hl-bool">$1</span>')
    .replace(/(\/\/.*)/g, '<span class="hl-cmt">$1</span>')
}

function Code({ children }) {
  return <pre><code dangerouslySetInnerHTML={{ __html: hl(children) }} /></pre>
}

/** Prism-highlighted code block — use for extension authoring snippets. */
function CodeBlock({ children, language = 'javascript', filename }) {
  const code = typeof children === 'string' ? children.trimStart() : ''
  return (
    <div className="wiki-codeblock">
      {filename && <div className="wiki-codeblock-filename">{filename}</div>}
      <Highlight code={code} language={language} theme={themes.vsDark}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre className={`wiki-codeblock-pre ${className}`} style={{ ...style, margin: 0, borderRadius: filename ? '0 0 8px 8px' : 8, padding: '16px 20px', fontSize: '0.8rem', lineHeight: 1.65, overflowX: 'auto' }}>
            {tokens.map((line, i) => {
              // eslint-disable-next-line no-unused-vars
              const { key: _k, ...lp } = getLineProps({ line })
              return (
                <div key={i} {...lp}>
                  {line.map((token, j) => {
                    // eslint-disable-next-line no-unused-vars
                    const { key: _tk, ...tp } = getTokenProps({ token })
                    return <span key={j} {...tp} />
                  })}
                </div>
              )
            })}
          </pre>
        )}
      </Highlight>
    </div>
  )
}

function Tip({ type = 'info', icon, children }) {
  const icons = { info: 'ℹ️', warn: '⚠️', success: '✅', danger: '🚫' }
  return (
    <div className={`wiki-tip ${type}`}>
      <span className="wiki-tip-icon">{icon || icons[type]}</span>
      <div>{children}</div>
    </div>
  )
}

function Badge({ type, children }) {
  return <span className={`wiki-badge ${type}`}>{children}</span>
}

function Step({ num, title, children }) {
  return (
    <div className="wiki-step">
      <div className="wiki-step-num">{num}</div>
      <div className="wiki-step-body">
        {title && <h5>{title}</h5>}
        <p>{children}</p>
      </div>
    </div>
  )
}

/* ── Collapsible section ── */
function Collapsible({ title, icon, defaultOpen = false, children, className = '' }) {
  const [open, setOpen] = useState(defaultOpen)
  const toggleRef = useRef(null)
  return (
    <div className={`wiki-collapsible ${open ? 'wiki-collapsible--open' : ''} ${className}`}>
      <button ref={toggleRef} className="wiki-collapsible-toggle" data-wiki-toggle onClick={() => setOpen(!open)}>
        <svg className={`wiki-collapsible-chevron ${open ? 'open' : ''}`} viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        {icon && <span className="wiki-collapsible-icon">{icon}</span>}
        <span className="wiki-collapsible-title">{title}</span>
      </button>
      {open && <div className="wiki-collapsible-body">{children}</div>}
    </div>
  )
}

/* ── Port/pin color helpers ─────────────────────────────────────────── */
function getPinColor(sbType) {
  if (['switch','checkbox'].includes(sbType)) return '#22c55e'
  if (['slider','number-input'].includes(sbType)) return '#06b6d4'
  if (['short-input','long-input','text','eval-input','code'].includes(sbType)) return '#3b82f6'
  if (['dropdown','combobox'].includes(sbType)) return '#a855f7'
  if (['table','checkbox-list','tool-input','skill-input','skill-picker'].includes(sbType)) return '#f59e0b'
  return '#64748b'
}

function getPortColor(pType) {
  const m = { string:'#22c55e', number:'#fbbf24', boolean:'#f472b6',
               json:'#6366f1', array:'#0ea5e9', blob:'#f59e0b', any:'#94a3b8' }
  return m[pType] || '#94a3b8'
}

/** Canvas-accurate block card — uses the same bs-node-* CSS classes as the live app. */
function BlockCard({ block }) {
  const fields        = (block.subBlocks || []).slice(0, 5)
  const inputEntries  = block.inputs  ? Object.entries(block.inputs)  : []
  const outputEntries = block.outputs ? Object.entries(block.outputs) : []

  return (
    <div className="bs-node" style={{ width: 264, margin: '12px auto', pointerEvents: 'none', cursor: 'default' }}>
      {/* ── Header ── */}
      <div className="bs-node-header">
        <div className="bs-node-icon-well" style={{ background: block.bgColor || '#6366f1' }}>
          {block.icon && <block.icon />}
        </div>
        <div className="bs-node-title">{block.name}</div>
        <div className="bs-node-badge">{block.type}</div>
      </div>

      {/* ── Input port strip ── */}
      {inputEntries.length > 0 && (
        <div className="bs-port-strip bs-port-strip-in">
          {inputEntries.map(([k, v]) => {
            const c = getPortColor(v.type)
            return (
              <div key={k} className="bs-port-row bs-port-row-in">
                <div className="bs-port-dot" style={{ background: c, flexShrink: 0 }} />
                <span className="bs-port-name">{k}</span>
                <span style={{ marginLeft: 4, fontSize: 9, padding: '1px 5px', borderRadius: 3,
                               background: `${c}1a`, color: c, border: `1px solid ${c}44` }}>
                  {v.type}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Body rows ── */}
      {fields.length > 0 && (
        <div className="bs-node-body">
          {fields.map((f) => (
            <div key={f.id} className="bs-node-row">
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: getPinColor(f.type), flexShrink: 0 }} />
              <span style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap' }}>
                {f.title}
              </span>
              <span style={{ color: 'var(--text-primary, #e5e7eb)', fontSize: 11, textAlign: 'right',
                             overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {f.placeholder || f.type}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Output port strip ── */}
      {outputEntries.length > 0 && (
        <div className="bs-port-strip bs-port-strip-out">
          {outputEntries.map(([k, v]) => {
            const c = getPortColor(v.type)
            return (
              <div key={k} className="bs-port-row bs-port-row-out">
                <span style={{ marginRight: 4, fontSize: 9, padding: '1px 5px', borderRadius: 3,
                               background: `${c}1a`, color: c, border: `1px solid ${c}44` }}>
                  {v.type}
                </span>
                <span className="bs-port-name">{k}</span>
                <div className="bs-port-dot" style={{ background: c, flexShrink: 0 }} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Mini entity pill used in flow diagrams */
function EntityPill({ color, icon, label, sublabel }) {
  return (
    <div style={{ display:'inline-flex', flexDirection:'column', alignItems:'center', gap:4, minWidth:90 }}>
      <div style={{ background: color, borderRadius:10, padding:'10px 16px', color:'#fff', fontSize:13, fontWeight:700,
                    display:'flex', alignItems:'center', gap:6, boxShadow:`0 4px 14px ${color}55` }}>
        {icon && <span style={{fontSize:16}}>{icon}</span>}
        {label}
      </div>
      {sublabel && <span style={{fontSize:10,color:'var(--text-secondary,#64748b)'}}>{sublabel}</span>}
    </div>
  )
}

/** Arrow connector for flow diagrams */
function Arrow({ label }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, color:'var(--text-secondary,#64748b)' }}>
      <div style={{ fontSize:18 }}>→</div>
      {label && <span style={{ fontSize:9, whiteSpace:'nowrap' }}>{label}</span>}
    </div>
  )
}

/** Skill Debugger visual mockup */
function DebuggerMockup({ currentLine = 4, variables = { url: '"https://example.com"', result: '{ title, text }', params: '{ input: "…" }' } }) {
  const lines = [
    `async function run(params) {`,
    `  const url = params.input`,
    `  `,
    `  const res = await fetch(url)`,
    `  const html = await res.text()`,
    `  `,
    `  const title = html.match(/<title>(.*?)<\\/title>/i)?.[1]`,
    `  return { title, text: html.slice(0, 500) }`,
    `}`,
  ]
  return (
    <div style={{ display:'flex', gap:0, borderRadius:10, overflow:'hidden', border:'1px solid rgba(255,255,255,0.08)', fontFamily:'monospace', fontSize:12 }}>
      {/* Code view */}
      <div style={{ flex:1, background:'#0d1117', padding:'12px 0' }}>
        <div style={{ padding:'4px 12px 8px', fontSize:10, color:'#64748b', borderBottom:'1px solid rgba(255,255,255,0.06)', marginBottom:4 }}>
          skill.js &nbsp;·&nbsp; <span style={{color:'#f59e0b'}}>⏸ Paused at line {currentLine}</span>
        </div>
        {lines.map((line, i) => {
          const ln = i + 1
          const isCur = ln === currentLine
          return (
            <div key={ln} style={{ display:'flex', alignItems:'center', background: isCur ? 'rgba(251,191,36,0.08)' : 'transparent',
                                   borderLeft: isCur ? '2px solid #fbbf24' : '2px solid transparent', padding:'2px 0' }}>
              <span style={{ width:36, textAlign:'right', paddingRight:12, color: isCur ? '#fbbf24' : '#334155', fontSize:10, flexShrink:0 }}>
                {isCur ? '▶' : ln}
              </span>
              <span style={{ color: isCur ? '#fde68a' : '#94a3b8' }}>{line}</span>
            </div>
          )
        })}
      </div>
      {/* Variables panel */}
      <div style={{ width:200, background:'#0b1120', borderLeft:'1px solid rgba(255,255,255,0.06)', padding:'12px 0' }}>
        <div style={{ padding:'4px 12px 8px', fontSize:10, color:'#64748b', borderBottom:'1px solid rgba(255,255,255,0.06)', marginBottom:4 }}>
          Variables
        </div>
        {Object.entries(variables).map(([k, v]) => (
          <div key={k} style={{ padding:'4px 12px', display:'flex', flexDirection:'column', gap:1 }}>
            <span style={{ color:'#7dd3fc', fontSize:10 }}>{k}</span>
            <span style={{ color:'#86efac', fontSize:10, fontFamily:'monospace' }}>{v}</span>
          </div>
        ))}
        <div style={{ margin:'8px 12px 0', display:'flex', gap:6 }}>
          <button style={{ flex:1, padding:'3px 0', fontSize:10, background:'rgba(16,185,129,0.15)', color:'#10b981', border:'1px solid rgba(16,185,129,0.3)', borderRadius:4, cursor:'default' }}>▶ Resume</button>
          <button style={{ flex:1, padding:'3px 0', fontSize:10, background:'rgba(99,102,241,0.15)', color:'#818cf8', border:'1px solid rgba(99,102,241,0.3)', borderRadius:4, cursor:'default' }}>⤵ Step</button>
        </div>
      </div>
    </div>
  )
}

/* ── JSON tag explanation card ── */
function JsonTagCard({ icon, title, code, variant, id, children }) {
  return (
    <div className={`wiki-json-card ${variant || ''}`} id={id}>
      <div className="wiki-json-card-icon">{icon}</div>
      <div className="wiki-json-card-body">
        <h4 className="wiki-json-card-title">
          {code && <code>{code}</code>}
          <span>{title}</span>
        </h4>
        <p className="wiki-json-card-desc">{children}</p>
      </div>
    </div>
  )
}

/* ── Main component ── */
export default function WikiGuide() {
  const blocks = useMemo(() => getAllBlocks(), [])

  const groupedBlocks = useMemo(() => {
    const groups = {}
    for (const b of blocks) {
      const cat = b.category || 'custom'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(b)
    }
    return groups
  }, [blocks])

  const categorySubGroups = useMemo(() => {
    const result = {}
    for (const cat of CATEGORY_ORDER) {
      result[cat] = groupBlocksByCategory(groupedBlocks[cat] || [], cat)
    }
    return result
  }, [groupedBlocks])

  const scrollTo = (id) => {
    let el = document.getElementById(id)
    if (!el) {
      // Target may be inside a closed Collapsible — open all ancestors
      // We do a two-pass: first open every collapsed section so the DOM renders,
      // then find the element.
      const closedToggles = document.querySelectorAll('.wiki-collapsible:not(.wiki-collapsible--open) > [data-wiki-toggle]')
      closedToggles.forEach((btn) => btn.click())
      // Allow React to flush
      requestAnimationFrame(() => {
        const target = document.getElementById(id)
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
      return
    }
    // If the element exists but is inside a hidden collapsible, open ancestors
    let node = el.parentElement
    while (node) {
      if (node.classList?.contains('wiki-collapsible') && !node.classList.contains('wiki-collapsible--open')) {
        const toggle = node.querySelector(':scope > [data-wiki-toggle]')
        if (toggle) toggle.click()
      }
      node = node.parentElement
    }
    requestAnimationFrame(() => {
      const target = document.getElementById(id)
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const WORKFLOW_JSON_EXAMPLE = JSON.stringify({
    "_comment": "Exported from CK8T — Agent Builder Studio — 2026-04-21T00:47:53.210Z",
    "workflow": {
      "id": "wf_demo_url_summary",
      "name": "Demo · URL → Summary",
      "teamId": "t_fullstack",
      "createdAt": "2026-04-20T03:12:25.643017Z",
      "nodes": [
        {
          "id": "n_starter",
          "type": "builderBlock",
          "data": { "title": "Start", "bgColor": "#2FB67C", "blockType": "starter" },
          "position": { "x": -609.26, "y": 195.63 }
        },
        {
          "id": "n_input",
          "type": "builderBlock",
          "data": { "title": "URL", "bgColor": "#FBBF24", "blockType": "user_input" },
          "position": { "x": -285.60, "y": 200.27 }
        },
        {
          "id": "n_skill",
          "type": "builderBlock",
          "data": { "title": "Skill", "bgColor": "#7c3aed", "blockType": "skill", "category": "tools", "disabled": false },
          "position": { "x": 33.67, "y": 201.19 }
        },
        {
          "id": "n_agent",
          "type": "builderBlock",
          "data": { "title": "Summarizer", "bgColor": "#6F3DFA", "blockType": "agent", "disabled": false, "width": 272, "height": 354 },
          "position": { "x": 359.99, "y": 202.68 }
        },
        {
          "id": "n_mapper",
          "type": "builderBlock",
          "data": { "title": "Mapper", "bgColor": "#14b8a6", "blockType": "mapper", "category": "blocks", "disabled": false },
          "position": { "x": 684.10, "y": 202.50 }
        },
        {
          "id": "n_preview",
          "type": "builderBlock",
          "data": { "title": "Final Preview", "bgColor": "#14B8A6", "blockType": "show_preview", "disabled": false },
          "position": { "x": 1011.42, "y": 202.78 }
        }
      ],
      "edges": [
        {
          "id": "reactflow__edge-n_starterout-n_inputin",
          "source": "n_starter",
          "target": "n_input",
          "animated": true,
          "sourceHandle": "out",
          "targetHandle": "in"
        },
        {
          "id": "reactflow__edge-n_inputvalue-n_skillin_input",
          "source": "n_input",
          "target": "n_skill",
          "animated": true,
          "sourceHandle": "value",
          "targetHandle": "in_input"
        },
        {
          "id": "reactflow__edge-n_skillresult-n_agentin_input",
          "source": "n_skill",
          "target": "n_agent",
          "animated": true,
          "sourceHandle": "result",
          "targetHandle": "in_input"
        },
        {
          "id": "reactflow__edge-n_agentdata-n_mapperin_input",
          "source": "n_agent",
          "target": "n_mapper",
          "animated": true,
          "sourceHandle": "data",
          "targetHandle": "in_input"
        },
        {
          "id": "reactflow__edge-n_mapperresult-n_previewin_input",
          "source": "n_mapper",
          "target": "n_preview",
          "animated": true,
          "sourceHandle": "result",
          "targetHandle": "in_input"
        }
      ],
      "subBlockValues": {
        "n_starter": {
          "startWorkflow": "manual"
        },
        "n_input": {
          "kind": "url",
          "label": "URL",
          "required": true,
          "placeholder": "https://example.com",
          "defaultValue": "https://www.salilvnair.com/docs/v2/architecture",
          "_portTypes": { "out_value": "string" }
        },
        "n_skill": {
          "skillId": "sk_url_extract",
          "_portTypes": { "in_input": "string", "out_result": "json" }
        },
        "n_agent": {
          "model": "gpt-4.1",
          "temperature": 0.3,
          "systemPrompt": "You are a concise summarization agent. Produce a crisp summary in 3-5 bullet points, each under 140 characters.",
          "userPrompt": "Title: {{title}}\n\nContent:\n{{text}}",
          "responseFormat": "{\n  \"type\": \"object\",\n  \"properties\": {\n    \"summary\": { \"type\": \"string\" },\n    \"bullets\": { \"type\": \"array\", \"items\": { \"type\": \"string\" } }\n  },\n  \"required\": [\"summary\"]\n}"
        },
        "n_mapper": {
          "mode": "json_parse",
          "_portTypes": { "in_input": "string", "out_result": "json" }
        },
        "n_preview": {
          "label": "Final output"
        }
      }
    }
  }, null, 2)

  return (
    <div className="wiki">
      {/* Hero */}
      <section className="wiki-hero">
        <h1>CK8T — Agent Builder Studio</h1>
        <div className="wiki-subtitle">Complete Guide · 2026</div>
        <p className="wiki-desc">
          A field guide to CK8T's visual agent builder. Covers the full workspace
          hierarchy (teams → agent pools → agents → skills → workflows), client-side
          graph execution, every built-in block, four end-to-end workflow recipes, and
          an appendix with shortcuts, file layout, extension authoring, and debugging.
        </p>
      </section>

      <div className="wiki-content">
        {/* Table of Contents */}
        <div className="wiki-toc">
          <h2>Table of Contents</h2>

          <Collapsible title="Concepts" icon="💡">
            <div className="wiki-toc-items">
              <a href="#c-hier" onClick={(e) => { e.preventDefault(); scrollTo('c-hier') }}>Workspace hierarchy</a>
              <a href="#c-exec" onClick={(e) => { e.preventDefault(); scrollTo('c-exec') }}>Workflow execution model</a>
              <a href="#c-dock" onClick={(e) => { e.preventDefault(); scrollTo('c-dock') }}>Run dock panels</a>
              <a href="#c-insp" onClick={(e) => { e.preventDefault(); scrollTo('c-insp') }}>Inspector</a>
              <a href="#c-ext" onClick={(e) => { e.preventDefault(); scrollTo('c-ext') }}>Extensions pattern</a>
              <a href="#c-ext" onClick={(e) => { e.preventDefault(); scrollTo('c-ext') }} style={{ paddingLeft: 16, fontSize: '0.8rem', opacity: 0.7 }}>↳ BlockConfig template</a>
              <a href="#c-ext" onClick={(e) => { e.preventDefault(); scrollTo('c-ext') }} style={{ paddingLeft: 16, fontSize: '0.8rem', opacity: 0.7 }}>↳ Graph-runner case</a>
              <a href="#c-ext" onClick={(e) => { e.preventDefault(); scrollTo('c-ext') }} style={{ paddingLeft: 16, fontSize: '0.8rem', opacity: 0.7 }}>↳ All 3 build targets</a>
              <a href="#c-ck8tblock" onClick={(e) => { e.preventDefault(); scrollTo('c-ck8tblock') }}>CK8tBlock base + progress</a>
              <a href="#c-ck8tblock" onClick={(e) => { e.preventDefault(); scrollTo('c-ck8tblock') }} style={{ paddingLeft: 16, fontSize: '0.8rem', opacity: 0.7 }}>↳ hasProgress flag</a>
              <a href="#c-ck8tblock" onClick={(e) => { e.preventDefault(); scrollTo('c-ck8tblock') }} style={{ paddingLeft: 16, fontSize: '0.8rem', opacity: 0.7 }}>↳ progress() callback</a>
              <a href="#c-ck8tblock" onClick={(e) => { e.preventDefault(); scrollTo('c-ck8tblock') }} style={{ paddingLeft: 16, fontSize: '0.8rem', opacity: 0.7 }}>↳ Community blocks</a>
              <a href="#prov-why" onClick={(e)=>{e.preventDefault();scrollTo('prov-why')}}>Custom Providers & Browser mode</a>
              <a href="#mcp-what" onClick={(e)=>{e.preventDefault();scrollTo('mcp-what')}}>MCP — Tool integration</a>
            </div>
          </Collapsible>

          <Collapsible title="Framework Overview" icon="🗺️">
            <div className="wiki-toc-items">
              <a href="#fw-what" onClick={(e)=>{e.preventDefault();scrollTo('fw-what')}}>What is CK8T?</a>
              <a href="#fw-runtimes" onClick={(e)=>{e.preventDefault();scrollTo('fw-runtimes')}}>Three runtime targets</a>
              <a href="#fw-entities" onClick={(e)=>{e.preventDefault();scrollTo('fw-entities')}}>Entity hierarchy</a>
              <a href="#fw-exec" onClick={(e)=>{e.preventDefault();scrollTo('fw-exec')}}>End-to-end execution</a>
              <a href="#fw-example" onClick={(e)=>{e.preventDefault();scrollTo('fw-example')}}>Full worked example</a>
            </div>
          </Collapsible>

          <Collapsible title="Workflow JSON Schema" icon="📋">
            <div className="wiki-toc-items">
              <a href="#json-schema" onClick={(e) => { e.preventDefault(); scrollTo('json-schema') }}>Full JSON structure</a>
              <a href="#json-wrapper" onClick={(e) => { e.preventDefault(); scrollTo('json-wrapper') }}>_comment &amp; workflow — Export wrapper</a>
              <a href="#json-nodes" onClick={(e) => { e.preventDefault(); scrollTo('json-nodes') }}>nodes — Block instances</a>
              <a href="#json-node-data" onClick={(e) => { e.preventDefault(); scrollTo('json-node-data') }}>data.* — Node metadata fields</a>
              <a href="#json-edges" onClick={(e) => { e.preventDefault(); scrollTo('json-edges') }}>edges — Connections</a>
              <a href="#json-sbv" onClick={(e) => { e.preventDefault(); scrollTo('json-sbv') }}>subBlockValues — Config data</a>
              <a href="#json-porttypes" onClick={(e) => { e.preventDefault(); scrollTo('json-porttypes') }}>_portTypes — Type overrides</a>
              <a href="#json-blocktype" onClick={(e) => { e.preventDefault(); scrollTo('json-blocktype') }}>data.blockType — Identity</a>
              <a href="#json-position" onClick={(e) => { e.preventDefault(); scrollTo('json-position') }}>position — Layout</a>
              <a href="#json-templates" onClick={(e) => { e.preventDefault(); scrollTo('json-templates') }}>Template expressions</a>
            </div>
          </Collapsible>

          <Collapsible title="Block Reference" icon="🧱">
            <div className="wiki-toc-items">
              {CATEGORY_ORDER.map((cat) => {
                const catBlocks = groupedBlocks[cat]
                if (!catBlocks || catBlocks.length === 0) return null
                const { topItems, groups } = categorySubGroups[cat]

                return (
                  <Collapsible key={cat} title={`${CATEGORY_LABELS[cat]} (${catBlocks.length})`} className="wiki-toc-nested">
                    <div className="wiki-toc-items">
                      {topItems.map((b) => (
                        <a key={b.type} href={`#b-${b.type}`} onClick={(e) => { e.preventDefault(); scrollTo(`b-${b.type}`) }}>
                          <span className="wiki-toc-block-name">{b.name}</span>
                          <code>{b.type}</code>
                        </a>
                      ))}
                      {groups.map((sg) => (
                        <Collapsible key={sg.id} title={`${sg.label} (${sg.items.length})`} className="wiki-toc-nested">
                          <div className="wiki-toc-items">
                            {sg.items.map((b) => (
                              <a key={b.type} href={`#b-${b.type}`} onClick={(e) => { e.preventDefault(); scrollTo(`b-${b.type}`) }}>
                                <span className="wiki-toc-block-name">{b.name}</span>
                                <code>{b.type}</code>
                              </a>
                            ))}
                          </div>
                        </Collapsible>
                      ))}
                    </div>
                  </Collapsible>
                )
              })}
            </div>
          </Collapsible>

          <Collapsible title="Teams, Agents & Skills" icon="🤖">
            <div className="wiki-toc-items">
              <a href="#ent-teams" onClick={(e)=>{e.preventDefault();scrollTo('ent-teams')}}>Teams & Agent Pools</a>
              <a href="#ent-agents" onClick={(e)=>{e.preventDefault();scrollTo('ent-agents')}}>Agents</a>
              <a href="#ent-skills" onClick={(e)=>{e.preventDefault();scrollTo('ent-skills')}}>Skills</a>
              <a href="#ent-workflows" onClick={(e)=>{e.preventDefault();scrollTo('ent-workflows')}}>Workflows</a>
            </div>
          </Collapsible>

          <Collapsible title="MCP & Tool Integration" icon="🔌">
            <div className="wiki-toc-items">
              <a href="#mcp-what" onClick={(e)=>{e.preventDefault();scrollTo('mcp-what')}}>What is MCP?</a>
              <a href="#mcp-config" onClick={(e)=>{e.preventDefault();scrollTo('mcp-config')}}>Configuring a server</a>
              <a href="#mcp-block" onClick={(e)=>{e.preventDefault();scrollTo('mcp-block')}}>MCP block on the canvas</a>
            </div>
          </Collapsible>

          <Collapsible title="Custom Providers & Browser Mode" icon="🔐">
            <div className="wiki-toc-items">
              <a href="#prov-why" onClick={(e)=>{e.preventDefault();scrollTo('prov-why')}}>Why custom providers?</a>
              <a href="#prov-add" onClick={(e)=>{e.preventDefault();scrollTo('prov-add')}}>Adding a provider</a>
              <a href="#prov-security" onClick={(e)=>{e.preventDefault();scrollTo('prov-security')}}>AES-GCM key encryption</a>
            </div>
          </Collapsible>

          <Collapsible title="Skill Debugger" icon="🐛">
            <div className="wiki-toc-items">
              <a href="#dbg-open" onClick={(e)=>{e.preventDefault();scrollTo('dbg-open')}}>Opening the debugger</a>
              <a href="#dbg-bp" onClick={(e)=>{e.preventDefault();scrollTo('dbg-bp')}}>Breakpoints</a>
              <a href="#dbg-vars" onClick={(e)=>{e.preventDefault();scrollTo('dbg-vars')}}>Variable inspection</a>
              <a href="#dbg-step" onClick={(e)=>{e.preventDefault();scrollTo('dbg-step')}}>Step-over execution</a>
            </div>
          </Collapsible>

          <Collapsible title="VS Code Extension" icon="🧩">
            <div className="wiki-toc-items">
              <a href="#ext-overview" onClick={(e)=>{e.preventDefault();scrollTo('ext-overview')}}>Extension overview</a>
              <a href="#ext-copilot" onClick={(e)=>{e.preventDefault();scrollTo('ext-copilot')}}>GitHub Copilot integration</a>
              <a href="#ext-providers" onClick={(e)=>{e.preventDefault();scrollTo('ext-providers')}}>Custom providers in extension</a>
            </div>
          </Collapsible>

          <Collapsible title="Demo Workflows" icon="🚀">
            <div className="wiki-toc-items">
              <a href="#w-seed" onClick={(e) => { e.preventDefault(); scrollTo('w-seed') }}>Seeded · URL → Summary</a>
              <a href="#w-url" onClick={(e) => { e.preventDefault(); scrollTo('w-url') }}>URL summariser</a>
              <a href="#w-csv" onClick={(e) => { e.preventDefault(); scrollTo('w-csv') }}>CSV extract-and-mail</a>
              <a href="#w-triage" onClick={(e) => { e.preventDefault(); scrollTo('w-triage') }}>Branching triage</a>
            </div>
          </Collapsible>

          <Collapsible title="Appendix" icon="📎">
            <div className="wiki-toc-items">
              <a href="#a-keys" onClick={(e) => { e.preventDefault(); scrollTo('a-keys') }}>Keyboard shortcuts</a>
              <a href="#a-layout" onClick={(e) => { e.preventDefault(); scrollTo('a-layout') }}>File layout</a>
              <a href="#a-custom" onClick={(e) => { e.preventDefault(); scrollTo('a-custom') }}>Writing a custom block</a>
              <a href="#a-trouble" onClick={(e) => { e.preventDefault(); scrollTo('a-trouble') }}>Troubleshooting</a>
            </div>
          </Collapsible>
        </div>

        {/* ═══ Concepts ═══ */}
        <div className="wiki-section" id="part1">
          <h2>Concepts</h2>

          <h3 id="c-hier">1.1 Workspace hierarchy</h3>
          <p>
            Builder Studio organises everything inside a single <strong>Workspace</strong>.
            The persistent model forms a four-level tree:
          </p>
          <table>
            <thead><tr><th>Level</th><th>What it is</th><th>SideNav location</th></tr></thead>
            <tbody>
              <tr><td><strong>Workspace</strong></td><td>Top-level container. One per app install; seeded as <code>Default</code> with id <code>ws_default</code>.</td><td>Workspace switcher (top-left).</td></tr>
              <tr><td><strong>Team</strong></td><td>Logical grouping of agent pools owned by a squad.</td><td>SideNav → <strong>Teams</strong>.</td></tr>
              <tr><td><strong>Agent Pool</strong></td><td>A roster of related agents that collaborate.</td><td>Nested inside each team card.</td></tr>
              <tr><td><strong>Agent</strong></td><td>LLM wrapper with prompts, schemas, model choice, and attached skills.</td><td>Under a pool; click to open editor.</td></tr>
              <tr><td><strong>Skill</strong></td><td>Reusable JS/Python function with input/output schemas.</td><td>SideNav → <strong>Skills</strong>.</td></tr>
              <tr><td><strong>Workflow</strong></td><td>Canvas of nodes + edges + subBlockValues. Has metadata (timeout, retries, etc).</td><td>SideNav → <strong>Workflows</strong>.</td></tr>
            </tbody>
          </table>
          <Tip type="info">Agents and skills are referenced by id — editing one propagates to every workflow that uses it.</Tip>

          <h3 id="c-exec">1.2 Workflow execution model</h3>
          <p>The graph runner uses <strong>topological BFS with readiness gating</strong>:</p>
          <div className="wiki-steps">
            <Step num={1} title="Seed phase">Starter nodes → <code>null</code>, user_input nodes → dialog value.</Step>
            <Step num={2} title="Ready set">A node is ready when all incoming edges are "live" (source finished + edge handle matches).</Step>
            <Step num={3} title="Concurrent dispatch">All ready nodes run via <code>Promise.all</code>.</Step>
            <Step num={4} title="Per-node execution">Switch on <code>blockType</code> — each block type has its own runner logic.</Step>
            <Step num={5} title="Output shape">Most blocks return raw value. Agent/MCP return <code>{'{ __meta, value }'}</code>. Branching returns <code>{'{ branch, value }'}</code>.</Step>
          </div>
          <Tip type="warn">Agent nodes use <code>{'{{key}}'}</code> template interpolation. Unresolved vars appear as literal text in prompts.</Tip>

          <h3 id="c-dock">1.3 Run dock panels</h3>
          <table>
            <thead><tr><th>Panel</th><th>Shows</th></tr></thead>
            <tbody>
              <tr><td><strong>Output</strong></td><td>Final <code>result.output</code> formatted with JsonView.</td></tr>
              <tr><td><strong>Debug</strong></td><td>Chronological event log (start/done/error). Expandable cards show prompts, skill runs, provider response.</td></tr>
              <tr><td><strong>Trace</strong></td><td>Grid of nodes: title, blockType, input, values, meta, output, ms.</td></tr>
              <tr><td><strong>Console</strong></td><td>Captured <code>console.log</code> from function/skill executions.</td></tr>
            </tbody>
          </table>
          <p>
            Node card states: <strong>idle</strong> → <strong>active</strong> (dashed pulsing green) → <strong>completed</strong> (solid green + check) → <strong>error</strong> (red ring + tooltip).
          </p>

          <h3 id="c-insp">1.4 Inspector</h3>
          <p>
            Right rail rendered by <code>panel/Inspector.jsx</code>. Features:
          </p>
          <ul>
            <li><strong>Basic vs Advanced tabs</strong> — toggled when any sub-block has <code>mode: 'advanced'</code>.</li>
            <li><strong>Visibility</strong> — filtered by <code>matchesMode()</code> + field-level <code>condition</code> predicate.</li>
            <li><strong>Delete-with-confirm</strong> — trashcan opens ConfirmModal.</li>
            <li><strong>About icon</strong> — toggles <code>BlockDocViewer</code> reading from <code>docs/block-docs-entries.js</code>.</li>
            <li><strong>IOPanel</strong> — connections, template variables, typed inputs/outputs.</li>
          </ul>
          <h4>SubBlock type → control mapping</h4>
          <table>
            <thead><tr><th>Type</th><th>Control</th></tr></thead>
            <tbody>
              <tr><td><code>short-input</code></td><td>Single-line text input</td></tr>
              <tr><td><code>long-input</code>, <code>text</code></td><td>Textarea</td></tr>
              <tr><td><code>dropdown</code>, <code>combobox</code></td><td><code>{'<select>'}</code></td></tr>
              <tr><td><code>switch</code></td><td>iOS-style toggle</td></tr>
              <tr><td><code>slider</code></td><td>Range input</td></tr>
              <tr><td><code>table</code></td><td>Row-based key/value grid</td></tr>
              <tr><td><code>code</code></td><td>CodeMirror editor</td></tr>
              <tr><td><code>response-format</code></td><td>FullscreenWrapper + JSON tree</td></tr>
              <tr><td><code>mcp-*</code></td><td>MCP-specific selectors</td></tr>
              <tr><td><code>file-upload</code></td><td>File input</td></tr>
            </tbody>
          </table>

          <h3 id="c-ext">1.5 Extensions pattern</h3>
          <p>
            The extension system lets you ship a fully functional custom block by dropping a single <code>.js</code> file into{' '}
            <code>ck8t/extensions/</code>. No registry edits, no barrel imports — Vite's{' '}
            <code>import.meta.glob</code> discovers every file in that folder at build time and auto-registers each exported{' '}
            <code>BlockConfig</code>. The block immediately appears in the palette, Inspector, WikiGuide Block Reference, and
            graph-runner — across all three build targets.
          </p>

          <Tip type="info">
            <strong>Real examples already in the repo:</strong> <code>ext_json_validator</code> (JSON Validator, category: custom) and{' '}
            <code>ext_save_logger</code> (Save Logger, category: blocks → Output). Both were wired with zero changes outside their own file.
          </Tip>

          <h4 style={{ marginTop: 24 }}>How auto-discovery works</h4>
          <p>
            The registry runs this at module load time — before any component renders:
          </p>
          <CodeBlock language="javascript" filename="blocks/registry.js — extension loader">
{`const extensionModules = import.meta.glob('../extensions/*.js', { eager: true })

for (const [path, mod] of Object.entries(extensionModules)) {
  const block = resolveExtensionExport(mod)   // finds default / .block / <Name>Block export
  if (!block) continue
  if (registry[block.type]) {
    console.warn(\`Extension at \${path} tried to overwrite core block "\${block.type}"; skipped.\`)
    continue
  }
  registry[block.type] = block                // registered — palette + Inspector + WikiGuide
}`}
          </CodeBlock>

          <p>
            <code>resolveExtensionExport</code> accepts three export shapes — pick whichever you prefer:
          </p>
          <CodeBlock language="javascript" filename="extensions/my-block.js — all valid export shapes">
{`// Shape 1 — default export (recommended)
export default MyBlock

// Shape 2 — named 'block'
export const block = MyBlock

// Shape 3 — any named export with .type + .subBlocks
export const MyBlockExport = MyBlock`}
          </CodeBlock>

          <Tip type="success">Core blocks cannot be shadowed by extensions. If a collision is detected, the extension is skipped with a console warning.</Tip>

          <h4 style={{ marginTop: 24 }}>Full BlockConfig template</h4>
          <p>
            Copy this into <code>extensions/my-block.js</code> and fill in your fields.
            Only <code>type</code>, <code>name</code>, and <code>category</code> are strictly required.
          </p>
          <CodeBlock language="javascript" filename="extensions/my-block.js">
{`import { ExtensionIcon } from '../components/icons'  // or any icon you import

const MyBlock = {
  // ── Identity ──────────────────────────────────────────────
  type:     'ext_my_block',   // MUST be globally unique; prefix with 'ext_' by convention
  name:     'My Block',       // display name in palette + Inspector header
  description:     'One-line summary shown in palette tooltip',
  longDescription: 'Full paragraph shown in WikiGuide block reference.',

  // ── Palette placement ─────────────────────────────────────
  // 'blocks' → Core Blocks, 'tools' → Tools & Integrations,
  // 'triggers' → Triggers, 'custom' → Custom (default for extensions)
  category: 'custom',

  bgColor: '#6366f1',   // hex — node header colour
  icon:    ExtensionIcon,

  // ── Inspector fields (subBlocks) ──────────────────────────
  subBlocks: [
    { id: 'prompt',   title: 'Prompt',  type: 'long-input',  placeholder: 'Enter prompt…', required: true },
    { id: 'model',    title: 'Model',   type: 'dropdown',    options: [{ label: 'GPT-4o', id: 'gpt-4o' }] },
    { id: 'strict',   title: 'Strict',  type: 'switch',      defaultValue: false, mode: 'advanced' },
  ],

  // ── Port declarations ─────────────────────────────────────
  inputs: {
    input: { type: 'any',    description: 'Upstream data' },
  },
  outputs: {
    result: { type: 'json',  description: 'Block output' },
  },

  // ── Branching (optional) ─────────────────────────────────
  // Uncomment to add named output handles (like if_else / switch):
  // outputHandles: ['success', 'failure'],

  // ── Tool access (optional, for MCP/skill integration) ─────
  tools: { access: [] },
}

export default MyBlock`}
          </CodeBlock>

          <h4 style={{ marginTop: 28 }}>Palette sub-group placement</h4>
          <p>
            Setting <code>category</code> puts the block inside the right top-level tab.
            To also place it inside a specific <strong>sub-group</strong> (e.g. "Input", "Databases"), add its{' '}
            <code>type</code> to the relevant subgroup array in <code>CATEGORY_CONFIG</code> inside{' '}
            <code>blocks/registry.js</code>:
          </p>
          <CodeBlock language="javascript" filename="blocks/registry.js — CATEGORY_CONFIG">
{`// Example: place 'ext_my_block' inside Core Blocks → Input sub-group
blocks: {
  subgroups: [
    { id: 'input', label: 'Input', types: ['user_input', 'audio_input', 'ext_my_block'] },
    // ...
  ],
},

// Example: place inside Tools & Integrations → API sub-group
tools: {
  subgroups: [
    { id: 'api', label: 'API', types: ['api', 'ext_my_block'] },
    // ...
  ],
},`}
          </CodeBlock>

          <Tip type="info">
            If you don't add the type to any subgroup, it falls through to an auto-generated <strong>"Other"</strong> group
            at the bottom of its category — which is why <code>ext_json_validator</code> shows as <em>Custom → Other (1)</em>.
          </Tip>

          <h4 style={{ marginTop: 28 }}>Graph-runner — adding execution logic</h4>
          <p>
            The registry handles UI automatically. For the block to <strong>execute</strong> in the canvas run,
            you must add a <code>case</code> to the <code>runNode()</code> switch in <code>run/graph-runner.js</code>.
          </p>
          <CodeBlock language="javascript" filename="run/graph-runner.js — runNode() switch">
{`// Step 1 — add your case (keep alongside related blocks)
case 'ext_my_block':
  return runMyBlock({ values, input })

// Step 2 — implement the handler (anywhere in graph-runner.js)
function runMyBlock({ values, input }) {
  const prompt  = values?.prompt  || ''
  const strict  = Boolean(values?.strict)

  // 'input'  = the merged upstream output bag (already interpolated)
  // 'values' = the Inspector subBlock config for this node instance

  const result = doSomething(prompt, input, strict)
  return { result }   // shape must match your 'outputs' port declarations
}`}
          </CodeBlock>

          <Tip type="warn">
            If you skip the <code>graph-runner.js</code> case, the block falls through to the <code>default</code> branch which
            passes <code>input</code> through unchanged — the node appears to run but produces no real output.
            You'll see this in the Trace panel as an output identical to the upstream node.
          </Tip>

          <h4 style={{ marginTop: 28 }}>What changes across all 3 build targets</h4>
          <table>
            <thead>
              <tr><th>What you need</th><th>Browser app (<code>npm run build</code>)</th><th>VS Code extension (<code>build:extension</code>)</th><th>Portfolio website (<code>build:website</code>)</th></tr>
            </thead>
            <tbody>
              <tr><td>Block appears in palette + WikiGuide</td><td>✅ auto via glob</td><td>✅ same source, auto</td><td>✅ same source, auto</td></tr>
              <tr><td>Block executes on canvas run</td><td>add <code>case</code> in <code>graph-runner.js</code></td><td>same file, auto</td><td>same file, auto</td></tr>
              <tr><td>Sub-group placement</td><td>edit <code>CATEGORY_CONFIG</code> in <code>registry.js</code></td><td>same file, auto</td><td>same file, auto</td></tr>
              <tr><td>Block doc (About panel)</td><td>edit <code>docs/block-docs-entries.js</code></td><td>same file, auto</td><td>same file, auto</td></tr>
              <tr><td>Deploy</td><td><code>npm run build</code> → serve <code>dist/</code></td><td><code>npm run build:extension</code> → package <code>.vsix</code></td><td><code>npm run build:website</code> → copies to portfolio</td></tr>
            </tbody>
          </table>

          <Tip type="success">
            <strong>Summary:</strong> drop a <code>.js</code> in <code>extensions/</code> + add a <code>case</code> in{' '}
            <code>graph-runner.js</code>. That's the entire contract. Run <code>npm run build:all</code> to ship to all
            three targets in one command.
          </Tip>

          {/* ── CK8tBlock base + progress ── */}
          <h3 id="c-ck8tblock" style={{ marginTop: 40 }}>1.6 CK8tBlock base + progress</h3>
          <p>
            Every block in CK8T — built-in or community — follows the same base shape defined in{' '}
            <code>src/ck8t/blocks/ck8t-block-base.js</code>. Think of it like a Java base class: new common capabilities
            added to <code>CK8tBlockBase</code> are instantly available to every block that extends it.
          </p>
          <p>
            The first capability built on this pattern is <strong>inline progress</strong>: a live progress bar that
            expands at the bottom of the node card while the block runs — same indigo look as the floating overlay,
            but embedded inside the card itself.
          </p>

          <Step num={1} title="Opt in with hasProgress">
            Add <code>hasProgress: true</code> to your block definition. That's all the UI needs — the node card
            automatically shows the progress footer whenever real progress data is flowing.
            <CodeBlock language="javascript" filename="blocks/blocks/mcp.js (built-in example)">
{`export const McpBlock = {
  type: 'mcp',
  name: 'MCP Tool',
  // ...
  hasProgress: true,   // ← opts this block into the inline progress footer
  subBlocks: [ ... ],
}`}
            </CodeBlock>
            <CodeBlock language="javascript" filename="ui/story-splitter.js (community block example)">
{`export default {
  type: 'story_splitter',
  name: 'Story Splitter',
  // ...
  hasProgress: true,   // ← same flag, works identically in community blocks
  run({ values, input, progress }) { ... },
}`}
            </CodeBlock>
          </Step>

          <Step num={2} title="Call progress() in your run()">
            When <code>hasProgress: true</code>, the graph-runner injects a <code>progress</code> callback as the
            fourth argument to your <code>run()</code>. Call it at key stages — the node card updates in real time.
            <CodeBlock language="javascript" filename="ui/storybook-pdf.js — async block with stages">
{`async run({ values, input, inputsByHandle, progress }) {
  progress?.({ pct: 5,  step: 1, total: 3, label: 'Connecting to bridge…' })

  const res = await fetch(\`\${base}/ck8t/run-block\`, { ... })

  progress?.({ pct: 20, step: 2, total: 3, label: 'Generating PDF…' })

  if (!res.ok) throw new Error(\`bridge error \${res.status}\`)

  progress?.({ pct: 90, step: 3, total: 3, label: 'Reading result…' })

  const { output } = await res.json()
  return output
},`}
            </CodeBlock>
            <Tip type="info">
              <strong>Always use optional chaining</strong> (<code>progress?.()</code>). The callback is <code>undefined</code>{' '}
              when <code>hasProgress</code> is <code>false</code> — optional chaining makes your block safe in both states
              without any extra guard.
            </Tip>
            <table>
              <thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td><code>pct</code></td><td>number 0-100</td><td>Drives the progress bar fill width</td></tr>
                <tr><td><code>step</code></td><td>number</td><td>Current step shown as "step N / total"</td></tr>
                <tr><td><code>total</code></td><td>number</td><td>Total step count</td></tr>
                <tr><td><code>label</code></td><td>string</td><td>Short status string next to the spinner</td></tr>
              </tbody>
            </table>
          </Step>

          <Step num={3} title="How the graph-runner wires it">
            You never set up or tear down the progress store yourself. The graph-runner handles it automatically
            for any block with <code>hasProgress: true</code>:
            <CodeBlock language="javascript" filename="run/graph-runner.js — default community block dispatch">
{`default: {
  const communityRun = customBrowserBlockRunners.get(type)
  if (communityRun) {
    const blkCfg = getBlock(type)
    const progressFn = blkCfg?.hasProgress
      ? (data) => useMcpProgressStore.getState().setProgress({ nodeId: node.id, ...data })
      : undefined
    try {
      return await communityRun({ values, input, inputsByHandle, outputs,
                                  node, allNodes, subBlockValues, progress: progressFn })
    } finally {
      if (progressFn) useMcpProgressStore.getState().clearProgress()
    }
  }
  return input
}`}
            </CodeBlock>
            <Tip type="info">
              The <code>finally</code> block guarantees progress is always cleared — even when your block throws.
              You never need to call <code>clearProgress()</code> yourself.
            </Tip>
          </Step>

          <Step num={4} title="defineCk8tBlock() for source-tree blocks">
            Built-in blocks and extensions living inside the <code>src/</code> tree can import the helper to
            ensure they always inherit any new base fields without manual updates:
            <CodeBlock language="javascript" filename="src/ck8t/blocks/ck8t-block-base.js">
{`export const CK8tBlockBase = {
  type:            '',
  name:            '',
  description:     '',
  longDescription: '',
  category:        'custom',
  bgColor:         '#334155',
  icon:            null,
  iconSvg:         null,  // SVG path string — community blocks can't import React icons
  subBlocks:       [],
  inputs:          {},
  outputs:         {},
  hasProgress:     false, // ← inline progress opt-in
  singleton:       false,
  run:             null,
}

// Merge your definition over the base — your fields win on every key.
export function defineCk8tBlock(def) {
  return Object.assign({}, CK8tBlockBase, def)
}`}
            </CodeBlock>
            <CodeBlock language="javascript" filename="extensions/my-block.js — using defineCk8tBlock">
{`import { defineCk8tBlock } from '../blocks/ck8t-block-base.js'

export default defineCk8tBlock({
  type:        'ext_my_block',
  name:        'My Block',
  category:    'custom',
  hasProgress: true,
  async run({ values, input, progress }) {
    progress?.({ pct: 0, step: 1, total: 2, label: 'Starting…' })
    const result = await doWork(input)
    progress?.({ pct: 100, step: 2, total: 2, label: 'Done' })
    return result
  },
})`}
            </CodeBlock>
            <Tip type="warn">
              <strong>Community blocks distributed as separate packages</strong> (installed via the block manager,
              loaded at runtime) cannot use <code>import</code> statements — the VS Code extension evaluates them
              with <code>new Function()</code>. Use the plain-object pattern with <code>hasProgress: true</code>{' '}
              directly on the export, as shown in Step 1.
            </Tip>
          </Step>
        </div>

        <div className="wiki-divider" />

        {/* ═══ Framework Overview ═══ */}
        <div className="wiki-section" id="fw-what">
          <h2>Framework Overview</h2>
          <p>
            CK8T is a <strong>visual agentic workflow builder</strong>. Think of it like a smart flowchart builder where each box
            is a real operation — calling an AI model, fetching a URL, running your JavaScript function, querying a database.
            You connect boxes with arrows, press Run, and the engine executes everything in the right order automatically.
          </p>
          <p>
            The key insight: <strong>you never write orchestration code</strong>. The graph IS the program. The executor (graph-runner)
            reads the connections, figures out what can run in parallel, what must wait for upstream results, and drives the whole thing
            end-to-end — including retries, error handling, and streaming progress back to the UI in real time.
          </p>

          <h3 id="fw-runtimes">Three runtime targets</h3>
          <p>The same codebase builds three completely independent products:</p>
          <table>
            <thead><tr><th>Target</th><th>How to run</th><th>LLM calls go via</th><th>Data stored in</th></tr></thead>
            <tbody>
              <tr>
                <td><strong>Browser app</strong></td>
                <td><code>npm run dev</code> or <code>npm run build</code></td>
                <td>Direct browser fetch (apiKey in AES-GCM encrypted localStorage) OR ck8t-server proxy</td>
                <td>Zustand → localStorage (<code>ck8t/workspace</code>) + optional Postgres sync</td>
              </tr>
              <tr>
                <td><strong>VS Code extension</strong></td>
                <td><code>npm run build:extension</code> → install <code>.vsix</code></td>
                <td>GitHub Copilot (no API key needed) OR custom provider in Settings</td>
                <td>SQLite via VS Code extension bridge (<code>localStorage</code> in webview, SQLite on disk)</td>
              </tr>
              <tr>
                <td><strong>Portfolio website</strong></td>
                <td><code>npm run build:website</code></td>
                <td>Direct browser fetch using custom provider added in Settings</td>
                <td>localStorage only (browser mode, no server)</td>
              </tr>
            </tbody>
          </table>

          <h3 id="fw-entities">Entity hierarchy</h3>
          <p>
            Everything inside CK8T is organized into a five-level tree. From widest to narrowest:
          </p>
          <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', margin:'20px 0', padding:'20px', background:'rgba(99,102,241,0.05)', borderRadius:12, border:'1px solid rgba(99,102,241,0.12)' }}>
            <EntityPill color="#6366f1" icon="🏢" label="Workspace" sublabel="1 per install" />
            <Arrow label="contains" />
            <EntityPill color="#8b5cf6" icon="👥" label="Teams" sublabel="logical groupings" />
            <Arrow label="own" />
            <EntityPill color="#a855f7" icon="🌊" label="Agent Pools" sublabel="rosters of agents" />
            <Arrow label="contain" />
            <EntityPill color="#7c3aed" icon="🤖" label="Agents" sublabel="LLM wrappers" />
            <Arrow label="use" />
            <EntityPill color="#6d28d9" icon="⚡" label="Skills" sublabel="JS/Python functions" />
          </div>
          <p>
            <strong>Workflows</strong> are separate — they belong to a team and stitch together any combination of agents, skills, API calls, and logic blocks into a runnable graph.
          </p>
          <table>
            <thead><tr><th>Entity</th><th>ID prefix</th><th>What it stores</th></tr></thead>
            <tbody>
              <tr><td><strong>Team</strong></td><td><code>t_</code></td><td>Name, list of agent pool IDs it owns</td></tr>
              <tr><td><strong>Agent Pool</strong></td><td><code>pool_</code></td><td>Name, parent team, list of agent IDs</td></tr>
              <tr><td><strong>Agent</strong></td><td><code>ag_</code></td><td>Model, system prompt, user prompt, input/output schema, attached skill IDs, memory config</td></tr>
              <tr><td><strong>Skill</strong></td><td><code>sk_</code></td><td>Language (JS/Python/JSONPath), source code, input schema, output schema</td></tr>
              <tr><td><strong>Workflow</strong></td><td><code>wf_</code></td><td>Nodes array, edges array, per-node config values, metadata (timeout, retries, tags)</td></tr>
            </tbody>
          </table>

          <h3 id="fw-exec">End-to-end execution</h3>
          <div className="wiki-steps">
            <Step num={1} title="Canvas → JSON">When you press Run, the canvas serializes to a workflow JSON blob: nodes (block instances with positions), edges (connections), and subBlockValues (Inspector config per node).</Step>
            <Step num={2} title="Seed phase">The graph-runner finds all seed nodes — Starter, User Input (prompts user), Audio Input, Schedule, Webhook — and sets their initial output values.</Step>
            <Step num={3} title="BFS readiness loop">Each tick: any node whose every incoming edge has a live (resolved) source is considered ready. All ready nodes fire simultaneously via <code>Promise.all</code>.</Step>
            <Step num={4} title="Per-node handlers">Each block type has its own handler: Agent calls the LLM, API makes an HTTP request, Function/Skill runs user JavaScript, MCP calls an external tool server, etc.</Step>
            <Step num={5} title="Output routing">Outputs are stored in an <code>outputs</code> map keyed by node ID. Branching blocks (if_else, switch, router) emit a <code>{'{ branch, value }'}</code> shape — only the matching edge is live for downstream nodes.</Step>
            <Step num={6} title="Progress streaming">Every start/done/error event is emitted via <code>onProgress</code> callback → Debug panel, node card state (pulsing green → solid green ✓ / red ✗), and run dock Output.</Step>
          </div>
          <Tip type="info">The graph-runner runs entirely in the browser. No server is required for most block types. Only blocks like PostgreSQL, Redis, SMTP, and Slack require the ck8t-server proxy (they need server-side credentials).</Tip>

          <h3 id="fw-example">Full worked example — Customer Triage System</h3>
          <p>
            Here's a complete real-world setup showing how all entities connect. A SaaS company wants to auto-triage customer support tickets.
          </p>

          <h4>1. Team setup</h4>
          <table>
            <thead><tr><th>Entity</th><th>Name</th><th>Config</th></tr></thead>
            <tbody>
              <tr><td>Team</td><td><code>Support Ops</code></td><td>Owns the "Triage Agents" pool</td></tr>
              <tr><td>Agent Pool</td><td><code>Triage Agents</code></td><td>Contains 4 specialist agents</td></tr>
              <tr><td>Agent</td><td><code>Classifier</code></td><td>gpt-4.1-mini · classifies ticket into billing/tech/sales/general · strict JSON output: <code>{'{ category, confidence }'}</code></td></tr>
              <tr><td>Agent</td><td><code>Billing Specialist</code></td><td>gpt-4.1 · system: "You are a billing expert…" · responds to billing issues</td></tr>
              <tr><td>Agent</td><td><code>Tech Specialist</code></td><td>gpt-4.1 · system: "You are a senior engineer…" · debugs technical problems</td></tr>
              <tr><td>Agent</td><td><code>Sales Specialist</code></td><td>gpt-4.1 · system: "You are a friendly sales consultant…" · handles pricing/upgrade questions</td></tr>
            </tbody>
          </table>

          <h4>2. Skills</h4>
          <table>
            <thead><tr><th>Skill ID</th><th>Name</th><th>Language</th><th>What it does</th></tr></thead>
            <tbody>
              <tr><td><code>sk_ticket_parse</code></td><td>Ticket Parser</td><td>JavaScript</td><td>Extracts subject, body, customer email from raw ticket JSON</td></tr>
              <tr><td><code>sk_sentiment</code></td><td>Sentiment Score</td><td>JavaScript</td><td>Calculates urgency score 0–10 using keyword heuristics</td></tr>
              <tr><td><code>sk_crm_lookup</code></td><td>CRM Lookup</td><td>JavaScript</td><td>Fetches customer tier (free/pro/enterprise) from CRM API</td></tr>
            </tbody>
          </table>

          <h4>3. Workflow: Triage Pipeline</h4>
          <p>The workflow JSON assembles these into a runnable graph:</p>
          <CodeBlock language="javascript" filename="triage-workflow — node sequence">
{`Webhook Request        ← receives POST from support email parser
      ↓
 Skill: Ticket Parser   ← extracts { subject, body, customerEmail }
      ↓
 Skill: CRM Lookup      ← adds { tier: 'pro' } to the bag
      ↓
 Skill: Sentiment Score ← adds { urgency: 7 }
      ↓
 Agent: Classifier      ← uses all upstream data, returns { category: 'tech', confidence: 0.94 }
      ↓
 if_elseif_else         ← branches on input.category
  ├─ 'billing'  → Agent: Billing Specialist  → Response
  ├─ 'tech'     → Agent: Tech Specialist     → Response
  └─ 'sales'    → Agent: Sales Specialist    → Response`}
          </CodeBlock>

          <Tip type="success">
            Because Skill, Ticket Parser, CRM Lookup, and Sentiment Score have no dependencies on each other (they all read from the webhook output),
            the graph-runner runs all three skills in parallel via <code>Promise.all</code> — cutting latency significantly.
          </Tip>
        </div>

        <div className="wiki-divider" />

        {/* ═══ Workflow JSON Schema ═══ */}
        <div className="wiki-section" id="json-explorer">
          <h2>Workflow JSON Schema</h2>
          <p>
            Every workflow is stored and transmitted as a single JSON blob. This is the
            <strong> only data contract</strong> between the frontend canvas and the
            backend graph runner. The frontend produces it; the backend consumes it.
            Understanding this structure is essential for debugging, exporting, and
            writing custom integrations.
          </p>

          <h3 id="json-schema">Full structure</h3>
          <div className="wiki-json-collapsible">
            <JsonView value={WORKFLOW_JSON_EXAMPLE} collapsible defaultExpanded={1} />
          </div>

          <Tip type="info">
            Use the <strong>Export</strong> button in the toolbar to download
            this JSON for any workflow you{"'"}ve built.
          </Tip>

          <h3 style={{ marginTop: 40 }}>Tag reference</h3>

          <JsonTagCard id="json-wrapper" icon="📦" code="_comment / workflow" title="Export wrapper — top-level envelope" variant="nodes">
            Every exported file wraps the workflow inside a top-level <code>workflow</code> object
            alongside a human-readable <code>_comment</code> string that records the export
            timestamp. The <code>workflow</code> object carries five required keys:{' '}
            <code>id</code> (unique workflow identifier, e.g. <code>wf_demo_url_summary</code>),{' '}
            <code>name</code> (display name), <code>teamId</code> (owning team, or{' '}
            <code>null</code> if unassigned), <code>createdAt</code> (ISO-8601 creation
            timestamp), and the three structural keys <code>nodes</code>, <code>edges</code>,
            and <code>subBlockValues</code>. When importing via drag-and-drop the runtime reads{' '}
            <code>file.workflow</code> first, then falls back to the root object for legacy files
            that lack the wrapper.
          </JsonTagCard>

          <JsonTagCard id="json-nodes" icon="🧩" code="nodes" title="Block instances on the canvas" variant="nodes">
            Each object represents one block dropped onto the canvas. Every node always has four
            top-level keys:{' '}
            <code>id</code> — unique identifier referenced by edges and <code>subBlockValues</code>;{' '}
            <code>type</code> — always <code>&quot;builderBlock&quot;</code> (the ReactFlow node type
            that selects the WorkflowNode renderer);{' '}
            <code>data</code> — metadata object (see below); and{' '}
            <code>position</code> — canvas x/y coordinates. The <code>id</code> drives execution
            routing — do not change it after creating edges.
          </JsonTagCard>

          <JsonTagCard id="json-node-data" icon="🎨" code="data.*" title="Node metadata fields inside data" variant="blocktype">
            <code>data.blockType</code> — the block identity string (see below).{' '}
            <code>data.title</code> — user-visible label rendered on the canvas card.{' '}
            <code>data.bgColor</code> — hex colour of the node header / icon well (e.g.{' '}
            <code>#6F3DFA</code> for agent, <code>#FBBF24</code> for user_input). Used purely for
            visual identification; does not affect execution.{' '}
            <code>data.category</code> — optional hint (<code>&quot;blocks&quot;</code>,{' '}
            <code>&quot;tools&quot;</code>, <code>&quot;triggers&quot;</code>) that places the block
            in the correct palette group.{' '}
            <code>data.disabled</code> — when <code>true</code> the node is muted: it passes its
            upstream input through unchanged and the runner skips its actual handler.{' '}
            <code>data.width</code> / <code>data.height</code> — optional persisted dimensions set
            when the user manually resizes a node via the resize handles. Omit them to let the
            node size itself to content.
          </JsonTagCard>

          <JsonTagCard id="json-edges" icon="🔗" code="edges" title="Connections between blocks" variant="edges">
            Each edge connects one node{"'"}s output port to another node{"'"}s input port and
            carries six fields:{' '}
            <code>id</code> — auto-generated string, typically{' '}
            <code>reactflow__edge-&#123;source&#125;&#123;sourceHandle&#125;-&#123;target&#125;&#123;targetHandle&#125;</code>;{' '}
            <code>source</code> / <code>target</code> — node IDs;{' '}
            <code>sourceHandle</code> — the named output port on the source node (e.g.{' '}
            <code>&quot;out&quot;</code>, <code>&quot;value&quot;</code>, <code>&quot;result&quot;</code>,{' '}
            <code>&quot;data&quot;</code>, or branch labels like <code>&quot;branch_1&quot;</code>);{' '}
            <code>targetHandle</code> — the named input port on the target node, conventionally
            prefixed with <code>in_</code> (e.g. <code>&quot;in_input&quot;</code>,{' '}
            <code>&quot;in_data&quot;</code>); and <code>animated</code> — always{' '}
            <code>true</code> for the dashed flow animation. The graph runner uses edges to
            determine BFS execution order and, for branching blocks, only the edge whose{' '}
            <code>sourceHandle</code> matches the chosen branch handle is live.
          </JsonTagCard>

          <JsonTagCard id="json-sbv" icon="⚙️" code="subBlockValues" title="Configuration data per node" variant="values">
            Keyed by node ID. Each value is a flat object whose keys match the{' '}
            <code>subBlocks[].id</code> fields from that block{"'"}s definition in the frontend
            registry. This is the <strong>data contract</strong> between frontend and backend — the
            graph runner reads <code>values.model</code>, <code>values.temperature</code>,{' '}
            <code>values.systemPrompt</code>, <code>values.skillId</code>, etc. from this bag.
            When you configure a field in the Inspector panel the value is written here.
            Template expressions like <code>{"{{title}}"}</code> or{' '}
            <code>{"<n_agent.summary>"}</code> in string values are interpolated at runtime against
            the upstream node{"'"}s output bag.
          </JsonTagCard>

          <JsonTagCard id="json-porttypes" icon="🔌" code="_portTypes" title="Port type overrides per node" variant="values">
            An optional map inside any <code>subBlockValues</code> entry that overrides the
            statically declared port types for that node instance. Keys follow the convention{' '}
            <code>out_&lt;portKey&gt;</code> for output ports and <code>in_&lt;portKey&gt;</code> for
            input ports (e.g. <code>&quot;out_value&quot;: &quot;string&quot;</code>,{' '}
            <code>&quot;in_input&quot;: &quot;string&quot;</code>,{' '}
            <code>&quot;out_result&quot;: &quot;json&quot;</code>). The Inspector writes these
            automatically when the user changes a port type via the type-chip dropdown on the node
            card. The graph runner uses them during BFS to validate type compatibility between
            connected ports — a mismatch raises a <code>Type mismatch</code> error before any
            block executes. Omit the key entirely to rely on the block{"'"}s static declaration.
          </JsonTagCard>

          <JsonTagCard id="json-blocktype" icon="🏷️" code="data.blockType" title="The block's identity" variant="blocktype">
            This string is the single most important coupling point between frontend and backend.
            It must exactly match: (1) the <code>type</code> field in the block definition JS file,
            (2) the key in <code>registry.js</code>, (3) the <code>case</code> label in the frontend{' '}
            <code>graph-runner.js</code> <code>runNode()</code> switch, and (4) the{' '}
            <code>case</code> label in the backend <code>graph-runner.ts</code>{' '}
            <code>runNode()</code> switch. If any of these four don{"'"}t match, the block silently
            fails or falls through to pass-through behavior.
          </JsonTagCard>

          <JsonTagCard id="json-position" icon="📐" code="position" title="Canvas layout coordinates" variant="position">
            Stores <code>{"{ x, y }"}</code> pixel coordinates for ReactFlow rendering. These are
            purely visual — execution order is determined entirely by edges, not spatial position.
            Two nodes at the same Y coordinate don{"'"}t run {"\u201c"}at the same time{"\u201d"}{' '}
            unless they share the same set of resolved upstream dependencies.
          </JsonTagCard>

          <JsonTagCard id="json-templates" icon="🔀" code="{{field}} / <node_id.field>" title="Template expressions — Runtime interpolation" variant="template">
            Two syntaxes resolve upstream data at runtime:{' '}
            <code>{"{{field}}"}</code> — Mustache-style, injects a top-level key from the
            upstream node{"'"}s output object directly into a prompt or value string (e.g.{' '}
            <code>{"{{title}}"}</code>, <code>{"{{text}}"}</code>).{' '}
            <code>{"<nodeId.field>"}</code> — angle-bracket reference to a specific node{"'"}s
            output field (e.g. <code>{"<n_agent.summary>"}</code>). Use this form when you need
            to reference a node that is not the immediate upstream. At execution time the graph
            runner resolves both forms from the <code>outputs</code> map and replaces them before
            calling the block handler. Unresolved references are left as-is and typically cause
            an LLM refusal — check the Debug panel{"'"}s <code>meta.userPrompt</code> to confirm
            interpolation succeeded.
          </JsonTagCard>
        </div>

        <div className="wiki-divider" />

        {/* ═══ Block Reference ═══ */}
        <div className="wiki-section" id="part2">
          <h2>Block Reference</h2>
          <p>
            Every built-in block with its fields, inputs, outputs, execution notes, and a canvas card preview.
            There are currently <strong>{blocks.length}</strong> blocks across three categories:
            <span className="wiki-cat core">blocks</span>
            <span className="wiki-cat tool">tools</span>
            <span className="wiki-cat trigger">triggers</span>
          </p>

          {CATEGORY_ORDER.map((cat) => {
            const catBlocks = groupedBlocks[cat]
            if (!catBlocks || catBlocks.length === 0) return null
            const catClass = cat === 'tools' ? 'tool' : cat === 'triggers' ? 'trigger' : 'core'

            const renderBlock = (b) => {
              const inputEntries = b.inputs ? Object.entries(b.inputs) : []
              const outputEntries = b.outputs ? Object.entries(b.outputs) : []
              return (
                <div key={b.type} id={`b-${b.type}`} className="wiki-block-anchor" style={{ marginTop: 32 }}>
                  <h3>
                    <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 3, background: b.bgColor, verticalAlign: 'middle', marginRight: 8 }} />
                    {b.name}
                    <code style={{ marginLeft: 8, fontSize: '.8rem' }}>{b.type}</code>
                    <span className={`wiki-cat ${catClass}`}>{b.category}</span>
                  </h3>
                  <p>{b.longDescription || b.description}</p>

                  <BlockCard block={b} />

                  {b.subBlocks && b.subBlocks.length > 0 && (
                    <>
                      <h4>Fields</h4>
                      <table>
                        <thead><tr><th>Field</th><th>Type</th><th>Details</th></tr></thead>
                        <tbody>
                          {b.subBlocks.map((f) => (
                            <tr key={f.id}>
                              <td><code>{f.id}</code>{f.required && <> <Badge type="required">required</Badge></>}{f.mode === 'advanced' && <> <Badge type="advanced">advanced</Badge></>}</td>
                              <td><code>{f.type}</code></td>
                              <td>{f.title}{f.placeholder ? ` — ${f.placeholder}` : ''}{f.defaultValue != null ? ` (default: ${f.defaultValue})` : ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}

                  {inputEntries.length > 0 && (
                    <>
                      <h4>Inputs</h4>
                      <table>
                        <thead><tr><th>Key</th><th>Type</th><th>Description</th></tr></thead>
                        <tbody>
                          {inputEntries.map(([k, v]) => (
                            <tr key={k}><td><code>{k}</code></td><td>{v.type}</td><td>{v.description}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}

                  {outputEntries.length > 0 && (
                    <>
                      <h4>Outputs</h4>
                      <table>
                        <thead><tr><th>Key</th><th>Type</th><th>Description</th></tr></thead>
                        <tbody>
                          {outputEntries.map(([k, v]) => (
                            <tr key={k}><td><code>{k}</code></td><td>{v.type}</td><td>{v.description}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
              )
            }

            // All categories use sub-groups from CATEGORY_CONFIG
            const { topItems, groups } = categorySubGroups[cat]
            return (
              <Collapsible key={cat} title={`${CATEGORY_LABELS[cat]} (${catBlocks.length})`} className="wiki-block-group" defaultOpen={false}>
                {topItems.map(renderBlock)}
                {groups.map((sg) => (
                  <Collapsible key={sg.id} title={`${sg.label} (${sg.items.length})`} className="wiki-block-subgroup" defaultOpen={false}>
                    {sg.items.map(renderBlock)}
                  </Collapsible>
                ))}
              </Collapsible>
            )
          })}
        </div>

        <div className="wiki-divider" />

        {/* ═══ Teams, Agents & Skills ═══ */}
        <div className="wiki-section" id="ent-teams">
          <h2>Teams, Agents & Skills</h2>

          <h3 id="ent-teams">Teams & Agent Pools</h3>
          <p>
            A <strong>Team</strong> is the top-level organizational unit — think of it as a department or squad. Each team owns one or more
            <strong> Agent Pools</strong>, which are curated rosters of agents that work together on related problems. You navigate to
            teams via the left sidebar → <em>Teams</em> section.
          </p>
          <table>
            <thead><tr><th>Action</th><th>How</th></tr></thead>
            <tbody>
              <tr><td>Create team</td><td>Sidebar → Teams → <strong>+ New Team</strong></td></tr>
              <tr><td>Add an agent pool</td><td>Click into a team card → <strong>+ Add Pool</strong></td></tr>
              <tr><td>Rename / delete</td><td>Right-click the team or pool card → context menu</td></tr>
              <tr><td>Duplicate</td><td>Right-click → Duplicate (copies team + all its pools + agents)</td></tr>
            </tbody>
          </table>
          <Tip type="info">A workflow is assigned to a team via the Workflow Settings inspector (right rail when no node selected). This determines which team card the workflow appears under in the sidebar.</Tip>

          <h3 id="ent-agents">Agents</h3>
          <p>
            An <strong>Agent</strong> is a configured LLM call. It wraps a model + system prompt + user prompt + optional skills + optional memory into a single reusable unit. Agents are not blocks — they live in the sidebar under their pool and are referenced by the <strong>Agent block</strong> on the canvas (which has its own inline config).
          </p>
          <table>
            <thead><tr><th>Config field</th><th>What it does</th></tr></thead>
            <tbody>
              <tr><td><strong>Model</strong></td><td>Which LLM to call. Populated from your configured provider. Falls back to the workspace default if blank.</td></tr>
              <tr><td><strong>System prompt</strong></td><td>The persistent persona/instruction. Supports <code>{'{{key}}'}</code> template interpolation from upstream outputs.</td></tr>
              <tr><td><strong>User prompt</strong></td><td>The per-turn message. Template expressions like <code>{'{{title}}'}</code> or <code>{'<n_parser.text>'}</code> inject upstream data.</td></tr>
              <tr><td><strong>Skills / Tools</strong></td><td>JS/Python skill functions attached to this agent. The LLM can call them as tools during generation.</td></tr>
              <tr><td><strong>Response Format</strong></td><td>JSON Schema for structured output. Enable <em>Strict</em> to enforce it — the model won't deviate.</td></tr>
              <tr><td><strong>Memory</strong></td><td>None / Conversation (full history) / Sliding Window (last N messages) / Token-limited sliding window.</td></tr>
              <tr><td><strong>Temperature</strong></td><td>0.0 = deterministic, 2.0 = very creative. Default 0.3 for structured tasks.</td></tr>
              <tr><td><strong>Reasoning effort</strong> (advanced)</td><td>For reasoning models: auto / low / medium / high. Controls internal chain-of-thought depth.</td></tr>
            </tbody>
          </table>
          <Tip type="warn">
            The Agent <em>block</em> on the canvas has its own inline model/prompt config — this is separate from Agents in the sidebar.
            The canvas Agent block is self-contained. Sidebar agents are referenced when you want to reuse the same agent configuration across multiple workflows.
          </Tip>

          <h3 id="ent-skills">Skills</h3>
          <p>
            A <strong>Skill</strong> is a reusable JavaScript, Python, or JSONPath function with declared input/output schemas. Skills serve two purposes:
          </p>
          <ol>
            <li><strong>As a canvas block</strong> — drop a Skill block, select your skill, wire upstream data in. The function runs in the graph.</li>
            <li><strong>As an agent tool</strong> — attach a skill to an Agent. The LLM can call it like a function during generation (OpenAI-style tool use).</li>
          </ol>
          <CodeBlock language="javascript" filename="Example skill — sk_url_extract">
{`// Language: JavaScript
// Input schema: { url: { type: 'string' } }
// Output schema: { title: { type: 'string' }, text: { type: 'string' } }

async function run(params) {
  const res  = await fetch(params.input)
  const html = await res.text()
  const title = html.match(/<title>(.*?)<\\/title>/i)?.[1] || 'Untitled'
  const text  = html.replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ').trim().slice(0, 2000)
  return { title, text }
}`}
          </CodeBlock>
          <table>
            <thead><tr><th>Language</th><th>Runtime</th><th>Use for</th></tr></thead>
            <tbody>
              <tr><td><strong>JavaScript</strong></td><td>Browser <code>new Function()</code> sandbox</td><td>Fetch, transform, parse, compute. Full ES2022 + async/await.</td></tr>
              <tr><td><strong>Python</strong></td><td>ck8t-server subprocess (requires server)</td><td>Data science, ML libraries, pandas, numpy.</td></tr>
              <tr><td><strong>JSONPath</strong></td><td>Browser (JSONPath eval)</td><td>Extract fields from JSON payloads without writing code.</td></tr>
            </tbody>
          </table>
          <p>The skill receives <code>params</code> as its argument. When called from a canvas Skill block, <code>params.input</code> = the upstream connected value. When called as an agent tool, <code>params</code> = the JSON the LLM generated for the tool call.</p>

          <h3 id="ent-workflows">Workflows</h3>
          <p>
            A <strong>Workflow</strong> is the canvas graph — nodes, edges, and per-node config combined into one JSON document. Workflows are assigned to a team and appear in the sidebar under that team's section.
          </p>
          <table>
            <thead><tr><th>Workflow field</th><th>Where to edit</th></tr></thead>
            <tbody>
              <tr><td>Name, Description, Team</td><td>Right inspector panel → <em>Basic</em> tab (deselect all nodes)</td></tr>
              <tr><td>Default timeout, Max retries, Fail-fast</td><td>Right inspector → <em>Advanced</em> tab</td></tr>
              <tr><td>Tags</td><td>Advanced tab — comma-separated, used for sidebar filtering</td></tr>
              <tr><td>Export as JSON</td><td>Toolbar → <strong>Export</strong> button → downloads <code>workflow.json</code></td></tr>
              <tr><td>Import</td><td>Drag-and-drop a JSON file onto the canvas</td></tr>
            </tbody>
          </table>
          <Tip type="info">
            <code>⌘S</code> autosaves the current canvas state to localStorage instantly. <code>⌘E</code> or the toolbar Export button downloads a portable JSON you can share or version-control.
          </Tip>
        </div>

        <div className="wiki-divider" />

        {/* ═══ MCP & Tool Integration ═══ */}
        <div className="wiki-section" id="mcp-what">
          <h2>MCP & Tool Integration</h2>

          <h3 id="mcp-what">What is MCP?</h3>
          <p>
            <strong>MCP (Model Context Protocol)</strong> is an open standard for connecting LLMs to external tools and data sources.
            An MCP server is a small process that exposes a list of <em>tools</em> — each tool has a name, description, and JSON Schema for its arguments.
            The LLM can call any tool during generation by emitting a structured tool-call message, and the MCP client dispatches it.
          </p>
          <p>
            In CK8T, MCP servers are configured once (in Settings → MCP Servers) and then reusable anywhere on the canvas via the
            <strong> MCP Tool block</strong>. You pick the server from a dropdown, then pick the tool, and wire upstream data as arguments.
          </p>
          <Tip type="info">MCP servers run on your machine (or a remote host). CK8T communicates with them via the ck8t-server proxy. The MCP block is a "server-required" block — it needs ck8t-server running to dispatch calls.</Tip>

          <h3 id="mcp-config">Configuring an MCP server</h3>
          <div className="wiki-steps">
            <Step num={1} title="Open Settings">Top toolbar → Settings gear (⌘,)</Step>
            <Step num={2} title="MCP Servers tab">Click the MCP Servers tab in the Settings panel.</Step>
            <Step num={3} title="Add server">Enter a name, the server URL (e.g. <code>http://localhost:3100</code>), and optional auth headers. Click Add.</Step>
            <Step num={4} title="Refresh tools">Click the refresh icon next to the server — CK8T fetches and caches all available tools. They're immediately available in the MCP block dropdown.</Step>
          </div>
          <CodeBlock language="javascript" filename="Example: Brave Search MCP server config">
{`{
  "name":    "brave-search",
  "url":     "http://localhost:3100",
  "headers": { "Authorization": "Bearer YOUR_BRAVE_KEY" }
}

// Tools it exposes:
// brave_search(query: string, count?: number) → { results: [{title, url, description}] }
// brave_news(query: string) → { articles: [...] }
// brave_local(query: string, location: string) → { places: [...] }`}
          </CodeBlock>

          <h3 id="mcp-block">MCP block on the canvas</h3>
          <p>The MCP Tool block has two required fields:</p>
          <table>
            <thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead>
            <tbody>
              <tr><td><strong>MCP Server</strong></td><td>Dropdown</td><td>Select from your configured servers. Populated dynamically from the MCP store.</td></tr>
              <tr><td><strong>Tool</strong></td><td>Dropdown</td><td>Appears once a server is selected. Lists all tools that server exposes.</td></tr>
            </tbody>
          </table>
          <p>
            The block's <code>input</code> port accepts any upstream data and passes it as the tool arguments. The tool's JSON Schema
            drives argument validation. The output is the MCP <code>content</code> array — typically an array of text/image/resource objects.
          </p>
          <CodeBlock language="javascript" filename="Graph-runner: how MCP calls are dispatched">
{`// graph-runner.js — runMcpNode()
async function runMcpNode({ values, input }) {
  const serverId = values?.server  // e.g. 'brave-search'
  const tool     = values?.tool    // e.g. 'mcp:brave-search:brave_search'
  const args     = input || {}

  // POST /api/v1/mcp/servers/{serverId}/tools/{toolName}/call
  const res = await callTool(serverId, toolName, args)
  return { content: res.content }   // MCP content array
}`}
          </CodeBlock>

          <Tip type="warn">
            If you get "MCP warning: ck8t-server is not reachable" in the block tooltip — start ck8t-server (<code>cd ck8t-server && npm start</code>).
            The MCP block is one of the few that strictly requires the server proxy, because MCP servers often need server-side credentials and aren't CORS-friendly for direct browser calls.
          </Tip>
        </div>

        <div className="wiki-divider" />

        {/* ═══ Custom Providers & Browser Mode ═══ */}
        <div className="wiki-section" id="prov-why">
          <h2>Custom Providers & Browser Mode</h2>

          <h3 id="prov-why">Why custom providers?</h3>
          <p>
            By default, CK8T routes LLM calls through the ck8t-server proxy, which reads API keys from its own environment variables.
            <strong> Browser mode</strong> is for when ck8t-server isn't running — you're on the portfolio demo, running as a VS Code extension without a local server, or just don't want to run Node.
          </p>
          <p>
            In browser mode, custom providers let you add your own API keys directly in the browser. The keys are stored
            <strong> AES-256-GCM encrypted</strong> in localStorage — they're never visible in plain text, never sent to any server you don't own.
          </p>
          <Tip type="info">
            When ck8t-server is running, it detects the server at startup and uses it. When the probe fails (2.5s timeout), it automatically falls into browser mode and shows the custom providers panel.
          </Tip>

          <h3 id="prov-add">Adding a provider</h3>
          <p>Settings → <em>LLM Provider Configuration</em> → scroll to <em>Custom Providers</em>:</p>
          <table>
            <thead><tr><th>Field</th><th>Example</th><th>Notes</th></tr></thead>
            <tbody>
              <tr><td><strong>Provider name</strong></td><td>My OpenAI</td><td>Becomes the provider key (slug)</td></tr>
              <tr><td><strong>Type</strong></td><td>openai / anthropic / gemini / ollama / lmstudio / qwen / grok / mistral / deepseek</td><td>Controls URL path suffix and auth headers</td></tr>
              <tr><td><strong>Chat URL</strong></td><td><code>https://api.openai.com/v1/chat/completions</code></td><td>Full path to the chat endpoint</td></tr>
              <tr><td><strong>Models URL</strong></td><td><code>https://api.openai.com/v1/models</code></td><td>Used to fetch the live model list</td></tr>
              <tr><td><strong>API Key</strong></td><td><code>sk-…</code></td><td>Encrypted with AES-GCM before storage. Leave blank to keep existing key when editing.</td></tr>
            </tbody>
          </table>

          <h4>Provider-specific URL examples</h4>
          <table>
            <thead><tr><th>Provider</th><th>Chat URL</th><th>Models URL</th></tr></thead>
            <tbody>
              <tr><td>OpenAI</td><td><code>https://api.openai.com/v1/chat/completions</code></td><td><code>https://api.openai.com/v1/models</code></td></tr>
              <tr><td>Anthropic</td><td><code>https://api.anthropic.com/v1/messages</code></td><td><code>https://api.anthropic.com/v1/models</code></td></tr>
              <tr><td>Gemini</td><td><code>https://generativelanguage.googleapis.com/v1beta/openai/chat/completions</code></td><td><code>…/v1beta/openai/models</code></td></tr>
              <tr><td>Ollama (local)</td><td><code>http://localhost:11434/api/chat</code></td><td><code>http://localhost:11434/api/tags</code></td></tr>
              <tr><td>LM Studio</td><td><code>http://localhost:1234/v1/chat/completions</code></td><td><code>http://localhost:1234/v1/models</code></td></tr>
              <tr><td>Qwen</td><td><code>https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions</code></td><td><code>…/compatible-mode/v1/models</code></td></tr>
            </tbody>
          </table>

          <h3 id="prov-security">AES-GCM key encryption</h3>
          <p>
            API keys are never stored in plain text. The encryption flow:
          </p>
          <div className="wiki-steps">
            <Step num={1} title="Key derivation">PBKDF2 derives a 256-bit AES-GCM key from a fixed passphrase using 100,000 SHA-256 iterations. This happens once per session and is cached.</Step>
            <Step num={2} title="Encrypt on save">When you save a provider, the entire providers array (including the API key) is JSON-serialized then encrypted with a random 96-bit IV.</Step>
            <Step num={3} title="Stored as base64">Storage format: <code>{'<IV base64>.<ciphertext base64>'}</code> under localStorage key <code>ck8t/browser-providers-v2</code>.</Step>
            <Step num={4} title="Decrypt on load">On every page load, the same deterministic PBKDF2 derivation recreates the key and decrypts the blob. If decryption fails, the store starts empty.</Step>
          </div>
          <Tip type="success">
            Because the encryption key is derived from a fixed passphrase (not a user password), the goal is <strong>obfuscation from casual inspection</strong>, not protection from a determined attacker with disk access.
            For production systems with highly sensitive keys, use ck8t-server's environment variables instead.
          </Tip>

          <h4>How it flows into the graph-runner</h4>
          <CodeBlock language="javascript" filename="browser-providers-store.js → llm-config-store → graph-runner">
{`// 1. buildModelConfig() produces a consumer config shape:
{
  provider: 'my_openai',
  my_openai: {
    model: 'gpt-4.1',
    models: [{ id: 'gpt-4.1', label: 'gpt-4.1' }],
    type: 'openai',
    apiKey: '<<decrypted key>>',
    baseUrl: 'https://api.openai.com',
    chatUrl: 'https://api.openai.com/v1/chat/completions',
  }
}

// 2. llm-config-store.setConfig() derives model entries including apiKey + chatUrl
// 3. graph-runner.tryDirectLlmCall() checks:
const chatUrl = modelEntry.chatUrl || \`\${baseUrl}/v1/chat/completions\`
// → uses the exact chatUrl for Gemini (/v1beta/openai/...) and Qwen (/compatible-mode/...)
// → adds Authorization: Bearer {apiKey} header
// → POSTs directly from browser, no server needed`}
          </CodeBlock>
        </div>

        <div className="wiki-divider" />

        {/* ═══ Skill Debugger ═══ */}
        <div className="wiki-section" id="dbg-open">
          <h2>Skill Debugger</h2>
          <p>
            The Skill Debugger is a full interactive JavaScript debugger built into the Skills editor. It instruments your source code
            at the AST level, injecting breakpoint hooks before every statement. You can pause, inspect variables, and step through
            your skill line by line — without leaving the browser.
          </p>

          <h3 id="dbg-open">Opening the debugger</h3>
          <div className="wiki-steps">
            <Step num={1} title="Open a skill">Sidebar → Skills → click a skill name. The skill editor opens in the center pane.</Step>
            <Step num={2} title="Test Panel">Click the <strong>▸ Test</strong> section at the bottom to expand it. You can do a quick run here without breakpoints.</Step>
            <Step num={3} title="Debug mode">Click the <strong>🐛 Debug</strong> button in the test panel header. The debugger overlay slides in.</Step>
          </div>

          <h3 id="dbg-bp">Setting breakpoints</h3>
          <p>
            In the debugger's code view, click any <strong>line number</strong> in the gutter to toggle a red breakpoint dot <span style={{color:'#ef4444'}}>●</span>.
            Multiple breakpoints can be active simultaneously.
          </p>
          <DebuggerMockup currentLine={4} variables={{ url: '"https://example.com"', res: '<Response status=200 ok=true>', params: '{ input: "…" }' }} />
          <p style={{fontSize:12,color:'var(--text-secondary,#64748b)',textAlign:'center',marginTop:4}}>Debugger paused at line 4 — variables visible in right panel</p>

          <h4>Debugger toolbar</h4>
          <table>
            <thead><tr><th>Button</th><th>Shortcut</th><th>What it does</th></tr></thead>
            <tbody>
              <tr><td><strong>▶ Start</strong></td><td>—</td><td>Runs the skill with current params. Pauses at first breakpoint encountered.</td></tr>
              <tr><td><strong>▶ Resume</strong></td><td>—</td><td>Continues execution from current pause point to the next breakpoint (or end).</td></tr>
              <tr><td><strong>⤵ Step</strong></td><td>—</td><td>Step Over — advances exactly one statement, then pauses again.</td></tr>
              <tr><td><strong>⏹ Stop</strong></td><td>—</td><td>Aborts execution immediately (throws a stop signal internally).</td></tr>
              <tr><td><strong>✕ Close</strong></td><td>—</td><td>Exits debug mode back to normal skill editor.</td></tr>
            </tbody>
          </table>

          <h3 id="dbg-vars">Variable inspection</h3>
          <p>
            When paused, the <strong>Variables</strong> tab (right panel) shows every in-scope variable at that exact line.
            The debugger uses static analysis to find all <code>const/let/var</code> declarations and function parameters visible
            before the current line, then captures their live values via a safe <code>try/catch</code> capture function.
          </p>
          <table>
            <thead><tr><th>Variable value type</th><th>Display</th></tr></thead>
            <tbody>
              <tr><td>String</td><td>Quoted in <span style={{color:'#86efac'}}>green</span>: <code>"hello"</code></td></tr>
              <tr><td>Number / Boolean</td><td><span style={{color:'#7dd3fc'}}>cyan</span>: <code>42</code> / <code>true</code></td></tr>
              <tr><td>Object / Array</td><td>Expandable tree: click <code>▸</code> to expand, see all keys. Preview shows <code>{'{ key1, key2… }'}</code></td></tr>
              <tr><td>Promise</td><td><code>'&lt;Promise&gt;'</code> — it resolved before capture</td></tr>
              <tr><td>Response</td><td><code>'&lt;Response status=200 ok=true&gt;'</code></td></tr>
              <tr><td>Not yet assigned (TDZ)</td><td>Silently omitted — the capture fn uses try/catch</td></tr>
            </tbody>
          </table>
          <Tip type="info">
            <strong>Hover any variable name</strong> in the code view to see a floating tooltip with its current value — without switching to the Variables panel.
          </Tip>

          <h3 id="dbg-step">Step-over execution</h3>
          <p>
            Step Over advances exactly one statement. Internally, this sets a <code>stepMode</code> flag so the next
            <code>__bp()</code> checkpoint always pauses, regardless of whether a breakpoint is set there.
            This lets you trace through complex logic line-by-line.
          </p>
          <CodeBlock language="javascript" filename="How instrumentation works — skill-debugger.js">
{`// Original skill source:
const res = await fetch(url)

// After instrumentation (simplified):
await __bp(4, () => ({ url, params }))  // ← injected before line 4
const res = await fetch(url)
await __bp(5, () => ({ url, res, params }))  // ← injected before line 5

// __bp() either:
//  A) returns immediately (no breakpoint, no step mode) → executes normally
//  B) suspends via Promise until Resume or Step is clicked → paused state`}
          </CodeBlock>

          <h4>Right panel tabs</h4>
          <table>
            <thead><tr><th>Tab</th><th>Auto-switches when</th><th>Content</th></tr></thead>
            <tbody>
              <tr><td>🔠 Variables</td><td>Execution pauses</td><td>Expandable variable tree for current scope</td></tr>
              <tr><td>⚙️ Params</td><td>—</td><td>JSON editor for the <code>params</code> object passed to the skill. Editable before start, read-only while running.</td></tr>
              <tr><td>📋 Console</td><td>A console.log fires</td><td>Captured <code>console.log/warn/error/info</code> with level badges</td></tr>
              <tr><td>📤 Output</td><td>Run completes or errors</td><td>Skill return value (Prism-highlighted JSON) or error message + stack</td></tr>
            </tbody>
          </table>
        </div>

        <div className="wiki-divider" />

        {/* ═══ VS Code Extension ═══ */}
        <div className="wiki-section" id="ext-overview">
          <h2>VS Code Extension</h2>
          <p>
            CK8T ships as a first-class VS Code extension that runs the full Builder Studio as a webview panel inside your editor.
            The same React app, the same block palette, the same debugger — but with two superpowers the standalone app doesn't have:
            <strong> GitHub Copilot integration</strong> (no API key needed) and <strong>SQLite-backed persistence</strong> (workspace saved locally, not just in localStorage).
          </p>

          <h3 id="ext-overview">Extension overview</h3>
          <table>
            <thead><tr><th>Feature</th><th>Standalone app</th><th>VS Code extension</th></tr></thead>
            <tbody>
              <tr><td>LLM provider</td><td>Custom provider (API key) or ck8t-server</td><td><strong>GitHub Copilot</strong> (built-in) + custom provider</td></tr>
              <tr><td>Workspace storage</td><td>localStorage + optional Postgres</td><td>SQLite via extension bridge</td></tr>
              <tr><td>MCP servers</td><td>ck8t-server required</td><td>ck8t-server required</td></tr>
              <tr><td>Python skills</td><td>ck8t-server required</td><td>ck8t-server required</td></tr>
              <tr><td>Inspector</td><td>Right rail of the app</td><td>VS Code secondary sidebar</td></tr>
              <tr><td>Wiki Guide</td><td>Center tab in the app</td><td>VS Code sidebar panel (WikiViewProvider)</td></tr>
            </tbody>
          </table>

          <h4>How the extension works architecturally</h4>
          <div className="wiki-steps">
            <Step num={1} title="Webview panel">The extension opens the React app as a VS Code WebviewPanel (or WebviewView for sidebars). The HTML is served from the built <code>extension/vscode/ck8t/webview/dist/</code>.</Step>
            <Step num={2} title="Bridge base URL">At build time, <code>VITE_CONVENGINE_BASE=BRIDGE_BASE_PLACEHOLDER</code> bakes a sentinel into all API URLs. At runtime the extension replaces every occurrence of <code>BRIDGE_BASE_PLACEHOLDER</code> with <code>http://127.0.0.1:{'{'}bridgePort{'}'}/api/v1</code>.</Step>
            <Step num={3} title="SQLite bridge">The extension spins up a local SQLite bridge server on a random port. The React app's API client hits this bridge for workspace CRUD (workflows, agents, skills, teams). Data is stored in <code>~/.ck8t/workspace.db</code>.</Step>
            <Step num={4} title="Copilot LLM calls">Agent blocks using the Copilot provider don't go to any external API. They go through the VS Code extension host which calls <code>vscode.lm.sendRequest()</code> — the Copilot API built into VS Code 1.90+.</Step>
          </div>

          <h3 id="ext-copilot">GitHub Copilot integration</h3>
          <p>
            When the extension is active, <strong>GitHub Copilot is automatically the default provider</strong>. No API key, no billing, no setup. Copilot chat models (claude-sonnet-4-6, gpt-4.1, gemini-2.0-flash, etc.) are surfaced via the model combobox on every Agent block.
          </p>
          <table>
            <thead><tr><th>Copilot capability</th><th>CK8T mapping</th></tr></thead>
            <tbody>
              <tr><td>Chat models (<code>vscode.lm.selectChatModels</code>)</td><td>Populated dynamically into the Agent block model combobox</td></tr>
              <tr><td>Tool/function calling</td><td>Skills attached to an Agent block are passed as Copilot tool definitions</td></tr>
              <tr><td>Streaming responses</td><td>Not yet used — currently collects the full response</td></tr>
              <tr><td>Access control</td><td>Managed entirely by VS Code / Copilot subscription — CK8T never sees credentials</td></tr>
            </tbody>
          </table>
          <Tip type="success">
            Copilot's family of models (Claude, GPT, Gemini via GitHub Copilot) covers most agentic use cases without any personal API key setup. It's the recommended starting point for the extension.
          </Tip>

          <h3 id="ext-providers">Custom providers in the extension</h3>
          <p>
            The extension also supports the same custom provider system as the browser app — you can add OpenAI/Anthropic/Ollama/etc. directly in Settings, and they're stored AES-GCM encrypted in the extension's localStorage (webview storage). This is useful when:
          </p>
          <ul>
            <li>You want to use a model not available through Copilot (e.g. a local Ollama model)</li>
            <li>You need to point at a company-internal LLM endpoint</li>
            <li>You want to test with a specific API key outside of Copilot's model list</li>
          </ul>
          <p>
            Custom providers in the extension work identically to the standalone app — Settings → LLM Provider Configuration → add provider → keys encrypted in localStorage → graph-runner makes direct browser fetch using the decrypted key and the <code>chatUrl</code> you configured.
          </p>

          <h4>Building and installing the extension</h4>
          <CodeBlock language="bash" filename="Build + install VS Code extension">
{`# 1. Build the webview (React app)
npm run build:extension

# 2. Build the extension TypeScript
cd extension/vscode/ck8t
npm run compile

# 3. Package as .vsix
npm run package      # runs: vsce package

# 4. Install in VS Code
code --install-extension ck8t-*.vsix

# Or: use the Extension Development Host (F5 in VS Code for faster iteration)`}
          </CodeBlock>
          <Tip type="info">
            After any source change to the React app, re-run <code>npm run build:extension</code> from the ck8t root to rebuild the webview. The extension TypeScript only needs recompile (<code>npm run compile</code>) when you change extension-side code (providers, bridge, WikiViewProvider, etc.).
          </Tip>
        </div>

        <div className="wiki-divider" />

        {/* ═══ Demo Workflows ═══ */}
        <div className="wiki-section" id="part3">
          <h2>Demo Workflows</h2>

          {/* A. Seeded URL → Summary */}
          <h3 id="w-seed">A. Seeded · URL → Summary</h3>
          <p><strong>Goal:</strong> Paste URL → skill fetches page → LLM summarises 3–5 bullets.</p>
          <div className="wiki-steps">
            <Step num={1} title="Start">Starter block with <code>manual</code> mode.</Step>
            <Step num={2} title="URL input">User input block — kind: <code>url</code>, default: <code>https://www.salilvnair.com/docs/v2/architecture</code>.</Step>
            <Step num={3} title="URL Extractor agent">Agent with <code>sk_url_extract</code> skill. Model: <code>gpt-4.1</code>. Response format: <code>{'{ url, title, text }'}</code>.</Step>
            <Step num={4} title="Summarizer agent">Second agent, model: <code>gpt-4.1</code>. Response format: <code>{'{ summary, bullets[] }'}</code>.</Step>
            <Step num={5} title="Response">Response block: <code>{'data: "<n_agent2.output>"'}</code>.</Step>
            <Step num={6} title="Preview">Show Preview block renders the final JSON on the canvas.</Step>
          </div>
          <Code>{`{
  "summary": "Architecture overview of ConvEngine v2...",
  "bullets": [
    "Event-driven microservices architecture",
    "Horizontal scaling via Kubernetes",
    "GraphQL gateway for unified API"
  ]
}`}</Code>

          {/* B. URL Summariser (lean) */}
          <h3 id="w-url">B. URL Summariser (lean, no skills)</h3>
          <p><strong>Goal:</strong> Skip workspace skills; use API block to fetch HTML → LLM summarise.</p>
          <div className="wiki-steps">
            <Step num={1} title="URL input">User input with default <code>https://example.com</code>.</Step>
            <Step num={2} title="API GET">API block: <code>GET {'{{input}}'}</code> with Accept header.</Step>
            <Step num={3} title="Summarizer">Agent: <code>gpt-5-mini</code>, prompt: <code>{'Body:\\n{{body}}'}</code>, strict output.</Step>
            <Step num={4} title="Preview">Show Preview renders result.</Step>
          </div>

          {/* C. CSV extract-and-mail */}
          <h3 id="w-csv">C. CSV Extract-and-Mail (scheduled)</h3>
          <p><strong>Goal:</strong> 08:00 IST → fetch CSV → parse → digest → save JSON → email ops.</p>
          <div className="wiki-steps">
            <Step num={1} title="Schedule trigger">Cron: <code>0 8 * * *</code>, timezone: <code>Asia/Kolkata</code>.</Step>
            <Step num={2} title="API fetch">GET the CSV URL with Bearer auth, 30s timeout, 2 retries.</Step>
            <Step num={3} title="Function (parse)">JavaScript that splits CSV on newlines, returns <code>{'{ rows, count }'}</code>.</Step>
            <Step num={4} title="Digest agent">GPT-4o with structured output: <code>{'{ date, count, highlights[], riskFlags[] }'}</code>.</Step>
            <Step num={5} title="Save to files">Path: <code>reports/digest.json</code>.</Step>
            <Step num={6} title="SMTP">Gmail SMTP → ops@example.com with HTML body.</Step>
          </div>

          {/* D. Branching triage */}
          <h3 id="w-triage">D. Branching Triage</h3>
          <p><strong>Goal:</strong> Customer message → classifier → route to specialist agent → response.</p>
          <div className="wiki-steps">
            <Step num={1} title="Customer message">User input: <code>long-text</code>.</Step>
            <Step num={2} title="Classifier agent">gpt-5-mini with <code>{'{ category: enum[billing,tech,sales] }'}</code> strict output.</Step>
            <Step num={3} title="if_elseif_else">3 branches matching <code>billing</code>, <code>tech</code>, <code>sales</code>.</Step>
            <Step num={4} title="Specialist agents">Billing, Tech, and Sales agents with domain-specific system prompts.</Step>
            <Step num={5} title="Response">Merge: <code>{'{ category, reply }'}</code> — only the active branch's agent produces output.</Step>
          </div>

          <Tip type="info">
            <strong>Branching triage examples:</strong>
          </Tip>

          <h4>Example 1 — Billing inquiry</h4>
          <p>Customer writes: <em>"I was charged twice for my subscription last month."</em></p>
          <div className="wiki-steps">
            <Step num={1} title="Classifier">Agent returns <code>{'{ "category": "billing" }'}</code>.</Step>
            <Step num={2} title="if_elseif_else">Branch 1 matches: <code>input.category === "billing"</code> → true.</Step>
            <Step num={3} title="Billing agent">System: "You are a billing specialist." → Generates refund guidance reply.</Step>
            <Step num={4} title="Response"><code>{'{ "category": "billing", "reply": "I see the duplicate charge. Let me initiate a refund..." }'}</code></Step>
          </div>

          <h4>Example 2 — Technical support</h4>
          <p>Customer writes: <em>"My API keeps returning 504 timeout errors."</em></p>
          <div className="wiki-steps">
            <Step num={1} title="Classifier">Agent returns <code>{'{ "category": "tech" }'}</code>.</Step>
            <Step num={2} title="if_elseif_else">Branch 2 matches: <code>input.category === "tech"</code> → true.</Step>
            <Step num={3} title="Tech agent">System: "You are a tech-support engineer." → Provides timeout debugging steps.</Step>
            <Step num={4} title="Response"><code>{'{ "category": "tech", "reply": "504 errors typically indicate upstream timeout. Try: 1) Increase timeout to 60s, 2) Check server logs..." }'}</code></Step>
          </div>

          <h4>Example 3 — Sales inquiry</h4>
          <p>Customer writes: <em>"What's the difference between Pro and Enterprise plans?"</em></p>
          <div className="wiki-steps">
            <Step num={1} title="Classifier">Agent returns <code>{'{ "category": "sales" }'}</code>.</Step>
            <Step num={2} title="if_elseif_else">Branch 3 matches: <code>input.category === "sales"</code> → true.</Step>
            <Step num={3} title="Sales agent">System: "You are a friendly sales consultant." → Compares plans with pricing.</Step>
            <Step num={4} title="Response"><code>{'{ "category": "sales", "reply": "Great question! Pro includes 10k API calls/month at $49. Enterprise adds SSO, SLA, and unlimited calls at $199..." }'}</code></Step>
          </div>
        </div>

        <div className="wiki-divider" />

        {/* ═══ Appendix ═══ */}
        <div className="wiki-section" id="part4">
          <h2>Appendix</h2>

          <h3 id="a-keys">4.1 Keyboard shortcuts</h3>
          <h4>Canvas</h4>
          <table>
            <thead><tr><th>Key</th><th>Action</th></tr></thead>
            <tbody>
              <tr><td><code>Delete</code> / <code>Backspace</code></td><td>Delete selected node</td></tr>
              <tr><td><code>⌘ D</code></td><td>Duplicate selected node</td></tr>
              <tr><td><code>F2</code> / <code>Enter</code></td><td>Rename selected node</td></tr>
              <tr><td><code>Esc</code></td><td>Deselect / cancel rename</td></tr>
              <tr><td><code>↑ ↓ ← →</code></td><td>Nudge by 10 px</td></tr>
              <tr><td><code>Shift + Arrow</code></td><td>Nudge by 50 px</td></tr>
              <tr><td>Double-click</td><td>Inline rename</td></tr>
              <tr><td>Right-click</td><td>Context menu</td></tr>
            </tbody>
          </table>
          <h4>Workspace</h4>
          <table>
            <thead><tr><th>Key</th><th>Action</th></tr></thead>
            <tbody>
              <tr><td><code>⌘ .</code></td><td>Toggle inspector</td></tr>
              <tr><td><code>⌘ ,</code></td><td>Open Settings</td></tr>
              <tr><td><code>?</code></td><td>Shortcuts cheat-sheet</td></tr>
            </tbody>
          </table>

          <h3 id="a-layout">4.2 File layout</h3>
          <Code>{`ck8t/
├── AgentBuilderPage.jsx      // top-level layout
├── ck8t.css
├── blocks/
│   ├── registry.js           // getBlock(), registerBlock()
│   ├── types.js              // SubBlockType enum
│   ├── blocks/
│   │   ├── index.js          // barrel export
│   │   └── <name>.js         // one file per block
├── canvas/                   // React Flow + renderers
├── components/               // icons, CodeEditor, JsonEditor
├── docs/                     // block-docs-entries.js
├── extensions/               // drop-in user blocks (Vite glob)
├── mcp/                      // MCP client + store
├── panel/                    // Inspector, SubBlockRenderer
├── run/                      // RunModal, graph-runner.js
├── sidenav/                  // SideNav, BlockPalette
├── stores/                   // zustand stores
└── tabs/                     // CenterPane, editors`}</Code>

          <h3 id="a-custom">4.3 Writing a custom block</h3>
          <p>Two steps: write a <code>BlockConfig</code> and drop it into <code>extensions/</code>.</p>
          <Code>{`// extensions/slugify.js
export const SlugifyBlock = {
  type: 'slugify',
  name: 'Slugify',
  description: 'Normalise string to URL slug',
  category: 'blocks',
  bgColor: '#64748b',
  icon: VariableIcon,
  subBlocks: [
    { id: 'lowercase', title: 'Lower-case', type: 'switch', defaultValue: true },
    { id: 'separator', title: 'Separator', type: 'short-input', defaultValue: '-' }
  ],
  tools: { access: [] },
  inputs:  { input: { type: 'string', description: 'Raw text' } },
  outputs: { result: { type: 'string', description: 'URL slug' } }
}
export default SlugifyBlock`}</Code>
          <Tip type="info">For branching blocks, add <code>outputHandles</code> or <code>outputHandlesFromValues(values)</code> to dynamically generate source handles.</Tip>
          <Tip type="warn">Core blocks can't be overwritten by extensions. Pick a unique <code>type</code> id.</Tip>

          <h3 id="a-trouble">4.4 Troubleshooting</h3>
          <table>
            <thead><tr><th>Symptom</th><th>Cause & Fix</th></tr></thead>
            <tbody>
              <tr><td>"No content provided to summarize"</td><td>Template var didn't resolve. Check <code>meta.userPrompt</code> in Debug panel for literal <code>{'{{foo}}'}</code>.</td></tr>
              <tr><td>"MCP block: arguments is not valid JSON"</td><td>Raw quotes in <code>{'{{input}}'}</code>. Wrap: <code>{'{"query": "{{input}}"}'}</code>.</td></tr>
              <tr><td>Node stays "active" forever</td><td>Upstream branch didn't pick live edge. Check Trace for <code>chosenHandle</code>.</td></tr>
              <tr><td>"TypeError: fn is not a function"</td><td>Function block code isn't expression. Wrap with <code>return …</code>.</td></tr>
              <tr><td>Skill output ignored</td><td>Field is <code>values.skills</code>, not <code>values.tools</code>.</td></tr>
              <tr><td>Response Format ignored</td><td>Both <code>responseFormat</code> and <code>strictOutput</code> must be set.</td></tr>
              <tr><td>CORS errors on URL extractor</td><td>Use API block (server-side) instead of client-side fetch.</td></tr>
              <tr><td>Nothing runs — no trace</td><td>No starter/user_input exists. Every workflow needs at least one seed node.</td></tr>
              <tr><td>"Extension tried to overwrite core block"</td><td>Collision on <code>type</code> id. Pick a different one.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export const BookIcon = (p) => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...p}
  >
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    <line x1="8" y1="7" x2="16" y2="7" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
)
