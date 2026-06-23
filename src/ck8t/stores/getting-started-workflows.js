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

/* ════════════════════════════════════════════════════════════════
 * Community Block Workflows (W46-W65)
 * Tests story_splitter (browser / client.js path) and storybook_pdf
 * (extension-host / extension.js path via fetch delegate).
 * These are the primary workflows for exercising the Node-side
 * Block Debugger (right-click block → Debug → set breakpoint on
 * extension.js → press canvas Run).
 * ════════════════════════════════════════════════════════════════ */

const STORY_SAMPLE = `# The Lighthouse Keeper

## Chapter One: The Storm

The waves crashed against the rocks below as Elena climbed the spiral stairs for the thousandth time. Her lantern swayed in the howling wind. Every night was the same ritual — clean the lens, trim the wick, and keep the light burning.

## Chapter Two: The Stranger

A knock at the door surprised her. No one ever came to the lighthouse. She opened it to find a drenched sailor, eyes wide, clutching a waterproof satchel to his chest. "I have something for you," he said.

## Chapter Three: The Letter

Inside the satchel was a letter sealed with wax — her mother's seal. She had been dead for seven years. Elena's hands trembled as she broke the seal and unfolded the yellowed paper.

## Chapter Four: The Truth

The letter told of a treasure — not gold, but a set of coordinates. The sailor watched silently as she traced them on her chart. They pointed to the reef just offshore. The one everyone said was cursed.`

/* ────────────────────────────────────────────────────────────────
 * 46 — Story Splitter: Chapter Mode
 * ──────────────────────────────────────────────────────────────── */
const W46 = wf(
  'wf_gs_46_story_split_chapter',
  '46 · Story Splitter — Chapter Mode',
  'Split a story into chapters using ## heading markers. story_splitter runs in the browser (client.js).',
  [
    n('w46_s',  'starter',      'Start',    0),
    n('w46_i',  'user_input',   'Story',    1),
    n('w46_sp', 'story_splitter','Split',   2),
    n('w46_p',  'show_preview', 'Scenes',   3),
  ],
  [
    e('w46_s',  'out',    'w46_i',  'in'),
    e('w46_i',  'value',  'w46_sp', 'in_input'),
    e('w46_sp', 'scenes', 'w46_p',  'in_input'),
  ],
  {
    w46_s: { startWorkflow: 'manual' },
    w46_i: { kind: 'longtext', label: 'Story text', defaultValue: STORY_SAMPLE, required: true },
    w46_sp: { split_by: 'scene', include_heading: true, max_scenes: '0' },
    w46_p: { label: 'Split scenes' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 47 — Story Splitter: Paragraph Mode
 * ──────────────────────────────────────────────────────────────── */
const W47 = wf(
  'wf_gs_47_story_split_paragraph',
  '47 · Story Splitter — Paragraph Mode',
  'Split a story into individual paragraphs (blank-line separator). Good for granular processing.',
  [
    n('w47_s',  'starter',       'Start',    0),
    n('w47_i',  'user_input',    'Story',    1),
    n('w47_sp', 'story_splitter','Split',    2),
    n('w47_fn', 'function',      'Count',    3),
    n('w47_p',  'show_preview',  'Preview',  4),
  ],
  [
    e('w47_s',  'out',    'w47_i',  'in'),
    e('w47_i',  'value',  'w47_sp', 'in_input'),
    e('w47_sp', 'scenes', 'w47_fn', 'in_input'),
    e('w47_fn', 'result', 'w47_p',  'in_input'),
  ],
  {
    w47_s: { startWorkflow: 'manual' },
    w47_i: { kind: 'longtext', label: 'Story text', defaultValue: STORY_SAMPLE, required: true },
    w47_sp: { split_by: 'paragraph', include_heading: false, max_scenes: '0' },
    w47_fn: { language: 'javascript', code: 'return { paragraph_count: input.length, paragraphs: input }' },
    w47_p: { label: 'Paragraph count + list' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 48 — Story Splitter: Extract First Scene
 * ──────────────────────────────────────────────────────────────── */
const W48 = wf(
  'wf_gs_48_story_first_scene',
  '48 · Story Splitter — Extract First Scene',
  'Split a story and extract only the first scene using the .first output port.',
  [
    n('w48_s',  'starter',       'Start',   0),
    n('w48_sp', 'story_splitter','Split',   1),
    n('w48_t',  'text_template', 'Format',  2),
    n('w48_p',  'show_preview',  'Preview', 3),
  ],
  [
    e('w48_s',  'out',   'w48_sp', 'in'),
    e('w48_sp', 'first', 'w48_t',  'in_input'),
    e('w48_t',  'result','w48_p',  'in_input'),
  ],
  {
    w48_s: { startWorkflow: 'manual' },
    w48_sp: { split_by: 'scene', include_heading: true, max_scenes: '0',
               input: STORY_SAMPLE },
    w48_t: { template: '## {{title}}\n\n{{content}}\n\n---\n*Scene {{index}} of the story*' },
    w48_p: { label: 'First scene' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 49 — Story Splitter: Scene Stats
 * ──────────────────────────────────────────────────────────────── */
const W49 = wf(
  'wf_gs_49_story_stats',
  '49 · Story Splitter — Scene Stats',
  'Split a story and compute word count and average scene length across all scenes.',
  [
    n('w49_s',  'starter',       'Start',   0),
    n('w49_sp', 'story_splitter','Split',   1),
    n('w49_fn', 'function',      'Stats',   2),
    n('w49_p',  'show_preview',  'Preview', 3),
  ],
  [
    e('w49_s',  'out',    'w49_sp', 'in'),
    e('w49_sp', 'scenes', 'w49_fn', 'in_input'),
    e('w49_fn', 'result', 'w49_p',  'in_input'),
  ],
  {
    w49_s: { startWorkflow: 'manual' },
    w49_sp: { split_by: 'scene', include_heading: true, max_scenes: '0',
               input: STORY_SAMPLE },
    w49_fn: {
      language: 'javascript',
      code: `const scenes = input
const totalWords = scenes.reduce((sum, s) => sum + s.content.split(/\\s+/).length, 0)
return {
  scene_count: scenes.count ?? scenes.length,
  total_words: totalWords,
  avg_words_per_scene: Math.round(totalWords / scenes.length),
  titles: scenes.map(s => s.title),
}`,
    },
    w49_p: { label: 'Story statistics' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 50 — Story Splitter: Max Scenes Limit
 * ──────────────────────────────────────────────────────────────── */
const W50 = wf(
  'wf_gs_50_story_max_scenes',
  '50 · Story Splitter — Max Scenes Limit',
  'Use max_scenes to cap how many scenes are returned. Useful for previews or token budgeting.',
  [
    n('w50_s',  'starter',       'Start',   0),
    n('w50_i',  'user_input',    'Limit',   1),
    n('w50_sp', 'story_splitter','Split',   2),
    n('w50_p',  'show_preview',  'Preview', 3),
  ],
  [
    e('w50_s',  'out',    'w50_i',  'in'),
    e('w50_i',  'value',  'w50_sp', 'in_max_scenes'),
    e('w50_sp', 'scenes', 'w50_p',  'in_input'),
  ],
  {
    w50_s: { startWorkflow: 'manual' },
    w50_i: { kind: 'number', label: 'Max scenes to return', defaultValue: '2', required: true },
    w50_sp: { split_by: 'scene', include_heading: true,
               input: STORY_SAMPLE },
    w50_p: { label: 'Capped scene list' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 51 — Story → Agent Summarize Each Scene
 * ──────────────────────────────────────────────────────────────── */
const W51 = wf(
  'wf_gs_51_story_summarize_scenes',
  '51 · Story Pipeline — Summarize Each Scene (agent)',
  'Split a story into scenes then run an AI agent to summarize each one.',
  [
    n('w51_s',  'starter',       'Start',   0),
    n('w51_sp', 'story_splitter','Split',   1),
    n('w51_fe', 'for_each',      'Each',    2),
    n('w51_p',  'show_preview',  'Preview', 3),
  ],
  [
    e('w51_s',  'out',        'w51_sp', 'in'),
    e('w51_sp', 'scenes',     'w51_fe', 'in_input'),
    e('w51_fe', 'iterations', 'w51_p',  'in_input'),
  ],
  {
    w51_s:  { startWorkflow: 'manual' },
    w51_sp: { split_by: 'scene', include_heading: true, max_scenes: '0',
               input: STORY_SAMPLE },
    w51_fe: { collection: 'input', itemVar: 'scene', maxConcurrency: 2 },
    w51_p:  { label: 'Per-scene iterations' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 52 — Story → Filter Short Scenes
 * ──────────────────────────────────────────────────────────────── */
const W52 = wf(
  'wf_gs_52_story_filter_scenes',
  '52 · Story Pipeline — Filter Short Scenes',
  'Split into scenes, then filter out any scene with fewer than 50 words.',
  [
    n('w52_s',  'starter',       'Start',   0),
    n('w52_sp', 'story_splitter','Split',   1),
    n('w52_fn', 'function',      'Tag',     2),
    n('w52_fi', 'filter',        'Filter',  3),
    n('w52_p',  'show_preview',  'Preview', 4),
  ],
  [
    e('w52_s',  'out',    'w52_sp', 'in'),
    e('w52_sp', 'scenes', 'w52_fn', 'in_input'),
    e('w52_fn', 'result', 'w52_fi', 'in_items'),
    e('w52_fi', 'kept',   'w52_p',  'in_input'),
  ],
  {
    w52_s:  { startWorkflow: 'manual' },
    w52_sp: { split_by: 'scene', include_heading: true, max_scenes: '0',
               input: STORY_SAMPLE },
    w52_fn: {
      language: 'javascript',
      code: `return input.map(s => ({ ...s, word_count: s.content.split(/\\s+/).length }))`,
    },
    w52_fi: { conditions: [{ field: 'word_count', operator: '>=', value: '50' }], mode: 'keep' },
    w52_p:  { label: 'Long scenes only (≥50 words)' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 53 — Story → Sort by Length
 * ──────────────────────────────────────────────────────────────── */
const W53 = wf(
  'wf_gs_53_story_sort_scenes',
  '53 · Story Pipeline — Sort Scenes by Length',
  'Split into scenes, tag each with word count, then sort longest-first.',
  [
    n('w53_s',  'starter',       'Start',   0),
    n('w53_sp', 'story_splitter','Split',   1),
    n('w53_fn', 'function',      'Tag',     2),
    n('w53_so', 'sort',          'Sort',    3),
    n('w53_p',  'show_preview',  'Preview', 4),
  ],
  [
    e('w53_s',  'out',    'w53_sp', 'in'),
    e('w53_sp', 'scenes', 'w53_fn', 'in_input'),
    e('w53_fn', 'result', 'w53_so', 'in_items'),
    e('w53_so', 'sorted', 'w53_p',  'in_input'),
  ],
  {
    w53_s:  { startWorkflow: 'manual' },
    w53_sp: { split_by: 'scene', include_heading: true, max_scenes: '0',
               input: STORY_SAMPLE },
    w53_fn: {
      language: 'javascript',
      code: `return input.map(s => ({ ...s, word_count: s.content.split(/\\s+/).length }))`,
    },
    w53_so: { sortKey: 'word_count', order: 'desc', type: 'number' },
    w53_p:  { label: 'Scenes ranked by length' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 54 — Story → Agent: Extract Scene Titles
 * ──────────────────────────────────────────────────────────────── */
const W54 = wf(
  'wf_gs_54_story_extract_titles',
  '54 · Story Pipeline — AI Scene Title Generator',
  'Split a story into scenes, then use an agent to suggest a better title for each scene.',
  [
    n('w54_s',  'starter',       'Start',   0),
    n('w54_sp', 'story_splitter','Split',   1),
    n('w54_fn', 'function',      'Format',  2),
    n('w54_ag', 'agent',         'Titles',  3),
    n('w54_p',  'show_preview',  'Preview', 4),
  ],
  [
    e('w54_s',  'out',    'w54_sp', 'in'),
    e('w54_sp', 'scenes', 'w54_fn', 'in_input'),
    e('w54_fn', 'result', 'w54_ag', 'in_input'),
    e('w54_ag', 'data',   'w54_p',  'in_input'),
  ],
  {
    w54_s:  { startWorkflow: 'manual' },
    w54_sp: { split_by: 'scene', include_heading: true, max_scenes: '0',
               input: STORY_SAMPLE },
    w54_fn: {
      language: 'javascript',
      code: `return input.map(s => \`Scene \${s.index}: \${s.title}\\n\${s.content.slice(0,120)}...\`).join('\\n\\n')`,
    },
    w54_ag: {
      model: 'gpt-4.1',
      systemPrompt: 'You are a creative writing editor. Suggest one punchy, evocative title per scene.',
      userPrompt: 'Here are scenes from a story. For each, suggest a better title (one line each):\n\n{{input}}',
      temperature: 0.7,
    },
    w54_p: { label: 'Suggested scene titles' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 55 — Story → Aggregate Word Count
 * ──────────────────────────────────────────────────────────────── */
const W55 = wf(
  'wf_gs_55_story_word_count',
  '55 · Story Pipeline — Total Word Count',
  'Split a story into scenes, tag each with word count, then sum total words.',
  [
    n('w55_s',  'starter',       'Start',   0),
    n('w55_sp', 'story_splitter','Split',   1),
    n('w55_fn', 'function',      'Tag',     2),
    n('w55_ag', 'aggregate',     'Sum',     3),
    n('w55_p',  'show_preview',  'Preview', 4),
  ],
  [
    e('w55_s',  'out',    'w55_sp', 'in'),
    e('w55_sp', 'scenes', 'w55_fn', 'in_input'),
    e('w55_fn', 'result', 'w55_ag', 'in_items'),
    e('w55_ag', 'result', 'w55_p',  'in_input'),
  ],
  {
    w55_s:  { startWorkflow: 'manual' },
    w55_sp: { split_by: 'scene', include_heading: true, max_scenes: '0',
               input: STORY_SAMPLE },
    w55_fn: {
      language: 'javascript',
      code: `return input.map(s => ({ ...s, word_count: s.content.split(/\\s+/).length }))`,
    },
    w55_ag: { operation: 'sum', field: 'word_count' },
    w55_p:  { label: 'Total word count' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 56 — Storybook PDF: Single Chapter (extension.js path)
 * ──────────────────────────────────────────────────────────────── */
const W56 = wf(
  'wf_gs_56_storybook_pdf_basic',
  '56 · Storybook PDF — Generate PDF (extension.js path)',
  'Generate a PDF from a story. storybook_pdf delegates to extension.js via /ck8t/run-block — the VS Code extension must be active.',
  [
    n('w56_s',   'starter',      'Start',    0),
    n('w56_i',   'user_input',   'Story',    1),
    n('w56_pdf', 'storybook_pdf','PDF',      2),
    n('w56_p',   'show_preview', 'Preview',  3),
  ],
  [
    e('w56_s',   'out',    'w56_i',   'in'),
    e('w56_i',   'value',  'w56_pdf', 'in_input'),
    e('w56_pdf', 'pdf',    'w56_p',   'in_input'),
  ],
  {
    w56_s: { startWorkflow: 'manual' },
    w56_i: { kind: 'longtext', label: 'Story text (Markdown with ## chapter headings)', defaultValue: STORY_SAMPLE, required: true },
    w56_pdf: { title: 'My Story', author: 'CK8T Demo', fontSize: '12', pageSize: 'A4' },
    w56_p: { label: 'Generated PDF' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 57 — Full Pipeline: Split → PDF
 * ──────────────────────────────────────────────────────────────── */
const W57 = wf(
  'wf_gs_57_story_to_pdf',
  '57 · Full Story Pipeline — Split Scenes → PDF',
  'Split a story into scenes with story_splitter (browser), then generate a PDF with storybook_pdf (extension host). Tests both execution paths.',
  [
    n('w57_s',   'starter',       'Start',   0),
    n('w57_sp',  'story_splitter','Split',   1),
    n('w57_pdf', 'storybook_pdf', 'PDF',     2),
    n('w57_p',   'show_preview',  'Preview', 3),
  ],
  [
    e('w57_s',   'out',    'w57_sp',  'in'),
    e('w57_sp',  'scenes', 'w57_pdf', 'in_scenes'),
    e('w57_pdf', 'pdf',    'w57_p',   'in_input'),
  ],
  {
    w57_s:   { startWorkflow: 'manual' },
    w57_sp:  { split_by: 'scene', include_heading: true, max_scenes: '0',
                input: STORY_SAMPLE },
    w57_pdf: { title: 'The Lighthouse Keeper', author: 'Demo Author', fontSize: '12', pageSize: 'A4' },
    w57_p:   { label: 'Generated PDF' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 58 — Full Pipeline: Split → PDF → Save
 * ──────────────────────────────────────────────────────────────── */
const W58 = wf(
  'wf_gs_58_story_pdf_save',
  '58 · Story Pipeline — Split → PDF → Save to Disk',
  'Full pipeline: split story → generate PDF (extension.js path) → save the PDF file to disk.',
  [
    n('w58_s',   'starter',       'Start',   0),
    n('w58_sp',  'story_splitter','Split',   1),
    n('w58_pdf', 'storybook_pdf', 'PDF',     2),
    n('w58_sv',  'save_to_files', 'Save',    3),
  ],
  [
    e('w58_s',   'out',    'w58_sp',  'in'),
    e('w58_sp',  'scenes', 'w58_pdf', 'in_scenes'),
    e('w58_pdf', 'pdf',    'w58_sv',  'in_input'),
  ],
  {
    w58_s:   { startWorkflow: 'manual' },
    w58_sp:  { split_by: 'scene', include_heading: true, max_scenes: '0',
                input: STORY_SAMPLE },
    w58_pdf: { title: 'The Lighthouse Keeper', author: 'Demo Author', fontSize: '12', pageSize: 'A4' },
    w58_sv:  { path: './output/story.pdf', format: 'binary', overwrite: true },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 59 — Story: User Input → Split → Count → Preview
 * ──────────────────────────────────────────────────────────────── */
const W59 = wf(
  'wf_gs_59_story_user_input',
  '59 · Story Splitter — User Input → Scene Count',
  'Paste your own story text, split it into scenes, and see the count + scene list.',
  [
    n('w59_s',  'starter',       'Start',   0),
    n('w59_i',  'user_input',    'Story',   1),
    n('w59_sp', 'story_splitter','Split',   2),
    n('w59_fn', 'function',      'Summary', 3),
    n('w59_p',  'show_preview',  'Preview', 4),
  ],
  [
    e('w59_s',  'out',    'w59_i',  'in'),
    e('w59_i',  'value',  'w59_sp', 'in_input'),
    e('w59_sp', 'scenes', 'w59_fn', 'in_input'),
    e('w59_fn', 'result', 'w59_p',  'in_input'),
  ],
  {
    w59_s:  { startWorkflow: 'manual' },
    w59_i:  { kind: 'longtext', label: 'Paste your story (use ## Scene headings)', defaultValue: STORY_SAMPLE, required: true },
    w59_sp: { split_by: 'scene', include_heading: true, max_scenes: '0' },
    w59_fn: {
      language: 'javascript',
      code: `return {
  count: input.length,
  titles: input.map(s => s.title),
  first_100_chars: input.map(s => s.content.slice(0, 100) + '...')
}`,
    },
    w59_p: { label: 'Scene summary' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 60 — Story: Parallel Split + PDF
 * ──────────────────────────────────────────────────────────────── */
const W60 = wf(
  'wf_gs_60_story_parallel',
  '60 · Story Pipeline — Parallel Split + PDF',
  'Fan out from starter: one branch counts scenes (browser), another generates PDF (extension.js). Both run in parallel.',
  [
    n('w60_s',   'starter',       'Start',   0),
    n('w60_sp1', 'story_splitter','Count',   1, -0.4),
    n('w60_pdf', 'storybook_pdf', 'PDF',     1,  0.4),
    n('w60_fn',  'function',      'Stats',   2, -0.4),
    n('w60_mg',  'merge',         'Merge',   2,  0),
    n('w60_p',   'show_preview',  'Preview', 3),
  ],
  [
    e('w60_s',   'out',    'w60_sp1', 'in'),
    e('w60_s',   'out',    'w60_pdf', 'in'),
    e('w60_sp1', 'scenes', 'w60_fn',  'in_input'),
    e('w60_fn',  'result', 'w60_mg',  'in_input1'),
    e('w60_pdf', 'pdf',    'w60_mg',  'in_input2'),
    e('w60_mg',  'merged', 'w60_p',   'in_input'),
  ],
  {
    w60_s:   { startWorkflow: 'manual' },
    w60_sp1: { split_by: 'scene', include_heading: true, max_scenes: '0',
                input: STORY_SAMPLE },
    w60_pdf: { title: 'The Lighthouse Keeper', author: 'Demo', fontSize: '12', pageSize: 'A4',
                input: STORY_SAMPLE },
    w60_fn:  { language: 'javascript', code: 'return { scene_count: input.length, titles: input.map(s => s.title) }' },
    w60_mg:  { mode: 'deep_merge' },
    w60_p:   { label: 'Stats + PDF result' },
  },
)

/* ════════════════════════════════════════════════════════════════
 * Community Block Workflows (W61–W64) — AI / Reasoning Blocks
 * ════════════════════════════════════════════════════════════════ */

/* ────────────────────────────────────────────────────────────────
 * 61 — AI Classifier: intent detection
 * ──────────────────────────────────────────────────────────────── */
const W61 = wf(
  'wf_gs_61_ai_classifier',
  '61 · AI Classifier — Intent Detection',
  'Use ai_classifier to route user input into one of several defined categories. The model returns the best-matching category and a confidence score.',
  [
    n('w61_s',  'starter',       'Start',    0),
    n('w61_c',  'ai_classifier', 'Classify', 1),
    n('w61_p',  'show_preview',  'Preview',  2),
  ],
  [
    e('w61_s', 'out',      'w61_c', 'in'),
    e('w61_c', 'category', 'w61_p', 'in_input'),
  ],
  {
    w61_s: { startWorkflow: 'manual' },
    w61_c: {
      systemPrompt: 'Classify the user message into exactly one category.',
      text: 'I need to reset my password and also my account is showing the wrong billing amount.',
      categories: 'account_access\nbilling_issue\ntechnical_support\ngeneral_inquiry',
      outputMode: 'category',
    },
    w61_p: { label: 'Detected category' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 62 — Chain of Thought: multi-step reasoning
 * ──────────────────────────────────────────────────────────────── */
const W62 = wf(
  'wf_gs_62_chain_of_thought',
  '62 · Chain of Thought — Multi-Step Reasoning',
  'chain_of_thought forces the model to show its work step-by-step before giving a final answer. Wire the "conclusion" output to downstream blocks.',
  [
    n('w62_s',  'starter',         'Start',    0),
    n('w62_cot','chain_of_thought','Reason',   1),
    n('w62_p',  'show_preview',    'Preview',  2),
  ],
  [
    e('w62_s',   'out',        'w62_cot', 'in'),
    e('w62_cot', 'conclusion', 'w62_p',   'in_input'),
  ],
  {
    w62_s:   { startWorkflow: 'manual' },
    w62_cot: {
      systemPrompt: 'You are a careful reasoning assistant. Think through the problem step by step.',
      question: 'A store sells apples for $0.75 each or 6 for $3.50. If I need 14 apples, what is the cheapest total price?',
    },
    w62_p: { label: 'Final conclusion' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 63 — Master Agent: orchestrate a swarm of specialists
 * ──────────────────────────────────────────────────────────────── */
const W63 = wf(
  'wf_gs_63_master_agent',
  '63 · Master Agent — Orchestrate Specialist Swarm',
  'master_agent breaks a complex question into sub-tasks, spins up slave_agent workers, and merges the answers. Open the block to see the routing logic.',
  [
    n('w63_s',  'starter',      'Start',    0),
    n('w63_ma', 'master_agent', 'Swarm',    1),
    n('w63_p',  'show_preview', 'Preview',  2),
  ],
  [
    e('w63_s',  'out',    'w63_ma', 'in'),
    e('w63_ma', 'result', 'w63_p',  'in_input'),
  ],
  {
    w63_s:  { startWorkflow: 'manual' },
    w63_ma: {
      systemPrompt: 'You coordinate a team of specialist agents to answer complex questions thoroughly.',
      question: 'Compare the pros and cons of REST vs GraphQL for a public API, and give a final recommendation.',
      workerCount: '2',
      enableSynthesis: true,
    },
    w63_p: { label: 'Swarm answer' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 64 — Slave Agent: single specialist worker
 * ──────────────────────────────────────────────────────────────── */
const W64 = wf(
  'wf_gs_64_slave_agent',
  '64 · Slave Agent — Specialist Worker',
  'slave_agent is a focused sub-agent that receives a single task and returns a structured answer. Useful standalone or when wired from master_agent outputs.',
  [
    n('w64_s',  'starter',     'Start',   0),
    n('w64_sa', 'slave_agent', 'Worker',  1),
    n('w64_p',  'show_preview','Preview', 2),
  ],
  [
    e('w64_s',  'out',    'w64_sa', 'in'),
    e('w64_sa', 'answer', 'w64_p',  'in_input'),
  ],
  {
    w64_s:  { startWorkflow: 'manual' },
    w64_sa: {
      role: 'You are an expert in cloud infrastructure. Answer concisely with cited best practices.',
      task: 'What are the top 3 cost-optimisation strategies for AWS Lambda functions?',
    },
    w64_p: { label: 'Worker answer' },
  },
)

/* ════════════════════════════════════════════════════════════════
 * Block Debugger Walkthroughs (W65–W79)
 * Right-click a block → Debug → set breakpoint → press canvas Run.
 * ════════════════════════════════════════════════════════════════ */

/* ────────────────────────────────────────────────────────────────
 * 65 — Debug Walkthrough: Breakpoint on function block
 * ──────────────────────────────────────────────────────────────── */
const W65 = wf(
  'wf_gs_65_debug_function',
  '65 · Debugger Walkthrough — Function Block Breakpoint',
  'A workflow designed to practice breakpoints on a function block (client.js / browser path). Right-click "Compute" → Debug → set breakpoint on any line → press Run.',
  [
    n('w61_s',  'starter',     'Start',   0),
    n('w61_fn', 'function',    'Compute', 1),
    n('w61_p',  'show_preview','Preview', 2),
  ],
  [
    e('w61_s',  'out',    'w61_fn', 'in'),
    e('w61_fn', 'result', 'w61_p',  'in_input'),
  ],
  {
    w61_s: { startWorkflow: 'manual' },
    w61_fn: {
      language: 'javascript',
      code: `// Set a breakpoint on any line below and press canvas Run
const base = 100
const multiplier = 3
const step1 = base * multiplier          // line 4 — pause here
const step2 = step1 + base               // line 5
const step3 = step2.toString(16)         // line 6 — hex
const result = { base, multiplier, step1, step2, hex: step3 }
return result`,
    },
    w61_p: { label: 'Computed result' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 66 — Debug Walkthrough: Conditional Breakpoint
 * ──────────────────────────────────────────────────────────────── */
const W66 = wf(
  'wf_gs_66_debug_conditional',
  '66 · Debugger Walkthrough — Conditional Breakpoint',
  'Right-click a line number → Add Conditional Breakpoint → enter "i > 2". Only pauses when the condition is true.',
  [
    n('w62_s',  'starter',     'Start',   0),
    n('w62_fn', 'function',    'Loop',    1),
    n('w62_p',  'show_preview','Preview', 2),
  ],
  [
    e('w62_s',  'out',    'w62_fn', 'in'),
    e('w62_fn', 'result', 'w62_p',  'in_input'),
  ],
  {
    w62_s: { startWorkflow: 'manual' },
    w62_fn: {
      language: 'javascript',
      code: `// Right-click any line number → Add Conditional Breakpoint
// Try condition: result.length > 2  (only pauses after 3+ items built)
const result = []
for (let i = 0; i < 5; i++) {
  const item = { index: i, square: i * i, cube: i * i * i }
  result.push(item)
}
return result`,
    },
    w62_p: { label: 'Loop result' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 67 — Debug Walkthrough: Step Over vs Step Into
 * ──────────────────────────────────────────────────────────────── */
const W67 = wf(
  'wf_gs_67_debug_step',
  '67 · Debugger Walkthrough — Step Over / Step Into',
  'Practice Step Over (F10) vs Step Into (F11). Set breakpoint at the top, then step through each assignment.',
  [
    n('w63_s',  'starter',     'Start',   0),
    n('w63_fn', 'function',    'Steps',   1),
    n('w63_p',  'show_preview','Preview', 2),
  ],
  [
    e('w63_s',  'out',    'w63_fn', 'in'),
    e('w63_fn', 'result', 'w63_p',  'in_input'),
  ],
  {
    w63_s: { startWorkflow: 'manual' },
    w63_fn: {
      language: 'javascript',
      code: `// Breakpoint on line 2 — then use Step Over to advance line by line
const raw    = 'hello world from CK8T'
const words  = raw.split(' ')
const upper  = words.map(w => w[0].toUpperCase() + w.slice(1))
const joined = upper.join(' ')
const length = joined.length
return { raw, words, upper, joined, length }`,
    },
    w63_p: { label: 'Step-through result' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 68 — Debug Walkthrough: Extension.js Path (Storybook PDF)
 * ──────────────────────────────────────────────────────────────── */
const W68 = wf(
  'wf_gs_68_debug_extension_js',
  '68 · Debugger Walkthrough — extension.js Path (storybook_pdf)',
  'Debug storybook_pdf running in the VS Code extension host. Right-click storybook_pdf → Debug → switch to extension.js tab → set breakpoint → press canvas Run.',
  [
    n('w64_s',   'starter',      'Start',  0),
    n('w64_pdf', 'storybook_pdf','PDF',    1),
    n('w64_p',   'show_preview', 'Preview',2),
  ],
  [
    e('w64_s',   'out', 'w64_pdf', 'in'),
    e('w64_pdf', 'pdf', 'w64_p',   'in_input'),
  ],
  {
    w64_s:   { startWorkflow: 'manual' },
    w64_pdf: {
      title: 'Debug Test Story',
      author: 'CK8T Debugger',
      fontSize: '12',
      pageSize: 'A4',
      input: STORY_SAMPLE,
    },
    w64_p: { label: 'PDF output (via extension.js debug session)' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 69 — Debug Walkthrough: Watch Expressions
 * ──────────────────────────────────────────────────────────────── */
const W69 = wf(
  'wf_gs_69_debug_watch',
  '69 · Debugger Walkthrough — Watch Expressions',
  'Set a breakpoint then add watch expressions like "data.length" or "data[0].price" in the Watch panel. Updates live as you step.',
  [
    n('w65_s',  'starter',     'Start',   0),
    n('w65_fn', 'function',    'Data',    1),
    n('w65_p',  'show_preview','Preview', 2),
  ],
  [
    e('w65_s',  'out',    'w65_fn', 'in'),
    e('w65_fn', 'result', 'w65_p',  'in_input'),
  ],
  {
    w65_s: { startWorkflow: 'manual' },
    w65_fn: {
      language: 'javascript',
      code: `// Add watch: "data.length"  "data[0].price"  "total"
const data = [
  { id: 1, name: 'Apple',  price: 1.49, qty: 5  },
  { id: 2, name: 'Banana', price: 0.29, qty: 12 },
  { id: 3, name: 'Cherry', price: 3.99, qty: 2  },
]
const total   = data.reduce((s, i) => s + i.price * i.qty, 0)
const sorted  = [...data].sort((a, b) => b.price - a.price)
const cheapest = data.reduce((m, i) => i.price < m.price ? i : m)
return { data, total: total.toFixed(2), sorted, cheapest }`,
    },
    w65_p: { label: 'Shopping cart result' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 70 — Debug: Agent Block — client.js breakpoints
 * ──────────────────────────────────────────────────────────────── */
const W70 = wf(
  'wf_gs_70_debug_agent_extension',
  '70 · Debugger Walkthrough — Agent Block (client.js)',
  'Right-click the Agent block → Debug → switch to the "client.js" tab — set a breakpoint on the callLlm line and press Run. The agent runner executes in the browser, so Block Debugger breakpoints work normally here.',
  [
    n('w70_s',  'starter',     'Start',   0),
    n('w70_a',  'agent',       'Ask LLM', 1),
    n('w70_p',  'show_preview','Preview', 2),
  ],
  [
    e('w70_s', 'out',  'w70_a', 'in'),
    e('w70_a', 'data', 'w70_p', 'in_input'),
  ],
  {
    w70_s: { startWorkflow: 'manual' },
    w70_a: {
      systemPrompt: 'You are a concise assistant. Reply in one sentence.',
      userPrompt: 'What is the capital of France?',
    },
    w70_p: { label: 'LLM answer' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 71 — Debug: Agent Block — inspect systemPrompt interpolation
 * ──────────────────────────────────────────────────────────────── */
const W71 = wf(
  'wf_gs_71_debug_agent_prompt',
  '71 · Debugger Walkthrough — Agent Prompt Interpolation',
  'Right-click the Agent block → Debug → client.js tab. Set a breakpoint on the interpolateBag lines to inspect how {{input}} and {{variables}} are resolved before the LLM call. Watch the "bag" and "systemPrompt" variables.',
  [
    n('w71_s',  'starter',     'Start',   0),
    n('w71_fn', 'function',    'Build',   1),
    n('w71_a',  'agent',       'Ask LLM', 2),
    n('w71_p',  'show_preview','Preview', 3),
  ],
  [
    e('w71_s',  'out',    'w71_fn', 'in'),
    e('w71_fn', 'result', 'w71_a',  'in'),
    e('w71_a',  'data',   'w71_p',  'in_input'),
  ],
  {
    w71_s:  { startWorkflow: 'manual' },
    w71_fn: {
      language: 'javascript',
      code: `return { city: 'Tokyo', country: 'Japan', fact: 'population over 13 million' }`,
    },
    w71_a: {
      systemPrompt: 'You answer questions about {{city}}, {{country}}.',
      userPrompt: 'Give me one interesting fact beyond: {{fact}}',
    },
    w71_p: { label: 'Interpolated LLM answer' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 72 — Debug: Agent Block — inspect rawAgentResponse __meta
 * ──────────────────────────────────────────────────────────────── */
const W72 = wf(
  'wf_gs_72_debug_agent_meta',
  '72 · Debugger Walkthrough — Agent __meta Output',
  'Right-click the Agent block → Debug → client.js tab. Set a breakpoint after the callLlm await to inspect res.output, res.ms, and the full __meta object returned by the runner.',
  [
    n('w72_s',  'starter',     'Start',   0),
    n('w72_a',  'agent',       'Ask LLM', 1),
    n('w72_fn', 'function',    'Inspect', 2),
    n('w72_p',  'show_preview','Preview', 3),
  ],
  [
    e('w72_s',  'out',    'w72_a',  'in'),
    e('w72_a',  'data',   'w72_fn', 'in'),
    e('w72_fn', 'result', 'w72_p',  'in_input'),
  ],
  {
    w72_s: { startWorkflow: 'manual' },
    w72_a: {
      systemPrompt: 'You are a JSON API. Return only valid JSON with keys: answer and confidence (0-1).',
      userPrompt: 'Is the Earth older than the Sun?',
      responseFormat: '{"type":"object","properties":{"answer":{"type":"string"},"confidence":{"type":"number"}}}',
    },
    w72_fn: {
      language: 'javascript',
      code: `// input here is the agent's value.data
const parsed = typeof input === 'string' ? JSON.parse(input) : input
return { answer: parsed.answer, confidence: parsed.confidence, type: typeof parsed }`,
    },
    w72_p: { label: 'Structured output' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 73 — Debug: MCP Tool Call — inspect tool input/output
 * ──────────────────────────────────────────────────────────────── */
const W73 = wf(
  'wf_gs_73_debug_mcp_tool',
  '73 · Debugger Walkthrough — MCP Tool Call',
  'MCP blocks run in the browser via a bridge. Right-click an MCP block → Debug → switch to the client.js tab → set a breakpoint on the callTool line to inspect the params object and raw tool response.',
  [
    n('w73_s',  'starter',     'Start',   0),
    n('w73_fn', 'function',    'Prepare', 1),
    n('w73_p',  'show_preview','Preview', 2),
  ],
  [
    e('w73_s',  'out',    'w73_fn', 'in'),
    e('w73_fn', 'result', 'w73_p',  'in_input'),
  ],
  {
    w73_s:  { startWorkflow: 'manual' },
    w73_fn: {
      language: 'javascript',
      code: `// Simulates what the MCP block receives as its tool call response.
// Replace this with an actual MCP block once your MCP server is connected.
// Right-click the MCP block → Debug → client.js tab → breakpoint on the callTool line.
const simulatedToolResponse = {
  tool: 'read_file',
  params: { path: '/workspace/test.json' },
  result: { content: '{"hello":"world"}', mimeType: 'application/json' },
  durationMs: 42,
}
return simulatedToolResponse`,
    },
    w73_p: { label: 'MCP tool response shape' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 74 — Debug: AI Classifier — inspect confidence scores
 * ──────────────────────────────────────────────────────────────── */
const W74 = wf(
  'wf_gs_74_debug_classifier',
  '74 · Debugger Walkthrough — AI Classifier Confidence',
  'Right-click AI Classifier → Debug → switch to the client.js tab. Set a breakpoint on the JSON.parse line to inspect the raw LLM JSON before category and confidence are extracted. Watch "parsed" in the Watch panel.',
  [
    n('w74_s',  'starter',       'Start',    0),
    n('w74_c',  'ai_classifier', 'Classify', 1),
    n('w74_fn', 'function',      'Inspect',  2),
    n('w74_p',  'show_preview',  'Preview',  3),
  ],
  [
    e('w74_s',  'out',        'w74_c',  'in'),
    e('w74_c',  'confidence', 'w74_fn', 'in'),
    e('w74_fn', 'result',     'w74_p',  'in_input'),
  ],
  {
    w74_s: { startWorkflow: 'manual' },
    w74_c: {
      systemPrompt: 'Classify strictly into one provided category.',
      text: 'My internet is down and I cannot load any websites.',
      categories: 'billing\nnetwork_outage\npassword_reset\ngeneral',
      outputMode: 'category',
    },
    w74_fn: {
      language: 'javascript',
      code: `// input is the confidence score (0-1) from ai_classifier
const pct = (Number(input) * 100).toFixed(1)
return { confidence: input, display: pct + '%', strong: Number(input) > 0.8 }`,
    },
    w74_p: { label: 'Classifier confidence' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 75 — Debug: Chain of Thought — inspect reasoning steps
 * ──────────────────────────────────────────────────────────────── */
const W75 = wf(
  'wf_gs_75_debug_cot',
  '75 · Debugger Walkthrough — Chain of Thought Steps',
  'chain_of_thought returns both "reasoning_steps" and "conclusion". Right-click Chain of Thought → Debug → switch to the client.js tab → set a breakpoint to inspect the full steps array before conclusion is extracted. Watch panel: "result.reasoning_steps.length".',
  [
    n('w75_s',   'starter',         'Start',   0),
    n('w75_cot', 'chain_of_thought','Reason',  1),
    n('w75_fn',  'function',        'Inspect', 2),
    n('w75_p',   'show_preview',    'Preview', 3),
  ],
  [
    e('w75_s',   'out',             'w75_cot', 'in'),
    e('w75_cot', 'reasoning_steps', 'w75_fn',  'in'),
    e('w75_fn',  'result',          'w75_p',   'in_input'),
  ],
  {
    w75_s:   { startWorkflow: 'manual' },
    w75_cot: {
      systemPrompt: 'You reason step by step and always show your working.',
      question: 'If a train travels 300km in 2.5 hours and stops for 15 minutes, what is its average moving speed?',
    },
    w75_fn: {
      language: 'javascript',
      code: `// input is reasoning_steps array from chain_of_thought
const steps = Array.isArray(input) ? input : [input]
return { stepCount: steps.length, steps, firstStep: steps[0], lastStep: steps[steps.length - 1] }`,
    },
    w75_p: { label: 'Reasoning steps' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 76 — Debug: Function Block — error thrown, inspect stack
 * ──────────────────────────────────────────────────────────────── */
const W76 = wf(
  'wf_gs_76_debug_error',
  '76 · Debugger Walkthrough — Caught Error Inspection',
  'Enable "Pause on exceptions" in the debugger toolbar. This function throws intentionally. The debugger pauses at the throw site so you can inspect the call stack and local variables.',
  [
    n('w76_s',  'starter',     'Start',   0),
    n('w76_fn', 'function',    'Risky',   1),
    n('w76_p',  'show_preview','Preview', 2),
  ],
  [
    e('w76_s',  'out',    'w76_fn', 'in'),
    e('w76_fn', 'result', 'w76_p',  'in_input'),
  ],
  {
    w76_s: { startWorkflow: 'manual' },
    w76_fn: {
      language: 'javascript',
      code: `// Enable "Pause on exceptions" in the debug toolbar — click the ⊘ icon
function parseJson(raw) {
  const parsed = JSON.parse(raw)   // breakpoint here
  return parsed.value * 2
}
const goodData = '{"value": 21}'
const badData  = 'not valid json'
const r1 = parseJson(goodData)
const r2 = parseJson(badData)      // throws here — debugger will pause
return { r1, r2 }`,
    },
    w76_p: { label: 'Should not reach this' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 77 — Debug: Multi-block pipeline — trace data across blocks
 * ──────────────────────────────────────────────────────────────── */
const W77 = wf(
  'wf_gs_77_debug_pipeline',
  '77 · Debugger Walkthrough — Multi-Block Pipeline Trace',
  'Enable debug mode on ALL three function blocks. Run the workflow and switch between Block Debug tabs to see how the data transforms at each stage. Compare input/output in the Block Debug panel.',
  [
    n('w77_s',   'starter',     'Start',    0),
    n('w77_fn1', 'function',    'Fetch',    1),
    n('w77_fn2', 'function',    'Filter',   2),
    n('w77_fn3', 'function',    'Format',   3),
    n('w77_p',   'show_preview','Preview',  4),
  ],
  [
    e('w77_s',   'out',    'w77_fn1', 'in'),
    e('w77_fn1', 'result', 'w77_fn2', 'in'),
    e('w77_fn2', 'result', 'w77_fn3', 'in'),
    e('w77_fn3', 'result', 'w77_p',   'in_input'),
  ],
  {
    w77_s:   { startWorkflow: 'manual' },
    w77_fn1: {
      language: 'javascript',
      code: `// Stage 1 — simulate fetched records (right-click → Debug this block)
return [
  { id: 1, name: 'Alice',  score: 87, active: true  },
  { id: 2, name: 'Bob',    score: 42, active: false },
  { id: 3, name: 'Carol',  score: 95, active: true  },
  { id: 4, name: 'Dave',   score: 61, active: true  },
  { id: 5, name: 'Eve',    score: 33, active: false },
]`,
    },
    w77_fn2: {
      language: 'javascript',
      code: `// Stage 2 — filter active users with score >= 60
const rows = Array.isArray(input) ? input : []
return rows.filter(r => r.active && r.score >= 60)`,
    },
    w77_fn3: {
      language: 'javascript',
      code: `// Stage 3 — format for display
const rows = Array.isArray(input) ? input : []
return rows.map(r => ({ label: r.name, badge: r.score + ' pts' }))`,
    },
    w77_p: { label: 'Formatted leaderboard' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 78 — Debug: Agent + Function — inspect LLM output before parse
 * ──────────────────────────────────────────────────────────────── */
const W78 = wf(
  'wf_gs_78_debug_agent_parse',
  '78 · Debugger Walkthrough — Agent Output Before JSON Parse',
  'The Agent block returns value.data as a string when using JSON response format. Set a breakpoint in the downstream Function block on the JSON.parse line to inspect the raw string before it is parsed.',
  [
    n('w78_s',  'starter',     'Start',   0),
    n('w78_a',  'agent',       'Ask LLM', 1),
    n('w78_fn', 'function',    'Parse',   2),
    n('w78_p',  'show_preview','Preview', 3),
  ],
  [
    e('w78_s',  'out',   'w78_a',  'in'),
    e('w78_a',  'value', 'w78_fn', 'in'),
    e('w78_fn', 'result','w78_p',  'in_input'),
  ],
  {
    w78_s: { startWorkflow: 'manual' },
    w78_a: {
      systemPrompt: 'Return ONLY a JSON object with keys: title (string), year (number), genre (string).',
      userPrompt: 'Give me details for the movie Inception.',
    },
    w78_fn: {
      language: 'javascript',
      code: `// Set breakpoint on next line — inspect raw "input" string in Variables panel
const raw = typeof input === 'object' ? input?.data ?? JSON.stringify(input) : String(input)
const movie = JSON.parse(raw)   // breakpoint: watch "raw" before parse
return { title: movie.title, year: movie.year, genre: movie.genre, rawLength: raw.length }`,
    },
    w78_p: { label: 'Parsed movie data' },
  },
)

/* ────────────────────────────────────────────────────────────────
 * 79 — Debug: Console logs in function block
 * ──────────────────────────────────────────────────────────────── */
const W79 = wf(
  'wf_gs_79_debug_console',
  '79 · Debugger Walkthrough — Console Logs in Block Debug',
  'console.log / warn / error calls inside a function block are captured in the Block Debug panel under "Console". Enable debug mode, run the workflow, then open Block Debug to see the captured logs with timestamps.',
  [
    n('w79_s',  'starter',     'Start',   0),
    n('w79_fn', 'function',    'Noisy',   1),
    n('w79_p',  'show_preview','Preview', 2),
  ],
  [
    e('w79_s',  'out',    'w79_fn', 'in'),
    e('w79_fn', 'result', 'w79_p',  'in_input'),
  ],
  {
    w79_s: { startWorkflow: 'manual' },
    w79_fn: {
      language: 'javascript',
      code: `// All these logs appear in Block Debug → Console tab
console.log('Block started — input type:', typeof input)
const items = ['apple', 'banana', 'cherry', 'date']
console.info('Processing', items.length, 'items')
const result = items.map((item, i) => {
  console.log('  item', i, '→', item.toUpperCase())
  return { index: i, original: item, upper: item.toUpperCase(), length: item.length }
})
const longest = result.reduce((m, i) => i.length > m.length ? i : m)
console.warn('Longest item is', longest.original, 'with', longest.length, 'chars')
return { items: result, longest }`,
    },
    w79_p: { label: 'Logged result' },
  },
)

export const GETTING_STARTED_WORKFLOWS = [
  W01, W02, W03, W04, W05, W06, W07, W08, W09, W10,
  W11, W12, W13, W14, W15, W16, W17, W18, W19, W20,
  W21, W22, W23, W24, W25, W26, W27, W28, W29, W30,
  W31, W32, W33, W34, W35, W36, W37, W38, W39, W40,
  W41, W42, W43, W44, W45,
  W46, W47, W48, W49, W50,
  W51, W52, W53, W54, W55,
  W56, W57, W58, W59, W60,
  W61, W62, W63, W64,
  W65, W66, W67, W68, W69,
  W70, W71, W72, W73, W74,
  W75, W76, W77, W78, W79,
]

/** IDs of all getting-started workflows (for restore / re-seed). */
export const GETTING_STARTED_IDS = new Set(GETTING_STARTED_WORKFLOWS.map(w => w.id))
