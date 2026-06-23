export default [
  {
    type: 'schedule',
    run() { return { firedAt: new Date().toISOString() } },
  },
]
