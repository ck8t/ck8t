/**
 * Getting Started — 45 demo workflows covering every core block.
 *
 * Each workflow targets a single block concept so users can open it,
 * read the wiring, hit Run, and see a real result (most use free public
 * APIs so they run without credentials).
 *
 * Blocks that require credentials (Slack, SMTP, Redis, PostgreSQL, MongoDB)
 * have placeholder values — update them in the workflow inspector before running.
 */

export const GETTING_STARTED_FOLDER_ID = 'folder_getting_started'

const Y = 200
const DX = 340

const BG = {
  starter: '#2FB67C',       user_input: '#FBBF24',   agent: '#6F3DFA',
  api: '#3B82F6',           text_template: '#F59E0B', function: '#FF402F',
  if_else: '#F59E0B',       switch: '#0EA5E9',        condition: '#FF752F',
  for_each: '#6366F1',      for_loop: '#6366F1',      loop: '#6366F1',
  filter: '#8B5CF6',        sort: '#8B5CF6',           aggregate: '#EC4899',
  parallel: '#6E7FFF',      merge: '#6366F1',          mapper: '#14b8a6',
  json_path: '#6366F1',     json_map: '#6366F1',
  show_preview: '#14B8A6',  save_to_files: '#059669',
  image_url_preview: '#EC4899', image_url_to_base64: '#EC4899',
  delay: '#F59E0B',         wait: '#6B7280',           variables: '#F59E0B',
  crypto: '#0EA5E9',        ai_classifier: '#A855F7',
  chain_of_thought: '#A855F7', router_v2: '#28C43F',
  webhook_request: '#3B82F6', http_response: '#3B82F6', response: '#3B82F6',
  error_handler: '#FF402F',
  slack: '#2563EB',         smtp: '#DC2626',
  redis: '#EF4444',         mongodb: '#16A34A',        postgresql: '#3B82F6',
  table: '#14B8A6',         skill: '#7c3aed',          mcp: '#7c3aed',
  sub_workflow: '#7c3aed',  schedule: '#2FB67C',
  master_agent: '#6F3DFA',  slave_agent: '#6F3DFA',
  if_elseif_else: '#F59E0B',
}

function n(id, blockType, title, col, row = 0, extra = {}) {
  return {
    id, type: 'builderBlock',
    data: { title, blockType, bgColor: BG[blockType] || '#6366F1', ...extra },
    position: { x: 100 + col * DX, y: Y + row * 220 },
  }
}

function e(src, srcH, tgt, tgtH) {
  return {
    id: `reactflow__edge-${src}${srcH}-${tgt}${tgtH}`,
    source: src, target: tgt, animated: true,
    sourceHandle: srcH, targetHandle: tgtH,
  }
}

const DEFAULT_META = {
  defaultTimeoutMs: 30000, maxRetries: 0, failFast: true, logLevel: 'info', tags: [],
}

function wf(id, name, description, nodes, edges, subBlockValues, extra = {}) {
  return {
    id,
    name,
    description: description || '',
    folderId: GETTING_STARTED_FOLDER_ID,
    teamIds: [],
    teamId: undefined,
    nodes,
    edges,
    subBlockValues,
    metadata: { ...DEFAULT_META, tags: ['getting-started'], ...(extra.metadata || {}) },
    createdAt: '2026-06-18T00:00:00.000Z',
    updatedAt: '2026-06-18T00:00:00.000Z',
  }
}

/* ────────────────────────────────────────────────────────────────
 * 01 — Hello World (user_input + text_template)
 * ──────────────────────────────────────────────────────────────── */
const W01 = wf(
  'wf_gs_01_hello',
  '01 · Hello World — Text Template',
  'Enter your name → wrap it in a JSON object → build a greeting using {{name}} in a text template.',
  [
    n('g1_s',  'starter',       'Start',    0),
    n('g1_i',  'user_input',    'Your Name', 1),
    n('g1_fn', 'function',      'Wrap',     2),
    n('g1_t',  'text_template', 'Greeting', 3),
    n('g1_p',  'show_preview',  'Preview',  4),
  ],
  [
    e('g1_s',  'out',    'g1_i',  'in'),
    e('g1_i',  'value',  'g1_fn', 'in_input'),
    e('g1_fn', 'result', 'g1_t',  'in_input'),
    e('g1_t',  'result', 'g1_p',  'in_input'),
  ],
  {
    g1_s:  { startWorkflow: 'manual' },
    g1_i:  { kind: 'text', label: 'Your Name', placeholder: 'e.g. Alice', defaultValue: 'Alice', required: true },
    g1_fn: { language: 'javascript', code: 'return { name: input || "World" }' },
    g1_t:  { template: 'Hello, {{name}}! 👋\n\nWelcome to CK8T — the AI agent builder studio.\nThis is your first workflow. You can wire any block output into a Text Template and reference values using {{fieldName}} placeholders.' },
    g1_p:  { label: 'Greeting' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 02 — Fetch JSON API (api + json_path)
 * ──────────────────────────────────────────────────────────────── */
const W02 = wf(
  'wf_gs_02_fetch_json',
  '02 · Fetch JSON API — api + json_path',
  'Fetch a public REST API (JSONPlaceholder) and extract a field with JSON Path.',
  [
    n('g2_s', 'starter',    'Start',      0),
    n('g2_a', 'api',        'GET Todo',   1),
    n('g2_j', 'json_path',  'Extract',    2),
    n('g2_p', 'show_preview', 'Preview',  3),
  ],
  [
    e('g2_s', 'out',    'g2_a', 'in'),
    e('g2_a', 'data',   'g2_j', 'in_input'),
    e('g2_j', 'result', 'g2_p', 'in_input'),
  ],
  {
    g2_s: { startWorkflow: 'manual' },
    g2_a: { url: 'https://jsonplaceholder.typicode.com/todos/1', method: 'GET' },
    g2_j: { path: '$.title', fallback: '(no title)' },
    g2_p: { label: 'Todo title' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 03 — Ask an Agent (user_input + agent)
 * ──────────────────────────────────────────────────────────────── */
const W03 = wf(
  'wf_gs_03_ask_agent',
  '03 · Ask an Agent — user_input + agent',
  'Type any question and get a concise answer from an AI agent.',
  [
    n('g3_s', 'starter',     'Start',    0),
    n('g3_i', 'user_input',  'Question', 1),
    n('g3_a', 'agent',       'Answer',   2),
    n('g3_p', 'show_preview','Preview',  3),
  ],
  [
    e('g3_s', 'out',   'g3_i', 'in'),
    e('g3_i', 'value', 'g3_a', 'in_input'),
    e('g3_a', 'data',  'g3_p', 'in_input'),
  ],
  {
    g3_s: { startWorkflow: 'manual' },
    g3_i: { kind: 'text', label: 'Your question', placeholder: 'What is a neural network?', defaultValue: 'Explain quantum computing in 2 sentences.', required: true },
    g3_a: { model: 'gpt-4.1', systemPrompt: 'You are a concise, expert assistant. Answer in 2-3 sentences maximum. Be accurate and clear.', userPrompt: '{{input}}', temperature: 0.3 },
    g3_p: { label: 'Answer' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 04 — Run JavaScript (function)
 * ──────────────────────────────────────────────────────────────── */
const W04 = wf(
  'wf_gs_04_function',
  '04 · Run JavaScript — function block',
  'Execute custom JS code. Returns computed data you can wire downstream.',
  [
    n('g4_s', 'starter',     'Start',   0),
    n('g4_f', 'function',    'Compute', 1),
    n('g4_p', 'show_preview','Preview', 2),
  ],
  [
    e('g4_s', 'out',    'g4_f', 'in'),
    e('g4_f', 'result', 'g4_p', 'in_input'),
  ],
  {
    g4_s: { startWorkflow: 'manual' },
    g4_f: {
      language: 'javascript',
      code: `// Generate Fibonacci sequence up to N
const n = 10
const fib = [0, 1]
for (let i = 2; i < n; i++) fib.push(fib[i-1] + fib[i-2])
return {
  sequence: fib,
  sum: fib.reduce((a, b) => a + b, 0),
  description: \`First \${n} Fibonacci numbers\`
}`,
    },
    g4_p: { label: 'Fibonacci result' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 05 — Save to File (agent + save_to_files)
 * ──────────────────────────────────────────────────────────────── */
const W05 = wf(
  'wf_gs_05_save_file',
  '05 · Save to File — save_to_files block',
  'Ask an agent to write a haiku, then save the output to a text file.',
  [
    n('g5_s', 'starter',       'Start',     0),
    n('g5_i', 'user_input',    'Topic',     1),
    n('g5_a', 'agent',         'Haiku',     2),
    n('g5_sv','save_to_files', 'Save File', 3),
  ],
  [
    e('g5_s', 'out',   'g5_i',  'in'),
    e('g5_i', 'value', 'g5_a',  'in_input'),
    e('g5_a', 'data',  'g5_sv', 'in_input'),
  ],
  {
    g5_s: { startWorkflow: 'manual' },
    g5_i: { kind: 'text', label: 'Haiku topic', placeholder: 'e.g. morning coffee', defaultValue: 'morning coffee', required: true },
    g5_a: {
      model: 'gpt-4.1',
      systemPrompt: 'You are a haiku poet. Write exactly one haiku (5-7-5 syllables). No explanation, just the haiku.',
      userPrompt: 'Write a haiku about: {{input}}',
      temperature: 0.8,
    },
    g5_sv: { path: './output/haiku.txt', format: 'text', overwrite: true },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 06 — Template Builder (multi-field text_template)
 * ──────────────────────────────────────────────────────────────── */
const W06 = wf(
  'wf_gs_06_template',
  '06 · Template Builder — multi-field template',
  'Combine a function-generated JSON object with a text template using {{fieldName}} syntax.',
  [
    n('g6_s', 'starter',       'Start',    0),
    n('g6_f', 'function',      'User Data',1),
    n('g6_t', 'text_template', 'Format',   2),
    n('g6_p', 'show_preview',  'Preview',  3),
  ],
  [
    e('g6_s', 'out',    'g6_f', 'in'),
    e('g6_f', 'result', 'g6_t', 'in_input'),
    e('g6_t', 'result', 'g6_p', 'in_input'),
  ],
  {
    g6_s: { startWorkflow: 'manual' },
    g6_f: {
      language: 'javascript',
      code: `return {
  name: 'Alice',
  role: 'Senior Engineer',
  company: 'Acme Corp',
  years: 7,
  skills: ['React', 'Node.js', 'AWS']
}`,
    },
    g6_t: {
      template: `# Employee Profile

**Name:** {{name}}
**Role:** {{role}} at {{company}}
**Experience:** {{years}} years

**Skills:** {{skills}}`,
    },
    g6_p: { label: 'Formatted profile' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 07 — Add a Delay (delay)
 * ──────────────────────────────────────────────────────────────── */
const W07 = wf(
  'wf_gs_07_delay',
  '07 · Add a Delay — delay block',
  'Pause execution for 1.5 seconds, then show a timestamp. Useful for rate limiting.',
  [
    n('g7_s', 'starter',     'Start',   0),
    n('g7_d', 'delay',       '1.5s',    1),
    n('g7_f', 'function',    'Result',  2),
    n('g7_p', 'show_preview','Preview', 3),
  ],
  [
    e('g7_s', 'out',     'g7_d', 'in'),
    e('g7_d', 'elapsed', 'g7_f', 'in_input'),
    e('g7_f', 'result',  'g7_p', 'in_input'),
  ],
  {
    g7_s: { startWorkflow: 'manual' },
    g7_d: { duration: '1500', unit: 'ms' },
    g7_f: {
      language: 'javascript',
      code: `return {
  message: 'Resumed after delay!',
  elapsed_ms: input,
  timestamp: new Date().toISOString()
}`,
    },
    g7_p: { label: 'After delay' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 08 — Workflow Variables (variables + function)
 * ──────────────────────────────────────────────────────────────── */
const W08 = wf(
  'wf_gs_08_variables',
  '08 · Workflow Variables — variables block',
  'Define shared variables (API URL, thresholds) that any downstream block can read.',
  [
    n('g8_s', 'starter',     'Start',     0),
    n('g8_v', 'variables',   'Config',    1),
    n('g8_f', 'function',    'Read Vars', 2),
    n('g8_p', 'show_preview','Preview',   3),
  ],
  [
    e('g8_s', 'out',    'g8_v', 'in'),
    e('g8_v', 'out',    'g8_f', 'in_input'),
    e('g8_f', 'result', 'g8_p', 'in_input'),
  ],
  {
    g8_s: { startWorkflow: 'manual' },
    g8_v: {
      variables: [
        { name: 'API_BASE_URL', value: 'https://api.example.com', type: 'string' },
        { name: 'MAX_RETRIES', value: '3', type: 'number' },
        { name: 'DEBUG_MODE', value: 'false', type: 'boolean' },
      ],
    },
    g8_f: {
      language: 'javascript',
      code: `return {
  message: 'Variables are accessible in any block via <variables.variableName>',
  tip: 'Define API keys, base URLs, thresholds once — reuse everywhere'
}`,
    },
    g8_p: { label: 'Variables output' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 09 — Sentiment Analysis (agent)
 * ──────────────────────────────────────────────────────────────── */
const W09 = wf(
  'wf_gs_09_sentiment',
  '09 · Sentiment Analysis — agent with JSON output',
  'Analyze text sentiment. The agent returns structured JSON with score and label.',
  [
    n('g9_s', 'starter',     'Start',    0),
    n('g9_i', 'user_input',  'Text',     1),
    n('g9_a', 'agent',       'Analyze',  2),
    n('g9_p', 'show_preview','Preview',  3),
  ],
  [
    e('g9_s', 'out',   'g9_i', 'in'),
    e('g9_i', 'value', 'g9_a', 'in_input'),
    e('g9_a', 'data',  'g9_p', 'in_input'),
  ],
  {
    g9_s: { startWorkflow: 'manual' },
    g9_i: {
      kind: 'longtext', label: 'Text to analyze',
      defaultValue: 'I absolutely love the new features in this release. The UI is clean and the performance improvements are incredible!',
      required: true,
    },
    g9_a: {
      model: 'gpt-4.1',
      systemPrompt: 'You are a sentiment analysis expert. Respond ONLY with valid JSON.',
      userPrompt: 'Analyze the sentiment of this text:\n\n{{input}}\n\nReturn JSON: { "sentiment": "positive|negative|neutral", "score": 0.0-1.0, "confidence": 0.0-1.0, "key_phrases": [], "summary": "" }',
      temperature: 0.1,
      responseFormat: '{"type":"json_object"}',
    },
    g9_p: { label: 'Sentiment result' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 10 — URL Summarizer (api + agent)
 * ──────────────────────────────────────────────────────────────── */
const W10 = wf(
  'wf_gs_10_url_summarizer',
  '10 · URL Summarizer — api + agent pipeline',
  'Fetch a GitHub repo via API, then summarize it with an AI agent.',
  [
    n('ga_s',  'starter',     'Start',   0),
    n('ga_a',  'api',         'Fetch',   1),
    n('ga_ag', 'agent',       'Summary', 2),
    n('ga_p',  'show_preview','Preview', 3),
  ],
  [
    e('ga_s',  'out',  'ga_a',  'in'),
    e('ga_a',  'data', 'ga_ag', 'in_input'),
    e('ga_ag', 'data', 'ga_p',  'in_input'),
  ],
  {
    ga_s:  { startWorkflow: 'manual' },
    ga_a:  { url: 'https://api.github.com/repos/microsoft/typescript', method: 'GET' },
    ga_ag: {
      model: 'gpt-4.1',
      systemPrompt: 'You summarize GitHub repositories in exactly 3 bullet points.',
      userPrompt: 'Summarize this GitHub repo:\n\nName: {{full_name}}\nDescription: {{description}}\nStars: {{stargazers_count}}\nLanguage: {{language}}\nTopics: {{topics}}',
      temperature: 0.2,
    },
    ga_p:  { label: 'Repo summary' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 11 — Code Reviewer (agent)
 * ──────────────────────────────────────────────────────────────── */
const W11 = wf(
  'wf_gs_11_code_review',
  '11 · Code Reviewer — agent specialized prompt',
  'Paste JavaScript/Python code and get a structured code review.',
  [
    n('gb_s', 'starter',     'Start',  0),
    n('gb_i', 'user_input',  'Code',   1),
    n('gb_a', 'agent',       'Review', 2),
    n('gb_p', 'show_preview','Preview',3),
  ],
  [
    e('gb_s', 'out',   'gb_i', 'in'),
    e('gb_i', 'value', 'gb_a', 'in_input'),
    e('gb_a', 'data',  'gb_p', 'in_input'),
  ],
  {
    gb_s: { startWorkflow: 'manual' },
    gb_i: {
      kind: 'code', label: 'Code to review',
      defaultValue: `function getUserData(userId) {
  const user = db.query("SELECT * FROM users WHERE id = " + userId)
  return user
}`,
      required: true,
    },
    gb_a: {
      model: 'gpt-4.1',
      systemPrompt: 'You are a senior software engineer. Review code for: security (SQL injection, XSS), performance, readability, and best practices. Be specific and actionable.',
      userPrompt: 'Review this code:\n\n```\n{{input}}\n```\n\nProvide: 1) Issues found (with severity) 2) Refactored version 3) One-line summary',
      temperature: 0.2,
    },
    gb_p: { label: 'Code review' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 12 — Chain of Thought (chain_of_thought)
 * ──────────────────────────────────────────────────────────────── */
const W12 = wf(
  'wf_gs_12_cot',
  '12 · Chain of Thought — step-by-step reasoning',
  'Solve a problem step by step. Chain of Thought outputs reasoning steps + conclusion.',
  [
    n('gc_s',  'starter',          'Start',      0),
    n('gc_i',  'user_input',       'Problem',    1),
    n('gc_ct', 'chain_of_thought', 'Reason',     2),
    n('gc_p',  'show_preview',     'Conclusion', 3),
  ],
  [
    e('gc_s',  'out',        'gc_i',  'in'),
    e('gc_i',  'value',      'gc_ct', 'in_question'),
    e('gc_ct', 'conclusion', 'gc_p',  'in_input'),
  ],
  {
    gc_s:  { startWorkflow: 'manual' },
    gc_i:  {
      kind: 'text', label: 'Problem or question',
      defaultValue: 'If a train travels 60 mph and needs to cover 150 miles, how long will it take? Account for a 5-minute stop at the halfway point.',
      required: true,
    },
    gc_ct: { model: 'gpt-4.1', effort: 'medium' },
    gc_p:  { label: 'Conclusion' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 13 — AI JSON Extractor (agent → json structured output)
 * ──────────────────────────────────────────────────────────────── */
const W13 = wf(
  'wf_gs_13_json_extractor',
  '13 · AI JSON Extractor — structured agent output',
  'Extract structured data from unstructured text using an agent with JSON response format.',
  [
    n('gd_s', 'starter',     'Start',   0),
    n('gd_i', 'user_input',  'Text',    1),
    n('gd_a', 'agent',       'Extract', 2),
    n('gd_p', 'show_preview','Preview', 3),
  ],
  [
    e('gd_s', 'out',   'gd_i', 'in'),
    e('gd_i', 'value', 'gd_a', 'in_input'),
    e('gd_a', 'data',  'gd_p', 'in_input'),
  ],
  {
    gd_s: { startWorkflow: 'manual' },
    gd_i: {
      kind: 'longtext', label: 'Unstructured text',
      defaultValue: 'Alice Johnson is a 29-year-old software engineer based in San Francisco. She works at TechCorp and has been there for 3 years. Her email is alice@techcorp.com and phone is 415-555-0123.',
      required: true,
    },
    gd_a: {
      model: 'gpt-4.1',
      systemPrompt: 'You are a data extraction expert. Extract all entities from text into structured JSON.',
      userPrompt: 'Extract person details from this text:\n\n{{input}}\n\nReturn JSON: { "name": "", "age": 0, "email": "", "phone": "", "company": "", "location": "", "role": "", "tenure_years": 0 }',
      temperature: 0.1,
      responseFormat: '{"type":"json_object"}',
    },
    gd_p: { label: 'Extracted data' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 14 — Translate Text (agent)
 * ──────────────────────────────────────────────────────────────── */
const W14 = wf(
  'wf_gs_14_translate',
  '14 · Translate Text — multi-language agent',
  'Translate any text to French, Spanish, and Japanese simultaneously using an agent.',
  [
    n('ge_s', 'starter',     'Start',    0),
    n('ge_i', 'user_input',  'Text',     1),
    n('ge_a', 'agent',       'Translate',2),
    n('ge_p', 'show_preview','Preview',  3),
  ],
  [
    e('ge_s', 'out',   'ge_i', 'in'),
    e('ge_i', 'value', 'ge_a', 'in_input'),
    e('ge_a', 'data',  'ge_p', 'in_input'),
  ],
  {
    ge_s: { startWorkflow: 'manual' },
    ge_i: {
      kind: 'text', label: 'Text to translate',
      defaultValue: 'The quick brown fox jumps over the lazy dog.',
      required: true,
    },
    ge_a: {
      model: 'gpt-4.1',
      systemPrompt: 'You are a professional translator. Translate accurately, preserving tone and idioms.',
      userPrompt: 'Translate this text to French, Spanish, and Japanese:\n\n"{{input}}"\n\nReturn JSON: { "original": "", "french": "", "spanish": "", "japanese": "" }',
      temperature: 0.1,
      responseFormat: '{"type":"json_object"}',
    },
    ge_p: { label: 'Translations' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 15 — If / Else Branch (function → if_else)
 * ──────────────────────────────────────────────────────────────── */
const W15 = wf(
  'wf_gs_15_if_else',
  '15 · If / Else — boolean branch',
  'Enter a number — if ≥ 18 it goes to the "adult" branch, otherwise "minor" branch.',
  [
    n('gf_s',  'starter',     'Start',  0),
    n('gf_i',  'user_input',  'Age',    1),
    n('gf_fn', 'function',    'Parse',  2),
    n('gf_ie', 'if_else',     'Is Adult?', 3),
    n('gf_t',  'show_preview','Adult',  4, -0.4),
    n('gf_f',  'show_preview','Minor',  4,  0.4),
  ],
  [
    e('gf_s',  'out',    'gf_i',  'in'),
    e('gf_i',  'value',  'gf_fn', 'in_input'),
    e('gf_fn', 'result', 'gf_ie', 'in_input'),
    e('gf_ie', 'true',   'gf_t',  'in_input'),
    e('gf_ie', 'false',  'gf_f',  'in_input'),
  ],
  {
    gf_s:  { startWorkflow: 'manual' },
    gf_i:  { kind: 'number', label: 'Age', defaultValue: '20', required: true },
    gf_fn: {
      language: 'javascript',
      code: 'return { age: Number(input), category: Number(input) >= 18 ? "adult" : "minor" }',
    },
    gf_ie: { expression: 'input.age >= 18' },
    gf_t:  { label: '✅ Adult path (age ≥ 18)' },
    gf_f:  { label: '🚫 Minor path (age < 18)' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 16 — Switch Router (switch)
 * ──────────────────────────────────────────────────────────────── */
const W16 = wf(
  'wf_gs_16_switch',
  '16 · Switch — route by category',
  'Enter a support ticket type (bug / feature / billing) and route to different handlers.',
  [
    n('gg_s',  'starter',       'Start',    0),
    n('gg_i',  'user_input',    'Type',     1),
    n('gg_fn', 'function',      'Wrap',     2),
    n('gg_sw', 'switch',        'Route',    3),
    n('gg_c1', 'text_template', 'Bug',      4, -0.5),
    n('gg_c2', 'text_template', 'Feature',  4,  0),
    n('gg_c3', 'text_template', 'Billing',  4,  0.5),
  ],
  [
    e('gg_s',  'out',    'gg_i',  'in'),
    e('gg_i',  'value',  'gg_fn', 'in_input'),
    e('gg_fn', 'result', 'gg_sw', 'in_input'),
    e('gg_sw', 'case_1', 'gg_c1', 'in_input'),
    e('gg_sw', 'case_2', 'gg_c2', 'in_input'),
    e('gg_sw', 'case_3', 'gg_c3', 'in_input'),
  ],
  {
    gg_s:  { startWorkflow: 'manual' },
    gg_i:  { kind: 'dropdown', label: 'Ticket type', options: 'bug,feature,billing', defaultValue: 'bug', required: true },
    gg_fn: { language: 'javascript', code: 'return { category: input }' },
    gg_sw: {
      keyExpr: 'input.category',
      caseCount: 3,
      cases: [
        { value: 'bug',     label: 'Bug Report' },
        { value: 'feature', label: 'Feature Request' },
        { value: 'billing', label: 'Billing Inquiry' },
      ],
    },
    gg_c1: { template: '🐛 Bug Report routed to Engineering team.\nPriority: High\nSLA: 24 hours' },
    gg_c2: { template: '💡 Feature Request routed to Product team.\nStatus: In backlog review\nSLA: 5 business days' },
    gg_c3: { template: '💳 Billing Inquiry routed to Finance team.\nPriority: Urgent\nSLA: 4 hours' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 17 — AI Classifier (ai_classifier)
 * ──────────────────────────────────────────────────────────────── */
const W17 = wf(
  'wf_gs_17_classifier',
  '17 · AI Classifier — category + confidence',
  'Classify any text into predefined categories using the ai_classifier block.',
  [
    n('gh_s', 'starter',       'Start',     0),
    n('gh_i', 'user_input',    'Text',      1),
    n('gh_c', 'ai_classifier', 'Classify',  2),
    n('gh_p', 'show_preview',  'Preview',   3),
  ],
  [
    e('gh_s', 'out',      'gh_i', 'in'),
    e('gh_i', 'value',    'gh_c', 'in_text'),
    e('gh_c', 'category', 'gh_p', 'in_input'),
  ],
  {
    gh_s: { startWorkflow: 'manual' },
    gh_i: {
      kind: 'text', label: 'Text to classify',
      defaultValue: 'My account was charged twice this month and I need a refund immediately.',
      required: true,
    },
    gh_c: {
      model: 'gpt-4.1',
      categories: 'billing, technical_support, account_management, general_inquiry, complaint',
      instructions: 'Classify the customer message into the most appropriate support category.',
    },
    gh_p: { label: 'Category' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 18 — Error Handler (api + error_handler)
 * ──────────────────────────────────────────────────────────────── */
const W18 = wf(
  'wf_gs_18_error_handler',
  '18 · Error Handler — graceful fallback',
  'Call an API that may fail. error_handler catches errors and returns a fallback value.',
  [
    n('gi_s',  'starter',       'Start',   0),
    n('gi_i',  'user_input',    'URL',     1),
    n('gi_a',  'api',           'Fetch',   2),
    n('gi_eh', 'error_handler', 'Handle',  3),
    n('gi_p',  'show_preview',  'Preview', 4),
  ],
  [
    e('gi_s',  'out',    'gi_i',  'in'),
    e('gi_i',  'value',  'gi_a',  'in_input'),
    e('gi_a',  'data',   'gi_eh', 'in_input'),
    e('gi_eh', 'result', 'gi_p',  'in_input'),
  ],
  {
    gi_s:  { startWorkflow: 'manual' },
    gi_i:  { kind: 'text', label: 'API URL (try a bad URL to test error handling)', defaultValue: 'https://jsonplaceholder.typicode.com/todos/1', required: true },
    gi_a:  { url: '{{input}}', method: 'GET' },
    gi_eh: { strategy: 'fallback', fallbackValue: '{"error": "Request failed", "data": null, "recovered": true}', maxRetries: 2, retryDelay: 500, logErrors: true },
    gi_p:  { label: 'Result or fallback' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 19 — If-Elseif-Else (if_elseif_else)
 * ──────────────────────────────────────────────────────────────── */
const W19 = wf(
  'wf_gs_19_if_elseif',
  '19 · If-Elseif-Else — multi-branch logic',
  'Grade a score: A (≥90), B (≥80), C (≥70), or F. Demonstrates the if_elseif_else block.',
  [
    n('gj_s',   'starter',         'Start',   0),
    n('gj_i',   'user_input',      'Score',   1),
    n('gj_fn',  'function',        'Parse',   2),
    n('gj_iee', 'if_elseif_else',  'Grade',   3),
    n('gj_a',   'show_preview',    'A',       4, -0.6),
    n('gj_b',   'show_preview',    'B',       4, -0.2),
    n('gj_c',   'show_preview',    'C',       4,  0.2),
    n('gj_f',   'show_preview',    'F',       4,  0.6),
  ],
  [
    e('gj_s',   'out',      'gj_i',   'in'),
    e('gj_i',   'value',    'gj_fn',  'in_input'),
    e('gj_fn',  'result',   'gj_iee', 'in_input'),
    e('gj_iee', 'branch_1', 'gj_a',   'in_input'),
    e('gj_iee', 'branch_2', 'gj_b',   'in_input'),
    e('gj_iee', 'branch_3', 'gj_c',   'in_input'),
    e('gj_iee', 'else',     'gj_f',   'in_input'),
  ],
  {
    gj_s:   { startWorkflow: 'manual' },
    gj_i:   { kind: 'number', label: 'Test score (0-100)', defaultValue: '85', required: true },
    gj_fn:  { language: 'javascript', code: 'return { score: Number(input) }' },
    gj_iee: {
      branches: [
        { expression: 'input.score >= 90', label: 'A' },
        { expression: 'input.score >= 80', label: 'B' },
        { expression: 'input.score >= 70', label: 'C' },
      ],
    },
    gj_a:   { label: '🅰️ Grade A — Excellent (≥90)' },
    gj_b:   { label: '🅱️ Grade B — Good (80-89)' },
    gj_c:   { label: '🅲 Grade C — Average (70-79)' },
    gj_f:   { label: '❌ Grade F — Failing (<70)' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 20 — Filter Array (function → filter)
 * ──────────────────────────────────────────────────────────────── */
const W20 = wf(
  'wf_gs_20_filter',
  '20 · Filter Array — keep matching items',
  'Generate a list of products, then filter to keep only items with rating ≥ 4.',
  [
    n('gk_s',  'starter',     'Start',    0),
    n('gk_fn', 'function',    'Products', 1),
    n('gk_fi', 'filter',      'Filter',   2),
    n('gk_p',  'show_preview','Preview',  3),
  ],
  [
    e('gk_s',  'out',    'gk_fn', 'in'),
    e('gk_fn', 'result', 'gk_fi', 'in_items'),
    e('gk_fi', 'kept',   'gk_p',  'in_input'),
  ],
  {
    gk_s:  { startWorkflow: 'manual' },
    gk_fn: {
      language: 'javascript',
      code: `return [
  { name: 'Widget A', price: 29.99, rating: 4.5, inStock: true },
  { name: 'Widget B', price: 9.99,  rating: 2.1, inStock: true },
  { name: 'Widget C', price: 49.99, rating: 4.8, inStock: false },
  { name: 'Widget D', price: 14.99, rating: 3.9, inStock: true },
  { name: 'Widget E', price: 89.99, rating: 4.2, inStock: true },
]`,
    },
    gk_fi: {
      conditions: [{ field: 'rating', operator: '>=', value: '4' }],
      mode: 'keep',
    },
    gk_p:  { label: 'Filtered products (rating ≥ 4)' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 21 — Sort Array (function → sort)
 * ──────────────────────────────────────────────────────────────── */
const W21 = wf(
  'wf_gs_21_sort',
  '21 · Sort Array — order by field',
  'Sort a list of employees by salary descending.',
  [
    n('gl_s',  'starter',     'Start',     0),
    n('gl_fn', 'function',    'Employees', 1),
    n('gl_so', 'sort',        'Sort',      2),
    n('gl_p',  'show_preview','Preview',   3),
  ],
  [
    e('gl_s',  'out',    'gl_fn', 'in'),
    e('gl_fn', 'result', 'gl_so', 'in_items'),
    e('gl_so', 'sorted', 'gl_p',  'in_input'),
  ],
  {
    gl_s:  { startWorkflow: 'manual' },
    gl_fn: {
      language: 'javascript',
      code: `return [
  { name: 'Alice',  dept: 'Engineering', salary: 120000 },
  { name: 'Bob',    dept: 'Design',      salary: 95000 },
  { name: 'Carol',  dept: 'Engineering', salary: 135000 },
  { name: 'David',  dept: 'Marketing',   salary: 85000 },
  { name: 'Eve',    dept: 'Engineering', salary: 110000 },
]`,
    },
    gl_so: { sortKey: 'salary', order: 'desc', type: 'number' },
    gl_p:  { label: 'Sorted by salary' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 22 — Aggregate Data (function → aggregate)
 * ──────────────────────────────────────────────────────────────── */
const W22 = wf(
  'wf_gs_22_aggregate',
  '22 · Aggregate Data — sum / avg / count',
  'Sum total sales and average order value from a list of orders.',
  [
    n('gm_s',  'starter',     'Start',    0),
    n('gm_fn', 'function',    'Orders',   1),
    n('gm_ag', 'aggregate',   'Sum',      2),
    n('gm_p',  'show_preview','Preview',  3),
  ],
  [
    e('gm_s',  'out',    'gm_fn', 'in'),
    e('gm_fn', 'result', 'gm_ag', 'in_items'),
    e('gm_ag', 'result', 'gm_p',  'in_input'),
  ],
  {
    gm_s:  { startWorkflow: 'manual' },
    gm_fn: {
      language: 'javascript',
      code: `return [
  { id: 'ORD-001', amount: 249.99, product: 'Laptop Stand' },
  { id: 'ORD-002', amount: 49.99,  product: 'USB Hub' },
  { id: 'ORD-003', amount: 899.99, product: 'Monitor' },
  { id: 'ORD-004', amount: 129.99, product: 'Keyboard' },
  { id: 'ORD-005', amount: 79.99,  product: 'Mouse' },
]`,
    },
    gm_ag: { operation: 'sum', field: 'amount' },
    gm_p:  { label: 'Total sales' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 23 — For Each Loop (function → for_each)
 * ──────────────────────────────────────────────────────────────── */
const W23 = wf(
  'wf_gs_23_for_each',
  '23 · For Each Loop — iterate an array',
  'Run an agent for each item in a list (generates greeting for each team member).',
  [
    n('gn_s',  'starter',     'Start',  0),
    n('gn_fn', 'function',    'Names',  1),
    n('gn_fe', 'for_each',    'Loop',   2),
    n('gn_p',  'show_preview','Preview',3),
  ],
  [
    e('gn_s',  'out',        'gn_fn', 'in'),
    e('gn_fn', 'result',     'gn_fe', 'in_input'),
    e('gn_fe', 'iterations', 'gn_p',  'in_input'),
  ],
  {
    gn_s:  { startWorkflow: 'manual' },
    gn_fn: {
      language: 'javascript',
      code: 'return ["Alice", "Bob", "Carol", "David"]',
    },
    gn_fe: { collection: 'input', itemVar: 'item', maxConcurrency: 2 },
    gn_p:  { label: 'All iterations' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 24 — For Loop Counter (for_loop)
 * ──────────────────────────────────────────────────────────────── */
const W24 = wf(
  'wf_gs_24_for_loop',
  '24 · For Loop — count N iterations',
  'Run a loop exactly 5 times, generating a timestamp for each iteration.',
  [
    n('go_s',  'starter',     'Start',   0),
    n('go_fl', 'for_loop',    'Loop x5', 1),
    n('go_p',  'show_preview','Preview', 2),
  ],
  [
    e('go_s',  'out',        'go_fl', 'in'),
    e('go_fl', 'iterations', 'go_p',  'in_input'),
  ],
  {
    go_s:  { startWorkflow: 'manual' },
    go_fl: { count: '5', indexVar: 'i', maxConcurrency: 1 },
    go_p:  { label: 'Loop iterations' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 25 — JSON Path Query (json_path)
 * ──────────────────────────────────────────────────────────────── */
const W25 = wf(
  'wf_gs_25_json_path',
  '25 · JSON Path Query — extract nested values',
  'Fetch a GitHub repo and extract specific nested fields using JSONPath expressions.',
  [
    n('gp_s',  'starter',     'Start',   0),
    n('gp_a',  'api',         'Fetch',   1),
    n('gp_jp', 'json_path',   'Extract', 2),
    n('gp_pv', 'show_preview','Preview', 3),
  ],
  [
    e('gp_s',  'out',    'gp_a',  'in'),
    e('gp_a',  'data',   'gp_jp', 'in_input'),
    e('gp_jp', 'result', 'gp_pv', 'in_input'),
  ],
  {
    gp_s:  { startWorkflow: 'manual' },
    gp_a:  { url: 'https://api.github.com/repos/facebook/react', method: 'GET' },
    gp_jp: { path: '$.stargazers_count', fallback: '0' },
    gp_pv: { label: 'React GitHub stars' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 26 — JSON Map Transform (json_map)
 * ──────────────────────────────────────────────────────────────── */
const W26 = wf(
  'wf_gs_26_json_map',
  '26 · JSON Map — reshape data structure',
  'Map an API response to a clean internal shape using field mapping pairs.',
  [
    n('gq_s',  'starter',     'Start',   0),
    n('gq_a',  'api',         'Fetch',   1),
    n('gq_jm', 'json_map',    'Reshape', 2),
    n('gq_p',  'show_preview','Preview', 3),
  ],
  [
    e('gq_s',  'out',    'gq_a',  'in'),
    e('gq_a',  'data',   'gq_jm', 'in_input'),
    e('gq_jm', 'result', 'gq_p',  'in_input'),
  ],
  {
    gq_s:  { startWorkflow: 'manual' },
    gq_a:  { url: 'https://jsonplaceholder.typicode.com/users/1', method: 'GET' },
    gq_jm: {
      mappings: [
        { key: 'full_name',      path: 'name' },
        { key: 'contact_email',  path: 'email' },
        { key: 'handle',         path: 'username' },
        { key: 'phone_number',   path: 'phone' },
      ],
    },
    gq_p:  { label: 'Remapped user' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 27 — Mapper Block (json→string and back)
 * ──────────────────────────────────────────────────────────────── */
const W27 = wf(
  'wf_gs_27_mapper',
  '27 · Mapper — convert between types',
  'Stringify a JSON object to a string, then parse it back. Useful for bridging blocks.',
  [
    n('gr_s',  'starter',     'Start',     0),
    n('gr_fn', 'function',    'JSON Data', 1),
    n('gr_ms', 'mapper',      'Stringify', 2),
    n('gr_mp', 'mapper',      'Parse',     3),
    n('gr_p',  'show_preview','Preview',   4),
  ],
  [
    e('gr_s',  'out',    'gr_fn', 'in'),
    e('gr_fn', 'result', 'gr_ms', 'in_input'),
    e('gr_ms', 'result', 'gr_mp', 'in_input'),
    e('gr_mp', 'result', 'gr_p',  'in_input'),
  ],
  {
    gr_s:  { startWorkflow: 'manual' },
    gr_fn: {
      language: 'javascript',
      code: 'return { workflow: "CK8T Demo", version: "1.0", blocks: 45, ready: true }',
    },
    gr_ms: { mode: 'json_stringify' },
    gr_mp: { mode: 'json_parse' },
    gr_p:  { label: 'Round-trip result' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 28 — Merge Two Sources (merge)
 * ──────────────────────────────────────────────────────────────── */
const W28 = wf(
  'wf_gs_28_merge',
  '28 · Merge — combine two data sources',
  'Fetch user and post data from two API endpoints, merge into one object.',
  [
    n('gs_s',  'starter',     'Start',  0),
    n('gs_a1', 'api',         'User',   1, -0.4),
    n('gs_a2', 'api',         'Post',   1,  0.4),
    n('gs_mg', 'merge',       'Merge',  2),
    n('gs_p',  'show_preview','Preview',3),
  ],
  [
    e('gs_s',  'out',    'gs_a1', 'in'),
    e('gs_s',  'out',    'gs_a2', 'in'),
    e('gs_a1', 'data',   'gs_mg', 'in_input1'),
    e('gs_a2', 'data',   'gs_mg', 'in_input2'),
    e('gs_mg', 'merged', 'gs_p',  'in_input'),
  ],
  {
    gs_s:  { startWorkflow: 'manual' },
    gs_a1: { url: 'https://jsonplaceholder.typicode.com/users/1', method: 'GET' },
    gs_a2: { url: 'https://jsonplaceholder.typicode.com/posts/1', method: 'GET' },
    gs_mg: { mode: 'deep_merge' },
    gs_p:  { label: 'Merged result' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 29 — Crypto Hash (user_input → crypto)
 * ──────────────────────────────────────────────────────────────── */
const W29 = wf(
  'wf_gs_29_crypto',
  '29 · Crypto — SHA-256 hash and Base64',
  'Hash a string with SHA-256 and Base64-encode it. Useful for webhooks, auth.',
  [
    n('gt_s', 'starter',     'Start',   0),
    n('gt_i', 'user_input',  'Text',    1),
    n('gt_c', 'crypto',      'SHA-256', 2),
    n('gt_p', 'show_preview','Preview', 3),
  ],
  [
    e('gt_s', 'out',    'gt_i', 'in'),
    e('gt_i', 'value',  'gt_c', 'in_data'),
    e('gt_c', 'result', 'gt_p', 'in_input'),
  ],
  {
    gt_s: { startWorkflow: 'manual' },
    gt_i: { kind: 'text', label: 'Text to hash', defaultValue: 'Hello CK8T!', required: true },
    gt_c: { operation: 'sha256', data: '{{input}}' },
    gt_p: { label: 'SHA-256 hash' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 30 — REST GET Request (api)
 * ──────────────────────────────────────────────────────────────── */
const W30 = wf(
  'wf_gs_30_api_get',
  '30 · REST GET — fetch any URL',
  'Enter any public API URL and display the raw JSON response.',
  [
    n('gu_s', 'starter',     'Start',   0),
    n('gu_i', 'user_input',  'URL',     1),
    n('gu_a', 'api',         'GET',     2),
    n('gu_p', 'show_preview','Preview', 3),
  ],
  [
    e('gu_s', 'out',   'gu_i', 'in'),
    e('gu_i', 'value', 'gu_a', 'in_url'),
    e('gu_a', 'data',  'gu_p', 'in_input'),
  ],
  {
    gu_s: { startWorkflow: 'manual' },
    gu_i: { kind: 'url', label: 'API URL', defaultValue: 'https://api.open-meteo.com/v1/forecast?latitude=40.71&longitude=-74.01&current_weather=true', required: true },
    gu_a: { method: 'GET' },
    gu_p: { label: 'API response' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 31 — REST POST Request (api POST)
 * ──────────────────────────────────────────────────────────────── */
const W31 = wf(
  'wf_gs_31_api_post',
  '31 · REST POST — send JSON payload',
  'POST a JSON body to httpbin.org (echoes it back) to test the api POST block.',
  [
    n('gv_s', 'starter',     'Start',   0),
    n('gv_fn','function',    'Payload', 1),
    n('gv_a', 'api',         'POST',    2),
    n('gv_p', 'show_preview','Preview', 3),
  ],
  [
    e('gv_s', 'out',    'gv_fn', 'in'),
    e('gv_fn','result', 'gv_a',  'in_body'),
    e('gv_a', 'data',   'gv_p',  'in_input'),
  ],
  {
    gv_s:  { startWorkflow: 'manual' },
    gv_fn: {
      language: 'javascript',
      code: `return {
  message: 'Hello from CK8T!',
  timestamp: new Date().toISOString(),
  version: '1.0'
}`,
    },
    gv_a:  { url: 'https://httpbin.org/post', method: 'POST', headers: '{"Content-Type": "application/json"}' },
    gv_p:  { label: 'POST echo response' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 32 — Webhook Trigger → Respond (webhook_request + http_response)
 * ──────────────────────────────────────────────────────────────── */
const W32 = wf(
  'wf_gs_32_webhook',
  '32 · Webhook Trigger — receive and respond',
  'Workflow starts from an incoming HTTP webhook. Processes the body and responds.',
  [
    n('gw_wh', 'webhook_request', 'Receive', 0),
    n('gw_a',  'agent',           'Process', 1),
    n('gw_hr', 'http_response',   'Respond', 2),
  ],
  [
    e('gw_wh', 'body', 'gw_a',  'in_input'),
    e('gw_a',  'data', 'gw_hr', 'in_body'),
  ],
  {
    gw_wh: { method: 'POST' },
    gw_a: {
      model: 'gpt-4.1',
      systemPrompt: 'Process the incoming webhook payload and return a brief confirmation message in JSON.',
      userPrompt: 'Webhook payload: {{input}}\n\nReturn JSON: { "received": true, "processed": true, "summary": "" }',
      temperature: 0.1,
      responseFormat: '{"type":"json_object"}',
    },
    gw_hr: { statusCode: '200', contentType: 'application/json' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 33 — Image URL Preview (image_url_preview)
 * ──────────────────────────────────────────────────────────────── */
const W33 = wf(
  'wf_gs_33_image_preview',
  '33 · Image URL Preview — display from URL',
  'Fetch a random dog image URL and preview it inline using the image_url_preview block.',
  [
    n('gx_s',  'starter',           'Start',   0),
    n('gx_a',  'api',               'Fetch',   1),
    n('gx_jp', 'json_path',         'URL',     2),
    n('gx_ip', 'image_url_preview', 'Preview', 3),
  ],
  [
    e('gx_s',  'out',    'gx_a',  'in'),
    e('gx_a',  'data',   'gx_jp', 'in_input'),
    e('gx_jp', 'result', 'gx_ip', 'in_input'),
  ],
  {
    gx_s:  { startWorkflow: 'manual' },
    gx_a:  { url: 'https://dog.ceo/api/breeds/image/random', method: 'GET' },
    gx_jp: { path: '$.message', fallback: '' },
    gx_ip: {},
  },
)

/* ────────────────────────────────────────────────────────────────
 * 34 — Image to Base64 (image_url_to_base64)
 * ──────────────────────────────────────────────────────────────── */
const W34 = wf(
  'wf_gs_34_image_b64',
  '34 · Image to Base64 — convert URL to data URI',
  'Fetch an image URL and convert it to a base64 data URI using image_url_to_base64.',
  [
    n('gy_s',  'starter',               'Start',    0),
    n('gy_a',  'api',                   'Fetch URL',1),
    n('gy_jp', 'json_path',             'Get URL',  2),
    n('gy_b',  'image_url_to_base64',   'Convert',  3),
    n('gy_p',  'show_preview',          'Preview',  4),
  ],
  [
    e('gy_s',  'out',    'gy_a',  'in'),
    e('gy_a',  'data',   'gy_jp', 'in_input'),
    e('gy_jp', 'result', 'gy_b',  'in_input'),
    e('gy_b',  'dataUri','gy_p',  'in_input'),
  ],
  {
    gy_s:  { startWorkflow: 'manual' },
    gy_a:  { url: 'https://dog.ceo/api/breeds/image/random', method: 'GET' },
    gy_jp: { path: '$.message', fallback: '' },
    gy_b:  {},
    gy_p:  { label: 'Base64 data URI' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 35 — Wait Block (wait)
 * ──────────────────────────────────────────────────────────────── */
const W35 = wf(
  'wf_gs_35_wait',
  '35 · Wait — pause for a fixed duration',
  'Pause execution for 2 seconds (useful for polling, rate-limit recovery), then continue.',
  [
    n('gz_s',  'starter',     'Start',   0),
    n('gz_w',  'wait',        '2s Pause',1),
    n('gz_fn', 'function',    'Resume',  2),
    n('gz_p',  'show_preview','Preview', 3),
  ],
  [
    e('gz_s',  'out',      'gz_w',  'in'),
    e('gz_w',  'waitedMs', 'gz_fn', 'in_input'),
    e('gz_fn', 'result',   'gz_p',  'in_input'),
  ],
  {
    gz_s:  { startWorkflow: 'manual' },
    gz_w:  { mode: 'duration', duration: '2000' },
    gz_fn: {
      language: 'javascript',
      code: 'return { message: `Waited ${input}ms and resumed.`, timestamp: new Date().toISOString() }',
    },
    gz_p:  { label: 'After wait' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 36 — Schedule Trigger (schedule → agent)
 * ──────────────────────────────────────────────────────────────── */
const W36 = wf(
  'wf_gs_36_schedule',
  '36 · Schedule — trigger on a cron schedule',
  'Runs every day at 9 AM. Fetches a motivational quote and summarizes it.',
  [
    n('h0_sc', 'schedule',    'Daily 9AM', 0),
    n('h0_a',  'api',         'Quote',     1),
    n('h0_jp', 'json_path',   'Extract',   2),
    n('h0_ag', 'agent',       'Inspire',   3),
    n('h0_p',  'show_preview','Preview',   4),
  ],
  [
    e('h0_sc', 'firedAt', 'h0_a',  'in'),
    e('h0_a',  'data',    'h0_jp', 'in_input'),
    e('h0_jp', 'result',  'h0_ag', 'in_input'),
    e('h0_ag', 'data',    'h0_p',  'in_input'),
  ],
  {
    h0_sc: { cron: '0 9 * * *', timezone: 'America/New_York' },
    h0_a:  { url: 'https://api.quotable.io/random', method: 'GET' },
    h0_jp: { path: '$.content', fallback: 'Stay curious!' },
    h0_ag: {
      model: 'gpt-4.1',
      systemPrompt: 'You write brief daily affirmations based on quotes.',
      userPrompt: 'Today\'s quote: "{{input}}"\n\nWrite a 2-sentence morning affirmation inspired by this quote.',
      temperature: 0.7,
    },
    h0_p:  { label: 'Morning affirmation' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 37 — Slack Message (slack)
 * ──────────────────────────────────────────────────────────────── */
const W37 = wf(
  'wf_gs_37_slack',
  '37 · Slack — send a channel message',
  'Send a formatted message to a Slack channel. Update token and channel before running.',
  [
    n('h1_s',  'starter',     'Start',   0),
    n('h1_fn', 'function',    'Message', 1),
    n('h1_sl', 'slack',       'Send',    2),
  ],
  [
    e('h1_s',  'out',    'h1_fn', 'in'),
    e('h1_fn', 'result', 'h1_sl', 'in_text'),
  ],
  {
    h1_s:  { startWorkflow: 'manual' },
    h1_fn: {
      language: 'javascript',
      code: `return \`🤖 *CK8T Workflow Alert*\n\nWorkflow ran successfully at \${new Date().toLocaleString()}.\n\nStatus: ✅ Complete\``,
    },
    h1_sl: {
      token: 'xoxb-YOUR-SLACK-BOT-TOKEN',
      channel: '#general',
      operation: 'post_message',
    },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 38 — Send Email (smtp)
 * ──────────────────────────────────────────────────────────────── */
const W38 = wf(
  'wf_gs_38_email',
  '38 · SMTP — send an email',
  'Send a transactional email via SMTP. Update credentials before running.',
  [
    n('h2_s',  'starter',     'Start',   0),
    n('h2_fn', 'function',    'Body',    1),
    n('h2_sm', 'smtp',        'Send',    2),
  ],
  [
    e('h2_s',  'out',    'h2_fn', 'in'),
    e('h2_fn', 'result', 'h2_sm', 'in_body'),
  ],
  {
    h2_s:  { startWorkflow: 'manual' },
    h2_fn: {
      language: 'javascript',
      code: `return \`Hello,\n\nThis is an automated email from CK8T.\n\nWorkflow completed at \${new Date().toLocaleString()}.\n\nRegards,\nCK8T Agent\``,
    },
    h2_sm: {
      smtpHost: 'smtp.gmail.com',
      smtpPort: '587',
      smtpUsername: 'your@gmail.com',
      smtpPassword: 'YOUR_APP_PASSWORD',
      from: 'your@gmail.com',
      to: 'recipient@example.com',
      subject: 'CK8T Workflow Notification',
      contentType: 'text/plain',
    },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 39 — Redis Set/Get (redis)
 * ──────────────────────────────────────────────────────────────── */
const W39 = wf(
  'wf_gs_39_redis',
  '39 · Redis — cache a value',
  'Set a key in Redis, then GET it back. Update connection URL before running.',
  [
    n('h3_s',   'starter',     'Start',    0),
    n('h3_fn',  'function',    'Value',    1),
    n('h3_rset','redis',       'SET',      2),
    n('h3_rget','redis',       'GET',      3),
    n('h3_p',   'show_preview','Preview',  4),
  ],
  [
    e('h3_s',    'out',    'h3_fn',   'in'),
    e('h3_fn',   'result', 'h3_rset', 'in_value'),
    e('h3_rset', 'result', 'h3_rget', 'in'),
    e('h3_rget', 'result', 'h3_p',    'in_input'),
  ],
  {
    h3_s:    { startWorkflow: 'manual' },
    h3_fn:   { language: 'javascript', code: `return { data: 'ck8t_demo_' + Date.now(), timestamp: new Date().toISOString() }` },
    h3_rset: { connectionUrl: 'redis://localhost:6379', operation: 'set', key: 'ck8t:demo', ttl: '3600' },
    h3_rget: { connectionUrl: 'redis://localhost:6379', operation: 'get', key: 'ck8t:demo' },
    h3_p:    { label: 'Redis cached value' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 40 — PostgreSQL Query (postgresql)
 * ──────────────────────────────────────────────────────────────── */
const W40 = wf(
  'wf_gs_40_postgres',
  '40 · PostgreSQL — query a database',
  'Run a raw SQL SELECT query. Update host/credentials before running.',
  [
    n('h4_s',  'starter',     'Start',   0),
    n('h4_pg', 'postgresql',  'Query',   1),
    n('h4_p',  'show_preview','Preview', 2),
  ],
  [
    e('h4_s',  'out',  'h4_pg', 'in'),
    e('h4_pg', 'rows', 'h4_p',  'in_input'),
  ],
  {
    h4_s:  { startWorkflow: 'manual' },
    h4_pg: {
      operation: 'query',
      host: 'localhost',
      port: '5432',
      database: 'mydb',
      username: 'postgres',
      password: 'YOUR_PASSWORD',
      ssl: false,
      query: 'SELECT id, name, email FROM users ORDER BY created_at DESC LIMIT 10',
    },
    h4_p:  { label: 'Query results' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 41 — MongoDB Find (mongodb)
 * ──────────────────────────────────────────────────────────────── */
const W41 = wf(
  'wf_gs_41_mongodb',
  '41 · MongoDB — find documents',
  'Query a MongoDB collection. Update connection URL and collection before running.',
  [
    n('h5_s',  'starter',     'Start',   0),
    n('h5_mg', 'mongodb',     'Find',    1),
    n('h5_p',  'show_preview','Preview', 2),
  ],
  [
    e('h5_s',  'out',    'h5_mg', 'in'),
    e('h5_mg', 'result', 'h5_p',  'in_input'),
  ],
  {
    h5_s:  { startWorkflow: 'manual' },
    h5_mg: {
      connectionUrl: 'mongodb://localhost:27017/mydb',
      collection: 'users',
      operation: 'find',
      query: '{ "active": true }',
      limit: '10',
      sort: '{ "createdAt": -1 }',
    },
    h5_p:  { label: 'MongoDB documents' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 42 — Table Block (in-app structured data)
 * ──────────────────────────────────────────────────────────────── */
const W42 = wf(
  'wf_gs_42_table',
  '42 · Table — read structured in-app data',
  'Read rows from an in-app table. Create a table in your workspace first.',
  [
    n('h6_s', 'starter',     'Start',   0),
    n('h6_t', 'table',       'Read',    1),
    n('h6_p', 'show_preview','Preview', 2),
  ],
  [
    e('h6_s', 'out',  'h6_t', 'in'),
    e('h6_t', 'rows', 'h6_p', 'in_input'),
  ],
  {
    h6_s: { startWorkflow: 'manual' },
    h6_t: { operation: 'read', table: 'your_table_name' },
    h6_p: { label: 'Table rows' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 43 — Master-Slave Agents (orchestrated multi-agent)
 * ──────────────────────────────────────────────────────────────── */
const W43 = wf(
  'wf_gs_43_master_slave',
  '43 · Master-Slave Agents — orchestrated multi-agent',
  'A master agent plans and dispatches tasks to two specialized slave agents.',
  [
    n('h7_s',   'starter',      'Start',       0),
    n('h7_i',   'user_input',   'Goal',        1),
    n('h7_ma',  'master_agent', 'Master',      2),
    n('h7_s1',  'slave_agent',  'Researcher',  3, -0.4),
    n('h7_s2',  'slave_agent',  'Writer',      3,  0.4),
    n('h7_p',   'show_preview', 'Preview',     4),
  ],
  [
    e('h7_s',  'out',          'h7_i',  'in'),
    e('h7_i',  'value',        'h7_ma', 'in_question'),
    e('h7_ma', 'final_answer', 'h7_p',  'in_input'),
  ],
  {
    h7_s:  { startWorkflow: 'manual' },
    h7_i:  { kind: 'text', label: 'Research goal', defaultValue: 'Write a brief report on the benefits of TypeScript', required: true },
    h7_ma: {
      model: 'gpt-4.1',
      synthesisPrompt: 'Synthesize the slave agent outputs into a coherent, well-structured response.',
      maxRePlanRounds: 2,
      adaptiveRePlan: true,
    },
    h7_s1: {
      capabilityLabel: 'Researcher',
      systemPrompt: 'You are a research agent. Find and organize key facts about the given topic.',
      model: 'gpt-4.1',
    },
    h7_s2: {
      capabilityLabel: 'Writer',
      systemPrompt: 'You are a technical writer. Turn research facts into clear, readable prose.',
      model: 'gpt-4.1',
    },
    h7_p:  { label: 'Master agent result' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 44 — Parallel Execution (parallel)
 * ──────────────────────────────────────────────────────────────── */
const W44 = wf(
  'wf_gs_44_parallel',
  '44 · Parallel — run branches concurrently',
  'Fan out to two API calls at the same time, then merge results. Both APIs run in parallel — no server required.',
  [
    n('h8_s',  'starter',     'Start',   0),
    n('h8_a1', 'api',         'Weather', 1, -0.4),
    n('h8_a2', 'api',         'Fact',    1,  0.4),
    n('h8_mg', 'merge',       'Merge',   2),
    n('h8_p',  'show_preview','Preview', 3),
  ],
  [
    e('h8_s',  'out',    'h8_a1', 'in'),
    e('h8_s',  'out',    'h8_a2', 'in'),
    e('h8_a1', 'data',   'h8_mg', 'in_input1'),
    e('h8_a2', 'data',   'h8_mg', 'in_input2'),
    e('h8_mg', 'merged', 'h8_p',  'in_input'),
  ],
  {
    h8_s:  { startWorkflow: 'manual' },
    h8_a1: { url: 'https://api.open-meteo.com/v1/forecast?latitude=40.71&longitude=-74.01&current_weather=true', method: 'GET' },
    h8_a2: { url: 'https://numbersapi.com/42/trivia?json=true', method: 'GET' },
    h8_mg: { mode: 'deep_merge' },
    h8_p:  { label: 'Parallel results' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 45 — MCP Tool Call (mcp)
 * ──────────────────────────────────────────────────────────────── */
const W45 = wf(
  'wf_gs_45_mcp',
  '45 · MCP Tool Call — call an MCP server tool',
  'Call a tool from a connected MCP server. Add an MCP server in Settings → MCP first.',
  [
    n('h9_s',  'starter',     'Start',   0),
    n('h9_i',  'user_input',  'Input',   1),
    n('h9_m',  'mcp',         'MCP Call',2),
    n('h9_p',  'show_preview','Preview', 3),
  ],
  [
    e('h9_s', 'out',     'h9_i', 'in'),
    e('h9_i', 'value',   'h9_m', 'in_input'),
    e('h9_m', 'content', 'h9_p', 'in_input'),
  ],
  {
    h9_s: { startWorkflow: 'manual' },
    h9_i: { kind: 'text', label: 'Tool input', placeholder: 'Input for the MCP tool', defaultValue: 'test input', required: true },
    h9_m: {
      server: 'your-mcp-server-name',
      tool: 'your-tool-name',
    },
    h9_p: { label: 'MCP tool result' },
  },
)

export const GETTING_STARTED_WORKFLOWS = [
  W01, W02, W03, W04, W05, W06, W07, W08, W09, W10,
  W11, W12, W13, W14, W15, W16, W17, W18, W19, W20,
  W21, W22, W23, W24, W25, W26, W27, W28, W29, W30,
  W31, W32, W33, W34, W35, W36, W37, W38, W39, W40,
  W41, W42, W43, W44, W45,
]

/** IDs of all getting-started workflows (for restore / re-seed). */
export const GETTING_STARTED_IDS = new Set(GETTING_STARTED_WORKFLOWS.map(w => w.id))
