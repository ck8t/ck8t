export default [
  {
    type: 'skill',
    async run({ values, input, getSkill, runSkill }) {
      const skillId = values.skillId
      if (!skillId) throw new Error('Skill block: no skill selected. Choose a skill from the dropdown.')
      const skill = getSkill?.(skillId)
      if (!skill) throw new Error(`Skill block: skill with id "${skillId}" not found in workspace.`)
      const inputStr = typeof input === 'string' ? input : JSON.stringify(input ?? null)
      const result = await runSkill?.(skill, inputStr)
      return { __meta: { skillId: skill.id, skillName: skill.name, input }, value: result }
    },
  },
]
