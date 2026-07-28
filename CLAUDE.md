## Committing as the Ledewire bot identity

If `GH_TOKEN` is set in the environment (this session was launched via `ledewire-claude`), you
are authenticated as `ledewire-claude-code[bot]`, not a human. Push using the tokenized HTTPS
URL instead of `git push origin`:

```
git push https://x-access-token:$GH_TOKEN@github.com/ledewire/ledewire-js-sdk.git HEAD:<branch-name>
```

`gh pr create` and other `gh`/API calls pick up `GH_TOKEN` automatically — no change needed there.

If `GH_TOKEN` is not set, push normally via `origin` (SSH) as usual.
