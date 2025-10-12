/**
 * Utility functions for file I/O and task operations
 */

import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join, dirname } from "path";
import { randomBytes } from "crypto";
import type { TaskNode, NotesFile, ProjectSettings } from "./types.js";

export const STORAGE_ROOT = join(process.env.HOME || process.env.USERPROFILE || "", ".project-stickies");
export const PROJECTS_FILE = join(STORAGE_ROOT, "projects.json");

/**
 * Load and parse a JSON file
 */
export async function loadJson<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, "utf-8");
  return JSON.parse(content);
}

/**
 * Atomically write JSON data to a file using temp file + rename pattern
 * Matches the StorageService implementation in Oscribble
 */
export async function atomicWriteJson(filePath: string, data: any): Promise<void> {
  const dir = dirname(filePath);

  // Ensure directory exists
  await fs.mkdir(dir, { recursive: true });

  // Create temporary file in the same directory
  const tmpName = `.${randomBytes(16).toString("hex")}.tmp`;
  const tmpPath = join(dir, tmpName);

  try {
    // Write to temporary file
    await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), "utf-8");

    // Atomic rename
    await fs.rename(tmpPath, filePath);
  } catch (error) {
    // Clean up temp file on error
    try {
      await fs.unlink(tmpPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Recursively search for a task by UUID
 * Returns [task, parentArray] tuple or null if not found
 */
export function findTaskById(
  tasks: TaskNode[],
  taskId: string
): [TaskNode, TaskNode[]] | null {
  for (const task of tasks) {
    if (task.id === taskId) {
      return [task, tasks];
    }

    // Search in children
    if (task.children && task.children.length > 0) {
      const result = findTaskById(task.children, taskId);
      if (result) {
        return result;
      }
    }
  }

  return null;
}

/**
 * Format a task with its metadata for display
 */
export function formatTaskForDisplay(task: TaskNode, indent: number = 0): string {
  const prefix = "  ".repeat(indent);
  const status = task.checked ? "☑" : "☐";

  // Extract metadata
  const metadata = task.metadata || {};
  const priority = metadata.priority ? ` [${metadata.priority.toUpperCase()}]` : "";

  let result = `${prefix}${status} ${task.text}${priority} (ID: ${task.id})`;

  // Add blocked_by if present
  if (metadata.blocked_by && metadata.blocked_by.length > 0) {
    result += `\n${prefix}  ⚠️  Blocked by: ${metadata.blocked_by.join(", ")}`;
  }

  // Add notes if present
  if (metadata.notes) {
    result += `\n${prefix}  📝 ${metadata.notes}`;
  }

  // Recursively format children
  if (task.children && task.children.length > 0) {
    for (const child of task.children) {
      result += "\n" + formatTaskForDisplay(child, indent + 1);
    }
  }

  return result;
}

/**
 * Get the storage path for a project
 */
export async function getProjectPath(projectName: string): Promise<string> {
  const projects = await loadJson<ProjectSettings[]>(PROJECTS_FILE);

  const project = projects.find((p) => p.name === projectName);
  if (!project) {
    throw new Error(`Project '${projectName}' not found`);
  }

  return join(STORAGE_ROOT, projectName);
}

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
