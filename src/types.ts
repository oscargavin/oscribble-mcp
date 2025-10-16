/**
 * Type definitions for Oscribble data structures
 */

export interface TaskMetadata {
  priority?: "critical" | "performance" | "feature";
  blocked_by?: string[];
  depends_on?: string[];
  related_to?: string[];
  notes?: string | string[];
  deadline?: string;
  effort_estimate?: string;
  tags?: string[];
  formatted?: boolean;
  context_files?: {
    path: string;
    wasGrepped?: boolean;
    matchedKeywords?: string[];
  }[];
  start_time?: number;  // Unix timestamp when task started (milliseconds)
  duration?: number;    // Milliseconds elapsed (presence means completed)
  attempts?: Array<{
    timestamp: number;  // Unix timestamp when attempt failed (milliseconds)
    note: string;       // Detailed note from Claude Code about what was tried
  }>;
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
