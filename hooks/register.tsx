import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Suggestions } from '../types'

const suggestions = atom({ plugin: 'next-prompts', key: 'suggestions' } as const, [] as Suggestions)
const isLoading = atom({ plugin: 'next-prompts', key: 'isLoading' } as const, false)

// Bumped on every submit so a slow fork can't show suggestions for a turn the person has moved past.
let generation = 0

const ASK = `Stop here and do not continue the task. Instead, predict what I (the user) am most likely to type as my very next prompt in this conversation.

Give exactly 3 distinct candidates, best first. Each should be something I would plausibly send next: written in my voice and style, the way I have been writing my prompts here, concrete to where the conversation stands now, and under 25 words. Vary them: e.g. the obvious next step, a follow-up or check on what you just did, and a useful alternative direction.

Answer with a JSON array of 3 strings and nothing else.`

function parse(text: string): string[] {
  const match = text.match(/\[[\s\S]*\]/)
  if (match) {
    try {
      const items: unknown = JSON.parse(match[0])
      if (Array.isArray(items)) {
        return items.filter((s): s is string => typeof s === 'string' && s.trim() !== '').map(s => s.trim())
      }
    } catch {}
  }

  return text
    .split('\n')
    .map(line => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').trim())
    .filter(Boolean)
}

async function suggest($: EngineInterface, rejected: Suggestions = []) {
  const mine = ++generation
  await update($, isLoading, () => true)

  const prompt =
    rejected.length === 0
      ? ASK
      : `${ASK}\n\nNone of these earlier candidates fit, so give 3 different ones:\n${JSON.stringify(rejected)}`
  const reply = await $.model.fork({ prompt })
  if (mine !== generation) {
    return
  }

  if (reply.isAnswered) {
    const items = parse(reply.text).slice(0, 3)
    await update($, suggestions, () => items)
  }
  await update($, isLoading, () => false)
}

export const register: Register = on => {
  on('prompt.submit', async ($, e, next) => {
    generation += 1
    // A quick 1+Enter can send the bare digit before the hotkey's fill lands; nobody sends just "2" otherwise.
    const picked = /^[1-3]$/.test(e.text.trim()) ? (await read($, suggestions))[Number(e.text.trim()) - 1] : undefined
    await update($, suggestions, () => [])
    await update($, isLoading, () => false)

    return next(picked === undefined ? e : { ...e, text: picked })
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined && e.reason === 'answer') {
      void suggest($)
    }

    return result
  })

  // The band replaces the engine's single dim suggestion.
  on('prompt.suggest', ($, e, next) => (e.origin.kind === 'suggestion' ? { isShown: false } : next(e)))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const items = await read($, suggestions)
    const loading = await read($, isLoading)
    if (e.props.hasSurvey || e.props.isWorking || e.props.view.agentId !== undefined || (items.length === 0 && !loading)) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)
    const take = async (text: string) => {
      const before = generation
      await $.prompt.fill({ text })
      // Sent before the fill landed: don't leave the suggestion sitting in the emptied box.
      if (generation !== before) {
        await $.prompt.fill({ text: '' })
      }
    }

    return (
      <Box flexDirection="column" borderStyle="round" borderColor="suggestion" paddingX={1}>
        <Text dimColor>{loading ? 'Next prompts · thinking…' : 'Next prompts'}</Text>
        {items.map((text, i) => (
          <Button key={`s${i}`} hotkey={String(i + 1)} plain onPress={() => take(text)}>
            <Text wrap="truncate-end">{text}</Text>
          </Button>
        ))}
        {items.length > 0 && (
          <Button key="refresh" hotkey="4" plain dimColor onPress={() => suggest($, items)}>
            new suggestions
          </Button>
        )}
      </Box>
    )
  })
}
