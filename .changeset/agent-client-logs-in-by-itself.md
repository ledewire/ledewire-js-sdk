---
'@ledewire/node': minor
---

`createAgentClient({ key, secret })` now logs in by itself with the buyer key on the first authenticated call, as its documentation always said, and logs in again (retrying the call once) when a refresh fails. Calling `agent.auth.loginWithBuyerApiKey()` yourself still works and is no longer needed.
