function interpolateBag(template, bag) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    const v = bag[k]
    return v === undefined ? `{{${k}}}` : (typeof v === 'string' ? v : JSON.stringify(v))
  })
}
export function run({ values, input }) {
  const template = String(values.template || '')
  const bag = { input }
  if (input && typeof input === 'object' && !Array.isArray(input)) Object.assign(bag, input)
  return interpolateBag(template, bag)
}
