# Oscribble MCP Server

Model Context Protocol (MCP) server for [Oscribble](https://github.com/oscargavin/oscribble) - enables Claude Code to interact with your Oscribble task projects through natural language.

## What is this?

This MCP server exposes your Oscribble tasks to Claude Code, allowing you to:

- List and filter tasks across projects
- Complete or uncomplete tasks
- View detailed task metadata (priorities, blockers, notes)
- Add new tasks to projects
- Query task status and dependencies

All through natural language conversation in Claude Code.

## Installation

### Quick Start (Recommended)

Add this to your Claude Code MCP configuration (`~/.claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "oscribble": {
      "command": "npx",
      "args": ["-y", "@oscargavin/oscribble-mcp"]
    }
  }
}
```

Restart Claude Code and the MCP server will be available.

### Manual Installation

```bash
npm install -g @oscargavin/oscribble-mcp
```

Then configure Claude Code to use the installed binary:

```json
{
  "mcpServers": {
    "oscribble": {
      "command": "oscribble-mcp"
    }
  }
}
```

## Available Tools

### `oscribble_list_projects`

List all Oscribble projects with paths and last accessed timestamps.

**Example:** "Show me all my Oscribble projects"

### `oscribble_list_tasks`

List tasks from a project with optional status filtering.

**Parameters:**
- `project_name` (string, required) - Name of the project
- `filter_status` (string, optional) - Filter by `"all"`, `"checked"`, or `"unchecked"` (default: `"all"`)

**Examples:**
- "List all tasks in my work project"
- "Show unchecked tasks in oscribble"
- "What tasks are incomplete in my-project?"

### `oscribble_complete_task`

Mark a task as complete.

**Parameters:**
- `project_name` (string, required) - Name of the project
- `task_id` (string, required) - UUID of the task

**Example:** "Complete task abc-123 in my work project"

### `oscribble_uncomplete_task`

Mark a task as incomplete.

**Parameters:**
- `project_name` (string, required) - Name of the project
- `task_id` (string, required) - UUID of the task

**Example:** "Uncomplete task abc-123 in my work project"

### `oscribble_get_task_details`

Get detailed information about a specific task including metadata, notes, and blockers.

**Parameters:**
- `project_name` (string, required) - Name of the project
- `task_id` (string, required) - UUID of the task

**Example:** "Show me details for task abc-123 in oscribble"

### `oscribble_add_raw_task`

Add raw task text to a project. The task will be formatted by Oscribble on next sync.

**Parameters:**
- `project_name` (string, required) - Name of the project
- `task_text` (string, required) - Raw task text to append

**Example:** "Add 'Implement dark mode' to my work project"

## Usage Examples

Here are some natural language queries you can use with Claude Code once the MCP server is configured:

```
"What tasks are blocked in oscribble?"
"Show me all critical priority tasks"
"List unchecked tasks across all projects"
"Complete the task about implementing dark mode"
"Add a new task to fix the login bug in my-app"
"What's the status of task abc-123?"
```

## How It Works

The MCP server reads and writes to the same storage location as the Oscribble desktop app (`~/.project-stickies/`), using:

- **Atomic writes** - Temp file + rename pattern prevents data corruption
- **Safe concurrent access** - Read operations work while the Oscribble app is open
- **Identical data structures** - Uses the same TypeScript types as the main app

### Storage Structure

```
~/.project-stickies/
├── settings.json         # App-wide settings
├── projects.json         # Project registry
└── {project-name}/
    ├── notes.json        # Structured tasks (read/write)
    ├── raw.txt           # Raw input (write for new tasks)
    └── .context-cache/   # (Future use)
```

## Development

### Building from Source

```bash
git clone https://github.com/oscargavin/oscribble-mcp.git
cd oscribble-mcp
npm install
npm run build
```

### Project Structure

```
src/
├── index.ts       # Main MCP server implementation
├── types.ts       # TypeScript type definitions
└── utils.ts       # Utility functions (file I/O, task operations)
```

### Testing Locally

After building, you can test the server locally by updating your Claude Code config to point to the built file:

```json
{
  "mcpServers": {
    "oscribble": {
      "command": "node",
      "args": ["/path/to/oscribble-mcp/build/index.js"]
    }
  }
}
```

## Troubleshooting

### "No projects found"

Make sure you've created at least one project in the Oscribble desktop app first. The MCP server reads from `~/.project-stickies/projects.json`.

### "Project not found"

Project names are case-sensitive. Use `oscribble_list_projects` to see the exact project names available.

### "Notes file doesn't exist"

This project hasn't been formatted yet. Open the project in the Oscribble desktop app and format some tasks first.

### MCP server not showing in Claude Code

1. Check your `~/.claude/claude_desktop_config.json` syntax is valid JSON
2. Restart Claude Code completely (quit and reopen)
3. Check Claude Code logs at `~/Library/Logs/Claude/mcp.log` (macOS)

## Requirements

- **Node.js** 18+ (for npx installation)
- **Oscribble desktop app** - This MCP server is a companion to the main app

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Issues and pull requests welcome at [github.com/oscargavin/oscribble-mcp](https://github.com/oscargavin/oscribble-mcp).

## Related

- [Oscribble Desktop App](https://github.com/oscargavin/oscribble) - The main task manager application
- [Model Context Protocol](https://modelcontextprotocol.io/) - Learn more about MCP
- [Claude Code](https://docs.claude.com/claude-code) - AI-powered coding assistant
