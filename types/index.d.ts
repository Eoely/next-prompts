export type Suggestions = readonly string[]

declare module 'claude-code' {
  interface PluginState {
    'next-prompts': { suggestions: Suggestions; isLoading: boolean }
  }
}
