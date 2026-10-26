# next-prompts

A Claude Code mod that suggests your next prompt. After every turn, three likely next prompts appear in a box above the prompt input, written in your own style.

- **`1`–`3`** on an empty prompt: put that suggestion in the box to edit, then **Enter** to send. A quick `1` + Enter sends it straight away.
- **`4`**: three new suggestions, avoiding the ones you passed over.
- Typing normally works as usual; the suggestions stay until you send a message.

The suggestions come from your session's own model, reusing the conversation it already has cached, so they know everything Claude knows about the work. Each turn costs one extra short model call. It replaces Claude Code's built-in single suggestion.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install next-prompts --marketplace Eoely/next-prompts
```

Answer `y` to add the marketplace, then pick a scope (user scope loads it in every session).

From a shell:

```
claude plugin install next-prompts --marketplace Eoely/next-prompts
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `Eoely/next-prompts`, then Add plugin.

This repository is private: installing needs read access to it on GitHub and a git credential for github.com on your machine (an SSH key, or `gh auth login` then `gh auth setup-git`).
