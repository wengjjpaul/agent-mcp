import Database from "better-sqlite3";
import path from "path";
import pg from "pg";

export interface Agent {
  id: number;
  name: string;
  description: string | null;
  instructions: string | null;
  soul: string | null;
  tools: string | null;
  skills: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAgentInput {
  name: string;
  description?: string;
  instructions?: string;
  soul?: string;
  tools?: string;
  skills?: string;
}

export interface UpdateAgentInput {
  name?: string;
  description?: string;
  instructions?: string;
  soul?: string;
  tools?: string;
  skills?: string;
}

interface DbAdapter {
  listAgents(): Promise<Agent[]>;
  getAgent(idOrName: string): Promise<Agent | undefined>;
  createAgent(input: CreateAgentInput): Promise<Agent>;
  updateAgent(idOrName: string, input: UpdateAgentInput): Promise<Agent | undefined>;
  deleteAgent(idOrName: string): Promise<boolean>;
}

let adapter: DbAdapter | null = null;

function getAdapter(): DbAdapter {
  if (!adapter) throw new Error("Database not initialized. Call initDatabase first.");
  return adapter;
}

// ---- SQLite adapter ----

function createSqliteAdapter(dbPath: string): DbAdapter {
  const resolvedPath = path.resolve(dbPath);
  const db = new Database(resolvedPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      instructions TEXT,
      soul TEXT,
      tools TEXT,
      skills TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  function getSync(idOrName: string): Agent | undefined {
    const asNum = Number(idOrName);
    if (!isNaN(asNum) && String(asNum) === idOrName) {
      const byId = db.prepare("SELECT * FROM agents WHERE id = ?").get(asNum) as Agent | undefined;
      if (byId) return byId;
    }
    return db.prepare("SELECT * FROM agents WHERE name = ? COLLATE NOCASE").get(idOrName) as Agent | undefined;
  }

  return {
    async listAgents() {
      return db.prepare("SELECT * FROM agents ORDER BY name").all() as Agent[];
    },
    async getAgent(idOrName) {
      return getSync(idOrName);
    },
    async createAgent(input) {
      const result = db.prepare(`
        INSERT INTO agents (name, description, instructions, soul, tools, skills)
        VALUES (@name, @description, @instructions, @soul, @tools, @skills)
      `).run({
        name: input.name,
        description: input.description ?? null,
        instructions: input.instructions ?? null,
        soul: input.soul ?? null,
        tools: input.tools ?? null,
        skills: input.skills ?? null,
      });
      return getSync(String(result.lastInsertRowid))!;
    },
    async updateAgent(idOrName, input) {
      const existing = getSync(idOrName);
      if (!existing) return undefined;

      const fields: string[] = [];
      const values: Record<string, unknown> = { id: existing.id };

      for (const key of ["name", "description", "instructions", "soul", "tools", "skills"] as const) {
        if (input[key] !== undefined) {
          fields.push(`${key} = @${key}`);
          values[key] = input[key];
        }
      }

      if (fields.length === 0) return existing;

      fields.push("updated_at = datetime('now')");
      db.prepare(`UPDATE agents SET ${fields.join(", ")} WHERE id = @id`).run(values);
      return getSync(String(existing.id));
    },
    async deleteAgent(idOrName) {
      const existing = getSync(idOrName);
      if (!existing) return false;
      db.prepare("DELETE FROM agents WHERE id = ?").run(existing.id);
      return true;
    },
  };
}

// ---- PostgreSQL adapter ----

function toIsoString(val: unknown): string {
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function rowToAgent(row: Record<string, unknown>): Agent {
  return {
    id: row.id as number,
    name: row.name as string,
    description: (row.description ?? null) as string | null,
    instructions: (row.instructions ?? null) as string | null,
    soul: (row.soul ?? null) as string | null,
    tools: (row.tools ?? null) as string | null,
    skills: (row.skills ?? null) as string | null,
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
  };
}

async function createPostgresAdapter(connectionString: string): Promise<DbAdapter> {
  const pool = new pg.Pool({ connectionString });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS agents (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      instructions TEXT,
      soul TEXT,
      tools TEXT,
      skills TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  async function getById(id: number): Promise<Agent | undefined> {
    const res = await pool.query("SELECT * FROM agents WHERE id = $1", [id]);
    return res.rows[0] ? rowToAgent(res.rows[0]) : undefined;
  }

  async function getSync(idOrName: string): Promise<Agent | undefined> {
    const asNum = Number(idOrName);
    if (!isNaN(asNum) && String(asNum) === idOrName) {
      const res = await pool.query("SELECT * FROM agents WHERE id = $1", [asNum]);
      if (res.rows[0]) return rowToAgent(res.rows[0]);
    }
    const res = await pool.query("SELECT * FROM agents WHERE lower(name) = lower($1)", [idOrName]);
    return res.rows[0] ? rowToAgent(res.rows[0]) : undefined;
  }

  return {
    async listAgents() {
      const res = await pool.query("SELECT * FROM agents ORDER BY name");
      return res.rows.map(rowToAgent);
    },
    async getAgent(idOrName) {
      return getSync(idOrName);
    },
    async createAgent(input) {
      const res = await pool.query(
        `INSERT INTO agents (name, description, instructions, soul, tools, skills)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [input.name, input.description ?? null, input.instructions ?? null,
         input.soul ?? null, input.tools ?? null, input.skills ?? null]
      );
      return (await getById(res.rows[0].id))!;
    },
    async updateAgent(idOrName, input) {
      const existing = await getSync(idOrName);
      if (!existing) return undefined;

      const setClauses: string[] = [];
      const values: unknown[] = [];

      for (const key of ["name", "description", "instructions", "soul", "tools", "skills"] as const) {
        if (input[key] !== undefined) {
          values.push(input[key]);
          setClauses.push(`${key} = $${values.length}`);
        }
      }

      if (setClauses.length === 0) return existing;

      setClauses.push("updated_at = NOW()");
      values.push(existing.id);
      await pool.query(
        `UPDATE agents SET ${setClauses.join(", ")} WHERE id = $${values.length}`,
        values
      );
      return getById(existing.id);
    },
    async deleteAgent(idOrName) {
      const existing = await getSync(idOrName);
      if (!existing) return false;
      await pool.query("DELETE FROM agents WHERE id = $1", [existing.id]);
      return true;
    },
  };
}

// ---- Public API ----

export async function initDatabase(): Promise<void> {
  const pgUrl = process.env.DATABASE_URL;
  const sqlitePath = process.env.AGENT_MCP_DB_PATH;

  if (pgUrl) {
    adapter = await createPostgresAdapter(pgUrl);
  } else if (sqlitePath) {
    adapter = createSqliteAdapter(sqlitePath);
  } else {
    throw new Error(
      "Database not configured. Set DATABASE_URL for PostgreSQL or AGENT_MCP_DB_PATH for SQLite."
    );
  }
}

export async function listAgents(): Promise<Agent[]> {
  return getAdapter().listAgents();
}

export async function getAgent(idOrName: string): Promise<Agent | undefined> {
  return getAdapter().getAgent(idOrName);
}

export async function createAgent(input: CreateAgentInput): Promise<Agent> {
  return getAdapter().createAgent(input);
}

export async function updateAgent(idOrName: string, input: UpdateAgentInput): Promise<Agent | undefined> {
  return getAdapter().updateAgent(idOrName, input);
}

export async function deleteAgent(idOrName: string): Promise<boolean> {
  return getAdapter().deleteAgent(idOrName);
}
