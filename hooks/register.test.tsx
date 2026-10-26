import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'next-prompts',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 9 },
    view: {},
  },
} as const

const TURN = { answer: 'Done.', durationMs: 1000, isAborted: false, turnId: 't1', reason: 'answer' } as const

test('after a turn, the band offers three prompts and a press fills the box', async ($, on) => {
  const filled: string[] = []
  on('model.fork', () => ({
    value: {
      isAnswered: true,
      text: '["run the tests", "commit this", "explain the diff"]',
      usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    },
  }))
  on('prompt.fill', (_, e) => {
    filled.push(e.text)
    return { isFilled: true, cursor: e.text.length }
  })
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })

  await $.turn.complete(TURN)
  // The suggestions arrive from a fork the hook leaves running.
  for (let i = 0; i < 200; i++) await Promise.resolve()

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ type: 'Text', text: /commit this/ }))?.text).toBe('commit this')
    await ui.unmount()
  }

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await ui.press({ key: 's1' })
  expect(filled).toEqual(['commit this'])
  expect((await ui.find({ type: 'Text', text: /explain the diff/ }))?.text).toBe('explain the diff')
  await ui.unmount()
})

test('4 swaps in three new prompts, telling the model which ones missed', async ($, on) => {
  const asked: string[] = []
  const replies = ['["a", "b", "c"]', '["d", "e", "f"]']
  on('model.fork', (_, e) => {
    asked.push(e.prompt)
    return {
      value: {
        isAnswered: true,
        text: replies[asked.length - 1] ?? '[]',
        usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
      },
    }
  })
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })

  await $.turn.complete(TURN)
  for (let i = 0; i < 200; i++) await Promise.resolve()

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await ui.press({ key: 'refresh' })
  expect(asked[1]).toContain('["a","b","c"]')
  expect((await ui.find({ type: 'Text', text: /^e$/ }))?.text).toBe('e')
  await ui.unmount()
})

test('an Enter that beats the fill sends the suggestion, not the bare digit', async ($, on) => {
  const sent: string[] = []
  const filled: string[] = []
  const reply = {
    value: {
      isAnswered: true,
      text: '["a", "b", "c"]',
      usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    },
  } as const
  on('model.fork', () => reply)
  on('model.complete', () => reply)
  on('clock.now', () => ({ value: 0 }))
  on('session.messages', () => ({ value: [] }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  on('prompt.submit', (_, e) => {
    sent.push(e.text)
    return { text: e.text }
  })
  on('prompt.fill', async (_, e) => {
    if (filled.length === 0) {
      await $.prompt.submit({ text: '3', wait: false, origin: { kind: 'composer' } })
    }
    filled.push(e.text)
    return { isFilled: true, cursor: e.text.length }
  })

  await $.turn.complete(TURN)
  for (let i = 0; i < 200; i++) await Promise.resolve()

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await ui.press({ key: 's2' })
  expect(sent).toEqual(['c'])
  expect(filled).toEqual(['c', ''])
  await ui.unmount()
})

test('a bare 2 sent while suggestions show sends suggestion 2', async ($, on) => {
  const sent: string[] = []
  const reply = {
    value: {
      isAnswered: true,
      text: '["a", "b", "c"]',
      usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    },
  } as const
  on('model.fork', () => reply)
  on('model.complete', () => reply)
  on('clock.now', () => ({ value: 0 }))
  on('session.messages', () => ({ value: [] }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('prompt.submit', (_, e) => {
    sent.push(e.text)
    return { text: e.text }
  })

  await $.turn.complete(TURN)
  for (let i = 0; i < 200; i++) await Promise.resolve()

  await $.prompt.submit({ text: '2', wait: false, origin: { kind: 'composer' } })
  await $.prompt.submit({ text: '2', wait: false, origin: { kind: 'composer' } })
  expect(sent).toEqual(['b', '2'])
})
