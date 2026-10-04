# tanel-2

Hardened remote terminal bridge for **Z.ai Code** sandboxes.

Lets the sandbox run commands on your local terminal (with your permission) and read the results back — so the AI assistant can help with local dev tasks.

## Why tanel-2?

The original `tanel` used a hardcoded public password (`tanel-2024`). Anyone who read the repo could queue commands on your machine. `tanel-2` fixes that:

- **Random 32-char token per sandbox** — generated at install time, stored in the sandbox's `.env`, never in code.
- **Auth required on every endpoint** — `Authorization: Bearer <token>` header, constant-time compared.
- **Multi-channel support** — run multiple pollers (e.g. Termux + AndroidIDE on the same phone) and target commands to a specific one.
- **Nothing in the repo is a secret** — the poller script, setup script, and route files are all safe to be public.

## Setup (on the sandbox)

Ask the Z.ai assistant to run:

```bash
curl -sL https://raw.githubusercontent.com/arun6a/tanel-2/main/setup.sh | bash
```

Or review [`setup.sh`](setup.sh) first and run it manually — it just creates API routes, generates a token, and prints a connection command.

## Connect your terminal

After setup, the sandbox prints a command like:

```bash
curl -s https://raw.githubusercontent.com/arun6a/tanel-2/main/poll.cjs > poll.cjs
TOKEN=<token-from-sandbox> BASE_URL=<sandbox-url> CHANNEL=default node poll.cjs
```

Run that on any machine with Node.js installed (laptop, Termux, AndroidIDE-Rv2, server, etc.). Leave it running. The sandbox can now send commands to your terminal and read the output.

### Multiple terminals (channels)

If you have more than one terminal (e.g. Termux and AndroidIDE on the same phone), give each a different `CHANNEL`:

```bash
# Terminal 1 (Termux)
TOKEN=<token> BASE_URL=<sandbox-url> CHANNEL=termux node poll.cjs

# Terminal 2 (AndroidIDE)
TOKEN=<token> BASE_URL=<sandbox-url> CHANNEL=ide node poll.cjs
```

The sandbox can then target commands to a specific terminal by passing `channel` in the queue request. Commands without a channel go to the `default` channel and are picked up by any poller that didn't set a channel.

## How it works

```
sandbox                       your terminal(s)
  |                              |
  |-- POST /api/remote-cmd/queue {cmd:"ls", channel:"ide"}  --> ide queue
  |                              |
  |                              <-- GET /api/remote-cmd/pending?channel=ide (polls every 1.5s)
  |                              |   returns {cmd:"ls"}
  |                              |
  |                              |   exec("ls") locally
  |                              |
  |                              --> POST /api/remote-cmd/result {result:"...", channel:"ide"}
  |                              |
  <-- GET /api/remote-cmd/result |
  |   returns the latest result  |
```

All command endpoints require the Bearer token. Health check and the poller download are public.

## Files

| File | Purpose |
|------|---------|
| [`setup.sh`](setup.sh) | Run on the sandbox — installs routes, generates token, prints connect command |
| [`poll.cjs`](poll.cjs) | Run on your terminal — polls for commands, executes them, posts results |
| [`templates/`](templates/) | The Next.js API route files + shared lib, downloaded by setup.sh |

## Security notes

- The token is stored in `/home/z/my-project/.env` on the sandbox. It's local to that sandbox — a new sandbox gets a new token.
- The poller executes commands with your local user's privileges. Review commands before leaving the poller unattended.
- The queue and result are in-memory and reset if the sandbox's Next.js dev server restarts.
- If you need to rotate the token: re-run `setup.sh` (it overwrites `TANEL_TOKEN` in `.env`).

## License

MIT
