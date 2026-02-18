# Heartbeat Daemon

> `src/heartbeat/` — Background cron system that runs even while the agent sleeps.

## Overview

The heartbeat is the automaton's pulse. It runs periodic tasks on cron schedules
independently of the agent loop. It can wake the agent when needed.

## Architecture

### Daemon (`daemon.ts`)

`createHeartbeatDaemon()` returns a daemon with `start()`, `stop()`, `isRunning()`,
and `forceRun(taskName)`.

The daemon ticks every second, checks each enabled heartbeat entry's schedule against
the current time using `cron-parser`, and executes overdue tasks.

In **low-compute mode**, only essential tasks run: `heartbeat_ping`, `check_credits`,
`check_usdc_balance`.

### Config (`config.ts`)

Heartbeat configuration lives in `~/.automaton/heartbeat.yml`. YAML format:

```yaml
entries:
  - name: heartbeat_ping
    schedule: "*/15 * * * *"
    task: heartbeat_ping
    enabled: true
  - name: check_credits
    schedule: "0 */6 * * *"
    task: check_credits
    enabled: true
```

`syncHeartbeatToDb()` syncs YAML config to the database, merging new entries
without overwriting existing ones.

### Default Schedule

| Task | Schedule | Purpose |
|------|----------|---------|
| `heartbeat_ping` | Every 15 min | Broadcast alive status |
| `check_credits` | Every 6 hours | Monitor credit balance |
| `check_usdc_balance` | Every 5 min | Monitor on-chain USDC |
| `check_for_updates` | Every 4 hours | Fetch upstream git changes |
| `health_check` | Every 30 min | Verify sandbox accessibility |
| `check_social_inbox` | Every 2 min | Poll for new messages |

## Built-in Tasks (`tasks.ts`)

### `heartbeat_ping`
Records status payload to KV store: name, address, state, credits, uptime, version.

### `check_credits`
Fetches credit balance. If tier changes from previous check, records transition.
Triggers `shouldWake: true` if transitioning to critical or dead.

### `check_usdc_balance`
Checks on-chain USDC. If balance dropped AND credits are low, wakes the agent
so it can top up credits.

### `check_social_inbox`
Polls social relay for new messages. Deduplicates against existing inbox.
Wakes agent if new messages arrive.

### `check_for_updates`
Runs `git fetch origin` and checks how many commits behind. Stores upstream
status in KV store for display in system prompt. Does NOT auto-pull.

### `health_check`
Runs `echo ok` in sandbox. If it fails, logs the error.

## Wake Mechanism

Tasks return `{ result: string, shouldWake: boolean }`. When `shouldWake` is true,
the daemon calls `onWakeRequest(reason)`, which sets `wake_request` in the KV store.
The main run loop checks this during sleep intervals and breaks out of sleep.

## Related Files

- [SURVIVAL.md](SURVIVAL.md) — Credit monitoring and tier transitions
- [SOCIAL.md](SOCIAL.md) — Inbox polling details
- [AGENT_LOOP.md](AGENT_LOOP.md) — Wake/sleep cycle
