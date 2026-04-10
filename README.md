# agent-mcp

An MCP (Model Context Protocol) server that manages a database of AI agents. Each agent stores its instructions, soul/personality, tools, and skills in a shared SQLite database — so any MCP-compatible client (VS Code, Claude Desktop, etc.) can access the same set of agents.

## Features

- **List agents** — see all agents in your database
- **Get agent details** — view full instructions, soul, tools, and skills
- **Create agents** — add new agents with structured definitions
- **Update agents** — modify any field on existing agents
- **Delete agents** — remove agents from the database

## Setup

### Prerequisites

- Node.js 18+
- An MCP-compatible client (VS Code with Copilot, Claude Desktop, etc.)

### Configure your MCP client

Add the following to your MCP client configuration. The `AGENT_MCP_DB_PATH` environment variable is **required** — it points to the SQLite database file where agents are stored.

#### VS Code (`.vscode/mcp.json`)

```json
{
  "servers": {
    "agent-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "agent-mcp"],
      "env": {
        "AGENT_MCP_DB_PATH": "/path/to/your/agents.db"
      }
    }
  }
}
```

#### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "agent-mcp": {
      "command": "npx",
      "args": ["-y", "agent-mcp"],
      "env": {
        "AGENT_MCP_DB_PATH": "/path/to/your/agents.db"
      }
    }
  }
}
```

> **Tip:** Use the same `AGENT_MCP_DB_PATH` across all your MCP clients so every harness shares the same agent database.

### Local development

```bash
# Clone and install
npm install

# Build
npm run build

# Run directly (for testing)
AGENT_MCP_DB_PATH=./agents.db npm start
```

For local dev, point the MCP client at your local build:

```json
{
  "servers": {
    "agent-mcp": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/agent-mcp/dist/index.js"],
      "env": {
        "AGENT_MCP_DB_PATH": "/path/to/your/agents.db"
      }
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `list_agents` | List all agents with name, description, and creation date |
| `get_agent` | Get full details of an agent by name or ID |
| `create_agent` | Create a new agent with name, description, instructions, soul, tools, skills |
| `update_agent` | Update any fields on an existing agent |
| `delete_agent` | Delete an agent by name or ID |

## Agent Schema

Each agent has the following fields:

| Field | Description |
|-------|-------------|
| `name` | Unique name for the agent (e.g. `code-reviewer`) |
| `description` | Short summary of what the agent does |
| `instructions` | Detailed behavioral instructions and workflow |
| `soul` | Personality, tone, and communication style |
| `tools` | Tools/capabilities available to the agent |
| `skills` | Skills the agent possesses |

## Example Usage

Once configured, you can interact with the agent database through your MCP client:

- *"What agents do I have?"* — calls `list_agents`
- *"Show me the code-reviewer agent"* — calls `get_agent`
- *"Create an agent for code review that focuses on security"* — the LLM will ask for details then call `create_agent`
- *"Update the code-reviewer's instructions to also check for performance"* — calls `update_agent`

## License

ISC
