#!/usr/bin/env node
/**
 * Oscribble MCP Server
 * Provides Claude Code with tools to interact with Oscribble project data.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { promises as fs } from "fs";
import { join } from "path";
import type { TaskNode, NotesFile, ProjectSettings, FilterStatus } from "./types.js";
import {
  STORAGE_ROOT,
  PROJECTS_FILE,
  loadJson,
  atomicWriteJson,
  findTaskById,
  formatTaskForDisplay,
  getProjectPath,
  fileExists,
} from "./utils.js";

// Initialize server
const server = new Server(
  {
    name: "oscribble",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool Definitions
const tools: Tool[] = [
  {
    name: "oscribble_list_projects",
    description: "List all Oscribble projects with their names, paths, and last accessed timestamps",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "oscribble_list_tasks",
    description: "List tasks from an Oscribble project with optional status filtering",
    inputSchema: {
      type: "object",
      properties: {
        project_name: {
          type: "string",
          description: "Name of the project",
        },
        filter_status: {
          type: "string",
          enum: ["all", "unchecked", "checked"],
          description: "Filter tasks by completion status (default: all)",
          default: "all",
        },
      },
      required: ["project_name"],
    },
  },
  {
    name: "oscribble_complete_task",
    description: "Mark a task as complete in an Oscribble project",
    inputSchema: {
      type: "object",
      properties: {
        project_name: {
          type: "string",
          description: "Name of the project",
        },
        task_id: {
          type: "string",
          description: "UUID of the task to complete",
        },
      },
      required: ["project_name", "task_id"],
    },
  },
  {
    name: "oscribble_uncomplete_task",
    description: "Mark a task as incomplete in an Oscribble project",
    inputSchema: {
      type: "object",
      properties: {
        project_name: {
          type: "string",
          description: "Name of the project",
        },
        task_id: {
          type: "string",
          description: "UUID of the task to uncomplete",
        },
      },
      required: ["project_name", "task_id"],
    },
  },
  {
    name: "oscribble_get_task_details",
    description: "Get detailed information about a specific task including metadata, notes, and blockers",
    inputSchema: {
      type: "object",
      properties: {
        project_name: {
          type: "string",
          description: "Name of the project",
        },
        task_id: {
          type: "string",
          description: "UUID of the task",
        },
      },
      required: ["project_name", "task_id"],
    },
  },
  {
    name: "oscribble_add_raw_task",
    description: "Add raw task text to a project (will be formatted by Oscribble on next sync)",
    inputSchema: {
      type: "object",
      properties: {
        project_name: {
          type: "string",
          description: "Name of the project",
        },
        task_text: {
          type: "string",
          description: "Raw task text to append",
        },
      },
      required: ["project_name", "task_text"],
    },
  },
];

// Tool Handlers

async function handleListProjects(): Promise<string> {
  if (!(await fileExists(PROJECTS_FILE))) {
    return "No projects found. The projects file doesn't exist yet.";
  }

  const projects = await loadJson<ProjectSettings[]>(PROJECTS_FILE);

  if (!projects || projects.length === 0) {
    return "No projects found.";
  }

  // Sort by last_accessed (most recent first)
  const projectsSorted = projects.sort((a, b) => (b.last_accessed || 0) - (a.last_accessed || 0));

  let result = "**Oscribble Projects:**\n\n";
  for (const project of projectsSorted) {
    result += `- **${project.name}**\n`;
    result += `  - Path: \`${project.path || "N/A"}\`\n`;
    result += `  - Last accessed: ${project.last_accessed || "Never"}\n\n`;
  }

  return result;
}

async function handleListTasks(projectName: string, filterStatus: FilterStatus = "all"): Promise<string> {
  const projectPath = await getProjectPath(projectName);
  const notesFile = join(projectPath, "notes.json");

  if (!(await fileExists(notesFile))) {
    return `No tasks found for project '${projectName}'. The notes file doesn't exist yet.`;
  }

  const notesData = await loadJson<NotesFile>(notesFile);
  let tasks = notesData.tasks || [];

  if (tasks.length === 0) {
    return `No tasks found in project '${projectName}'.`;
  }

  // Filter tasks based on status
  function shouldIncludeTask(task: TaskNode): boolean {
    if (filterStatus === "all") {
      return true;
    }
    const checked = task.checked || false;
    return (filterStatus === "checked" && checked) || (filterStatus === "unchecked" && !checked);
  }

  function filterTasksRecursive(taskList: TaskNode[]): TaskNode[] {
    const filtered: TaskNode[] = [];
    for (const task of taskList) {
      // Filter children first
      if (task.children && task.children.length > 0) {
        task.children = filterTasksRecursive(task.children);
      }

      // Include task if it matches or has matching children
      if (shouldIncludeTask(task) || (task.children && task.children.length > 0)) {
        filtered.push(task);
      }
    }
    return filtered;
  }

  if (filterStatus !== "all") {
    tasks = filterTasksRecursive(tasks);
  }

  if (tasks.length === 0) {
    return `No ${filterStatus} tasks found in project '${projectName}'.`;
  }

  // Format tasks for display
  let result = `**Tasks in '${projectName}' (filter: ${filterStatus}):**\n\n`;
  for (const task of tasks) {
    result += formatTaskForDisplay(task) + "\n\n";
  }

  return result;
}

async function handleCompleteTask(projectName: string, taskId: string, complete: boolean): Promise<string> {
  const projectPath = await getProjectPath(projectName);
  const notesFile = join(projectPath, "notes.json");

  if (!(await fileExists(notesFile))) {
    return `Notes file not found for project '${projectName}'.`;
  }

  const notesData = await loadJson<NotesFile>(notesFile);
  const tasks = notesData.tasks || [];

  // Find the task
  const result = findTaskById(tasks, taskId);
  if (!result) {
    return `Task with ID '${taskId}' not found in project '${projectName}'.`;
  }

  const [task] = result;

  // Update the task
  task.checked = complete;

  // Save atomically
  await atomicWriteJson(notesFile, notesData);

  const status = complete ? "completed" : "uncompleted";
  return `✓ Task '${task.text}' ${status} successfully in project '${projectName}'.`;
}

async function handleGetTaskDetails(projectName: string, taskId: string): Promise<string> {
  const projectPath = await getProjectPath(projectName);
  const notesFile = join(projectPath, "notes.json");

  if (!(await fileExists(notesFile))) {
    return `Notes file not found for project '${projectName}'.`;
  }

  const notesData = await loadJson<NotesFile>(notesFile);
  const tasks = notesData.tasks || [];

  // Find the task
  const result = findTaskById(tasks, taskId);
  if (!result) {
    return `Task with ID '${taskId}' not found in project '${projectName}'.`;
  }

  const [task] = result;

  // Format detailed information
  const metadata = task.metadata || {};

  let details = "**Task Details:**\n\n";
  details += `**ID:** \`${task.id}\`\n`;
  details += `**Text:** ${task.text}\n`;
  details += `**Status:** ${task.checked ? "☑ Completed" : "☐ Incomplete"}\n`;

  if (metadata.priority) {
    details += `**Priority:** ${metadata.priority.toUpperCase()}\n`;
  }

  if (metadata.blocked_by && metadata.blocked_by.length > 0) {
    details += `**Blocked by:** ${metadata.blocked_by.join(", ")}\n`;
  }

  if (metadata.notes) {
    details += `**Notes:** ${metadata.notes}\n`;
  }

  const children = task.children || [];
  if (children.length > 0) {
    details += `\n**Children (${children.length}):**\n\n`;
    for (const child of children) {
      details += formatTaskForDisplay(child, 1) + "\n";
    }
  }

  return details;
}

async function handleAddRawTask(projectName: string, taskText: string): Promise<string> {
  const projectPath = await getProjectPath(projectName);
  const rawFile = join(projectPath, "raw.txt");

  // Ensure directory exists
  await fs.mkdir(projectPath, { recursive: true });

  // Append to raw.txt
  let content = taskText;
  if (!taskText.endsWith("\n")) {
    content += "\n";
  }

  // Check if file exists and add newline if needed
  if (await fileExists(rawFile)) {
    const existingContent = await fs.readFile(rawFile, "utf-8");
    if (existingContent.length > 0 && !existingContent.endsWith("\n")) {
      content = "\n" + content;
    }
  }

  await fs.appendFile(rawFile, content, "utf-8");

  return `✓ Added raw task to project '${projectName}'. It will be formatted next time you open Oscribble.`;
}

// Register handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (!args) {
      throw new Error("Missing arguments");
    }

    let result: string;

    switch (name) {
      case "oscribble_list_projects":
        result = await handleListProjects();
        break;

      case "oscribble_list_tasks":
        result = await handleListTasks(
          args.project_name as string,
          (args.filter_status as FilterStatus) || "all"
        );
        break;

      case "oscribble_complete_task":
        result = await handleCompleteTask(args.project_name as string, args.task_id as string, true);
        break;

      case "oscribble_uncomplete_task":
        result = await handleCompleteTask(args.project_name as string, args.task_id as string, false);
        break;

      case "oscribble_get_task_details":
        result = await handleGetTaskDetails(args.project_name as string, args.task_id as string);
        break;

      case "oscribble_add_raw_task":
        result = await handleAddRawTask(args.project_name as string, args.task_text as string);
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: "text",
          text: result,
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
