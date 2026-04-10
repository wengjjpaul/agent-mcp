#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  initDatabase,
  listAgents,
  getAgent,
  createAgent,
  updateAgent,
  deleteAgent,
} from "./db.js";



const server = new McpServer(
  { name: "agent-mcp", version: "1.0.0" },
  {
    instructions: [
      "This server manages a database of AI agents. Each agent has a name, display_name, description, instructions, soul, tools, and skills.",
      "Use the CRUD tools (list_agents, get_agent, create_agent, update_agent, delete_agent) to manage agent definitions.",
      "",
      "To INTERACT with an agent, use ask_agent — it returns the agent's full persona and your message formatted as a prompt.",
      "When a user addresses an agent by display_name or name (e.g. 'Bob, help me research this topic'), call ask_agent.",
      "Read the returned prompt carefully and respond as that agent: follow their instructions, embody their soul, stay in character.",
    ].join("\n"),
  }
);

// --- Tool: list_agents ---
server.registerTool(
  "list_agents",
  {
    title: "List Agents",
    description:
      "List all agents in the database. Returns a summary of each agent including name, description, and when it was created.",
  },
  async () => {
    const agents = await listAgents();
    if (agents.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: "You have no agents yet. Use the create_agent tool to create one.",
          },
        ],
      };
    }

    const summary = agents
      .map(
        (a, i) =>
          `${i + 1}. **${a.name}**${a.display_name ? ` (${a.display_name})` : ""}${a.description ? ` — ${a.description}` : ""} (created: ${a.created_at})`
      )
      .join("\n");

    return {
      content: [
        {
          type: "text" as const,
          text: `You have ${agents.length} agent${agents.length === 1 ? "" : "s"}:\n\n${summary}`,
        },
      ],
    };
  }
);

// --- Tool: get_agent ---
server.registerTool(
  "get_agent",
  {
    title: "Get Agent Details",
    description:
      "Get full details of a specific agent by name or ID, including its instructions, soul, tools, and skills.",
    inputSchema: {
      agent: z
        .string()
        .describe("The name or ID of the agent to retrieve"),
    },
  },
  async ({ agent: idOrName }) => {
    const agent = await getAgent(idOrName);
    if (!agent) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Agent "${idOrName}" not found. Use list_agents to see available agents.`,
          },
        ],
      };
    }

    const displayLabel = agent.display_name ?? agent.name;

    const sections = [
      `# ${displayLabel}` + (agent.display_name ? ` (${agent.name})` : ""),
      agent.description ? `**Description:** ${agent.description}` : null,
      agent.instructions
        ? `## Instructions\n${agent.instructions}`
        : null,
      agent.soul ? `## Soul\n${agent.soul}` : null,
      agent.tools ? `## Tools\n${agent.tools}` : null,
      agent.skills ? `## Skills\n${agent.skills}` : null,
      `\n_Created: ${agent.created_at} | Updated: ${agent.updated_at}_`,
    ]
      .filter(Boolean)
      .join("\n\n");

    return {
      content: [{ type: "text" as const, text: sections }],
    };
  }
);

// --- Tool: create_agent ---
server.registerTool(
  "create_agent",
  {
    title: "Create Agent",
    description:
      "Create a new agent in the database. Provide a name (required) and optionally a description, instructions, soul, tools definition, and skills definition. If the user hasn't provided all details, ask them follow-up questions before calling this tool. Every agent should have a display_name — a human-friendly name (e.g. 'Alex', 'Maya the Reviewer'). If the user didn't provide one, suggest a fitting name before calling this tool.",
    inputSchema: {
      name: z
        .string()
        .min(1)
        .describe("Unique name for the agent (e.g. 'code-reviewer')"),
      display_name: z
        .string()
        .optional()
        .describe(
          "A human-friendly name for the agent (e.g. 'Alex', 'Maya the Reviewer'). If the user didn't provide one, suggest a fitting name."
        ),
      description: z
        .string()
        .optional()
        .describe(
          "Short description of what this agent does"
        ),
      instructions: z
        .string()
        .optional()
        .describe(
          "Detailed instructions that define the agent's behavior and workflow"
        ),
      soul: z
        .string()
        .optional()
        .describe(
          "The agent's personality, tone, and communication style"
        ),
      tools: z
        .string()
        .optional()
        .describe(
          "Description of tools/capabilities available to this agent (as text/markdown)"
        ),
      skills: z
        .string()
        .optional()
        .describe(
          "Description of skills this agent possesses (as text/markdown)"
        ),
    },
  },
  async ({ name, display_name, description, instructions, soul, tools, skills }) => {
    try {
      const agent = await createAgent({
        name,
        display_name,
        description,
        instructions,
        soul,
        tools,
        skills,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: `Agent "${agent.name}" created successfully (ID: ${agent.id}).\n\nUse get_agent to view the full details, or update_agent to modify it.`,
          },
        ],
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : String(err);
      if (message.includes("UNIQUE constraint") || message.includes("unique constraint") || message.includes("23505")) {
        return {
          content: [
            {
              type: "text" as const,
              text: `An agent named "${name}" already exists. Use a different name or update_agent to modify the existing one.`,
            },
          ],
        };
      }
      return {
        content: [
          { type: "text" as const, text: `Error creating agent: ${message}` },
        ],
        isError: true,
      };
    }
  }
);

// --- Tool: update_agent ---
server.registerTool(
  "update_agent",
  {
    title: "Update Agent",
    description:
      "Update an existing agent's fields. Provide the agent name or ID and any fields to update. Only provided fields will be changed.",
    inputSchema: {
      agent: z
        .string()
        .describe("The name or ID of the agent to update"),
      name: z.string().optional().describe("New name for the agent"),
      display_name: z
        .string()
        .optional()
        .describe("New human-friendly name for the agent"),
      description: z
        .string()
        .optional()
        .describe("New description"),
      instructions: z
        .string()
        .optional()
        .describe("New instructions"),
      soul: z.string().optional().describe("New soul/personality"),
      tools: z
        .string()
        .optional()
        .describe("New tools definition"),
      skills: z
        .string()
        .optional()
        .describe("New skills definition"),
    },
  },
  async ({
    agent: idOrName,
    name,
    display_name,
    description,
    instructions,
    soul,
    tools,
    skills,
  }) => {
    const updated = await updateAgent(idOrName, {
      name,
      display_name,
      description,
      instructions,
      soul,
      tools,
      skills,
    });
    if (!updated) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Agent "${idOrName}" not found. Use list_agents to see available agents.`,
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text" as const,
          text: `Agent "${updated.name}" updated successfully.`,
        },
      ],
    };
  }
);

// --- Tool: ask_agent ---
server.registerTool(
  "ask_agent",
  {
    title: "Ask Agent",
    description:
      "Talk to an agent. Looks up the agent by name, display name, or ID, then returns a prompt combining the agent's persona with your message. Use this when a user addresses an agent directly (e.g. 'Bob, help me research AI').",
    inputSchema: {
      agent: z
        .string()
        .describe("The name, display name, or ID of the agent to talk to"),
      message: z
        .string()
        .describe("The user's message or question for the agent"),
    },
  },
  async ({ agent: idOrName, message }) => {
    const agent = await getAgent(idOrName);
    if (!agent) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Agent "${idOrName}" not found. Use list_agents to see available agents.`,
          },
        ],
      };
    }

    const displayLabel = agent.display_name ?? agent.name;
    const parts: string[] = [`You are ${displayLabel}.`];

    if (agent.description) parts.push(agent.description);
    if (agent.instructions) parts.push(`\n## Instructions\n${agent.instructions}`);
    if (agent.soul) parts.push(`\n## Personality & Tone\n${agent.soul}`);
    if (agent.tools) parts.push(`\n## Available Tools\n${agent.tools}`);
    if (agent.skills) parts.push(`\n## Skills\n${agent.skills}`);

    parts.push(`\n---\n\n**User:** ${message}`);
    parts.push(`\nRespond as ${displayLabel}. Stay in character.`);

    return {
      content: [{ type: "text" as const, text: parts.join("\n") }],
    };
  }
);

// --- Tool: delete_agent ---
server.registerTool(
  "delete_agent",
  {
    title: "Delete Agent",
    description:
      "Permanently delete an agent from the database by name or ID.",
    inputSchema: {
      agent: z
        .string()
        .describe("The name or ID of the agent to delete"),
    },
  },
  async ({ agent: idOrName }) => {
    const deleted = await deleteAgent(idOrName);
    if (!deleted) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Agent "${idOrName}" not found. Use list_agents to see available agents.`,
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text" as const,
          text: `Agent "${idOrName}" has been deleted.`,
        },
      ],
    };
  }
);

async function main() {
  await initDatabase();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("agent-mcp server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

process.on("SIGINT", async () => {
  await server.close();
  process.exit(0);
});
