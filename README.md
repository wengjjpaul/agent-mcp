# agent-mcp

A shared database of AI agents, exposed over [MCP](https://modelcontextprotocol.io/).

Define your agents once — their instructions, personality, tools, and skills — then access them from any MCP client: VS Code, Claude Desktop, OpenCode, or your own.

## Why?

Most AI setups scatter agent definitions across config files, prompts, and codebases. **agent-mcp** puts them in one PostgreSQL (or SQLite) database that any MCP-compatible tool can read and write.

- One source of truth for all your agents
- Works with any MCP client out of the box
- Share the same agents across VS Code, Claude Desktop, and more
- Full CRUD — create, read, update, delete

## Quick Start

```bash
npx @wengjjpaul/agent-mcp
```

That's it. Point your MCP client at it (see below) and start managing agents.

## Setup

### Prerequisites

- **Node.js 18+**

### VS Code

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "agent-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@wengjjpaul/agent-mcp"],
      "env": {
        "DATABASE_URL": "postgresql://user:password@localhost:5432/agents"
      }
    }
  }
}
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agent-mcp": {
      "command": "npx",
      "args": ["-y", "@wengjjpaul/agent-mcp"],
      "env": {
        "DATABASE_URL": "postgresql://user:password@localhost:5432/agents"
      }
    }
  }
}
```

> **Tip:** Use the same `DATABASE_URL` across all your MCP clients to share one agent database.

### SQLite (optional)

If you prefer a local file database, set `AGENT_MCP_DB_PATH` instead of `DATABASE_URL`:

```json
{
  "env": {
    "AGENT_MCP_DB_PATH": "/path/to/your/agents.db"
  }
}
```

## Usage

Once connected, talk to your MCP client naturally:

| You say | What happens |
|---------|--------------|
| *"What agents do I have?"* | `list_agents` → shows all agents |
| *"Show me the code-reviewer agent"* | `get_agent` → full agent details |
| *"Create an agent for security-focused code review"* | `create_agent` → LLM gathers details, then saves |
| *"Update code-reviewer to also check performance"* | `update_agent` → modifies specific fields |
| *"Delete the old test agent"* | `delete_agent` → removes it |

### Naming Your Agents

Every agent can have a human-friendly `display_name` (e.g. "Bob", "Maya the Reviewer"). You can then address agents by their name directly:

| You say | What happens |
|---------|--------------|
| *"Create a research assistant named Bob"* | Creates agent with `display_name: "Bob"` |
| *"hi bob, how are you?"* | `ask_agent("Bob", ...)` → returns Bob's persona + your message as a prompt; LLM responds as Bob |
| *"bob, what do you do?"* | `ask_agent("Bob", ...)` → Bob describes his capabilities in character |
| *"Can you ask bob to write a story"* | `ask_agent("Bob", ...)` → Bob writes a story in his own voice |
| *"Rename Bob to Bobby"* | `update_agent("Bob", { display_name: "Bobby" })` |
| *"What can Maya do?"* | `get_agent("Maya")` → looks up agent by display name |

Agent lookup works by ID, `name` (the slug identifier), or `display_name` — all case-insensitive.

## Tools

| Tool | Description |
|------|-------------|
| `list_agents` | List all agents with name, description, and creation date |
| `get_agent` | Get full details of an agent by name, display name, or ID |
| `create_agent` | Create a new agent (name required, all other fields optional) |
| `update_agent` | Update any fields on an existing agent |
| `delete_agent` | Delete an agent by name, display name, or ID |
| `ask_agent` | Talk to an agent — returns the agent's persona + your message as a prompt for the LLM to respond in character |

## Agent Schema

Each agent is defined by:

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | **Required.** Unique identifier (e.g. `code-reviewer`) |
| `display_name` | `string` | Human-friendly name (e.g. `Bob`, `Maya the Reviewer`) |
| `description` | `string` | Short summary of what the agent does |
| `instructions` | `string` | Detailed behavioral instructions and workflow |
| `soul` | `string` | Personality, tone, and communication style |
| `tools` | `string` | Tools and capabilities available to the agent |
| `skills` | `string` | Skills the agent possesses |

## Local Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run (PostgreSQL)
DATABASE_URL=postgresql://user:password@localhost:5432/agents npm start

# Run (SQLite)
AGENT_MCP_DB_PATH=./agents.db npm start
```

For local dev, point your MCP client at the local build instead of npx:

```json
{
  "servers": {
    "agent-mcp": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/agent-mcp/dist/index.js"],
      "env": {
        "DATABASE_URL": "postgresql://user:password@localhost:5432/agents"
      }
    }
  }
}
```

## License

ISC
