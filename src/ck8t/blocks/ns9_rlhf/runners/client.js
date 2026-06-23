export default [
  {
    type: 'ns9_rlhf',
    async run({ values, input, callTool }) {
      const server = String(values.server || 'ns9')
      const bag = _toBag(input)
      const question      = _interp(String(values.question       || '{{question}}'),       bag)
      const wrongAnswer   = _interp(String(values.wrong_answer   || '{{wrong_answer}}'),   bag)
      const correctAnswer = _interp(String(values.correct_answer || '{{correct_answer}}'), bag)
      if (!question.trim() || !correctAnswer.trim()) return { error: 'ns9_rlhf: question and correct_answer are required.', saved: false }
      try {
        return await callTool(server, 'ns9_rlhf_correct', { question, wrong_answer: wrongAnswer, correct_answer: correctAnswer, corrector: String(values.corrector || 'user'), propagate_now: values.propagate_now !== false })
      } catch (err) { return { error: `ns9_rlhf failed: ${err?.message ?? err}`, saved: false } }
    },
  },
]

function _toBag(input) {
  if (input && typeof input === 'object' && !Array.isArray(input)) return input
  if (typeof input === 'string') { try { return JSON.parse(input) } catch { return { input } } }
  return { input: String(input ?? '') }
}
function _interp(t, bag) {
  return t.replace(/\{\{([^}]+)\}\}/g, (_, k) => { const v = bag[k.trim()]; return v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v) })
}
