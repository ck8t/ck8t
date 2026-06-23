import { interpolateBag } from '../../block-utils.js'

function safeJsonArray(v) {
  if (Array.isArray(v)) return v
  if (typeof v !== 'string') return []
  try { const p = JSON.parse(v); return Array.isArray(p) ? p : [] } catch { return [] }
}
function looksLikeUrl(s) { return typeof s === 'string' && /^https?:\/\//i.test(s.trim()) }

export default [
  {
    type: 'agent',
    async run({ values, input, callLlm, resolveModel, getSkill, runSkill, nodeId, nodeTitle }) {
      let inputStr = typeof input === 'string' ? input : JSON.stringify(input ?? '')
      const skillIds = [...safeJsonArray(values.skills), ...safeJsonArray(values.tools)]
      const bag = looksLikeUrl(inputStr) ? { url: inputStr, input: inputStr } : { input: inputStr }
      try {
        const parsed = JSON.parse(inputStr)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          for (const [k, v] of Object.entries(parsed)) bag[k] = v
        }
      } catch { /* ok */ }

      const skillRuns = []
      if (skillIds.length > 0) {
        for (const sid of skillIds) {
          const skill = getSkill?.(sid)
          if (!skill) continue
          const params = looksLikeUrl(inputStr) ? { url: inputStr, input: inputStr } : { input: inputStr }
          try {
            const out = await runSkill?.(skill, inputStr)
            inputStr = typeof out === 'string' ? out : JSON.stringify(out)
            if (out && typeof out === 'object' && !Array.isArray(out)) {
              for (const [k, v] of Object.entries(out)) bag[k] = v
            }
            bag.input = inputStr
            skillRuns.push({ skillId: sid, name: skill.name, params, output: out })
          } catch (e) {
            inputStr = JSON.stringify({ skillError: e.message || String(e), input: inputStr })
            bag.skillError = e.message || String(e); bag.input = inputStr
            skillRuns.push({ skillId: sid, name: skill.name, params, error: e.message || String(e) })
          }
        }
      }

      const { model, provider } = resolveModel(values.model, values.provider)
      if (!model) throw new Error(`No model provider configured for "${nodeTitle}"`)

      const memoryType = values.memoryType || 'none'
      let memoryConfig = null
      if (memoryType !== 'none') {
        const cfg = { type: memoryType }
        if (values.conversationId) cfg.conversationId = values.conversationId
        if (memoryType === 'sliding_window' && values.slidingWindowSize) cfg.windowSize = parseInt(values.slidingWindowSize, 10) || undefined
        if (memoryType === 'sliding_window_tokens' && values.slidingWindowTokens) cfg.maxTokens = parseInt(values.slidingWindowTokens, 10) || undefined
        memoryConfig = cfg
      }

      const agentCfg = {
        id: nodeId,
        provider,
        model,
        temperature: values.temperature,
        systemPrompt: interpolateBag(values.systemPrompt || '', bag),
        userPrompt: interpolateBag(values.userPrompt || '{{input}}', bag),
        responseFormat: values.responseFormat || null,
        strictOutput: values.strictOutput === true,
        skills: skillIds,
        ...(memoryConfig ? { memory: memoryConfig } : {}),
      }

      if (skillRuns.length > 0 && skillRuns.some(sr => sr.output != null)) {
        const skillOutputStr = typeof inputStr === 'string' ? inputStr : JSON.stringify(inputStr)
        if (!agentCfg.userPrompt.includes(skillOutputStr.slice(0, 40))) {
          agentCfg.userPrompt += '\n\n--- Skill Output ---\n' + skillOutputStr
        }
      }

      const { response: res, debug: llmFallback } = await callLlm(agentCfg, inputStr, nodeTitle)
      return {
        __meta: {
          model: agentCfg.model, temperature: agentCfg.temperature,
          systemPrompt: agentCfg.systemPrompt, userPrompt: agentCfg.userPrompt,
          memory: memoryConfig, skillIds, skillRuns, templateBag: bag,
          rawAgentResponse: res, llmFallback,
        },
        value: {
          data: res.output,
          status: 200,
          headers: { 'x-model': res.model, 'x-duration-ms': res.ms },
        },
      }
    },
  },
]
