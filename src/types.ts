/**
 * Type definitions for Oscribble data structures
 */

export interface TaskMetadata {
  priority?: "critical" | "performance" | "feature";
  blocked_by?: string[];
  notes?: string;
}

export interface TaskNode {
  id: string;
  text: string;
  checked: boolean;
  indent: number;
  children: TaskNode[];
  metadata?: TaskMetadata;
}

export interface NotesFile {
  version: string;
  project_path: string;
  last_modified: number;
  tasks: TaskNode[];
  last_formatted_raw?: string;
}

export interface ProjectSettings {
  name: string;
  path: string;
  created: number;
  last_accessed: number;
}

export type FilterStatus = "all" | "unchecked" | "checked";
