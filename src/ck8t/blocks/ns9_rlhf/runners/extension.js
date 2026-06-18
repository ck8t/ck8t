// Extension-side runner for the NS9 RLHF block.
// Records a human correction to the NS9 knowledge graph.
function interpolate(template, bag) {
  return template.replace(/\{\{([^}]+)\}\}/g, (_m, key) => {
    const val = bag[key.trim()]
    if (val === undefined) return ''
    return typeof val === 'object' ? JSON.stringify(val) : String(val)
  })
}

function toBag(input) {
  if (input && typeof input === 'object' && !Array.isArray(input)) return input
  if (typeof input === 'string') {
    try { return JSON.parse(input) } catch { /**/ }
    return { input }
  }
  return { input: String(input ?? '') }
}

export async function run({ values, input, callTool }) {
  const server = String(values.server || 'ns9')
  const bag = toBag(input)

  const question = interpolate(String(values.question || '{{question}}'), bag)
  const wrongAnswer = interpolate(String(values.wrong_answer || '{{wrong_answer}}'), bag)
  const correctAnswer = interpolate(String(values.correct_answer || '{{correct_answer}}'), bag)

  if (!question.trim() || !correctAnswer.trim()) {
    return { error: 'ns9_rlhf: question and correct_answer are required.', saved: false }
  }

  const args = {
    question,
    wrong_answer: wrongAnswer,
    correct_answer: correctAnswer,
    corrector: String(values.corrector || 'user'),
    propagate_now: values.propagate_now !== false,
  }

  try {
    return await callTool(server, 'ns9_rlhf_correct', args)
  } catch (err) {
    const msg = err?.message || String(err)
    return { error: `ns9_rlhf MCP call failed: ${msg}`, saved: false }
  }
}
