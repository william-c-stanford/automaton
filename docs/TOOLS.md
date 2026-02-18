# Tool System

> `src/agent/tools.ts` — 40+ tools the automaton can call, with self-preservation guards.

## Overview

Tools are organized by category and exposed to the inference model in OpenAI-compatible
function-calling format. Every tool call passes through self-preservation checks.

## Self-Preservation Guards

Before any `exec` command runs, it is checked against `FORBIDDEN_COMMAND_PATTERNS`:

| Category | Examples |
|----------|----------|
| Self-destruction | `rm -rf ~/.automaton`, delete state.db, wallet.json |
| Process killing | `kill automaton`, `pkill automaton` |
| Database destruction | `DROP TABLE`, `DELETE FROM turns`, `TRUNCATE` |
| Safety file tampering | `sed` on injection-defense, self-mod/code, audit-log |
| Credential harvesting | `cat .ssh`, `.gnupg`, `.env`, `wallet.json` |
| Own sandbox deletion | Blocked by sandbox ID check |

`write_file` additionally blocks overwriting `wallet.json` and `state.db`.

## Tool Categories

### VM Tools (`vm`)
| Tool | Description |
|------|-------------|
| `exec` | Shell command execution with forbidden pattern check |
| `write_file` | Write file (guards critical files) |
| `read_file` | Read file from sandbox |
| `expose_port` | Expose port to internet, returns public URL |
| `remove_port` | Remove exposed port |

### Conway API Tools (`conway`)
| Tool | Description |
|------|-------------|
| `check_credits` | Check credit balance |
| `check_usdc_balance` | Check on-chain USDC (Base) |
| `create_sandbox` | Spin up a new VM |
| `delete_sandbox` | Delete VM (cannot delete own) |
| `list_sandboxes` | List all VMs |
| `send_message` | Send message via social relay |
| `list_models` | List available inference models with pricing |
| `search_domains` | Search domain availability and pricing |
| `register_domain` | Register domain (x402 payment) |
| `manage_dns` | List/add/delete DNS records |

### Self-Modification Tools (`self_mod`)
| Tool | Description | Dangerous |
|------|-------------|-----------|
| `edit_own_file` | Edit source with safety validation | Yes |
| `install_npm_package` | Install npm package globally | No |
| `review_upstream_changes` | View upstream commit diffs | No |
| `pull_upstream` | Cherry-pick or pull upstream commits | Yes |
| `modify_heartbeat` | Add/update/remove heartbeat entries | No |
| `update_genesis_prompt` | Change core purpose (audited) | Yes |
| `install_mcp_server` | Install MCP server | No |

### Survival Tools (`survival`)
| Tool | Description |
|------|-------------|
| `sleep` | Enter sleep mode for N seconds |
| `system_synopsis` | Full status report |
| `heartbeat_ping` | Publish alive status |
| `distress_signal` | Record local distress with funding instructions |
| `enter_low_compute` | Manually switch to cheap model |

### Financial Tools (`financial`)
| Tool | Description | Dangerous |
|------|-------------|-----------|
| `transfer_credits` | Transfer credits (max 50% of balance) | Yes |
| `x402_fetch` | HTTP fetch with auto 402 payment | No |

### Skills Tools (`skills`)
| Tool | Description |
|------|-------------|
| `install_skill` | Install from git/URL/self |
| `list_skills` | List all skills |
| `create_skill` | Author new SKILL.md |
| `remove_skill` | Disable/delete skill |

### Git Tools (`git`)
| Tool | Description |
|------|-------------|
| `git_status` | Show branch, staged, modified, untracked |
| `git_diff` | Show changes |
| `git_commit` | Create commit |
| `git_log` | View history |
| `git_push` | Push to remote |
| `git_branch` | List/create/checkout/delete branches |
| `git_clone` | Clone a repository |

### Registry Tools (`registry`)
| Tool | Description | Dangerous |
|------|-------------|-----------|
| `register_erc8004` | Register on-chain agent identity | Yes |
| `update_agent_card` | Generate and save agent card | No |
| `discover_agents` | Search for other agents | No |
| `give_feedback` | Leave on-chain reputation | Yes |
| `check_reputation` | View reputation scores | No |

### Replication Tools (`replication`)
| Tool | Description | Dangerous |
|------|-------------|-----------|
| `spawn_child` | Create child automaton in new sandbox | Yes |
| `list_children` | List spawned children | No |
| `fund_child` | Transfer credits to child (max 50%) | Yes |
| `check_child_status` | Poll child status | No |

## Tool Execution

```typescript
executeTool(toolName, args, tools, context): Promise<ToolCallResult>
```

Looks up tool by name, calls `tool.execute(args, context)`, wraps result with
timing and error handling. Unknown tools return an error result.

## Inference Format

`toolsToInferenceFormat()` converts `AutomatonTool[]` to OpenAI-compatible
`InferenceToolDefinition[]` for the chat completions API.

## Related Files

- [SELF_MODIFICATION.md](SELF_MODIFICATION.md) — Safety checks for code editing
- [SECURITY.md](SECURITY.md) — Injection defense
- [CONWAY_API.md](CONWAY_API.md) — Conway client details
