import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { BaseTool, ToolResult, ExecutionContext, ToolSchema, ValidationResult } from './base-tool';

/**
 * Parameters for the LS tool
 */
export interface LSToolParams {
  /**
   * The path to the directory to list (relative to workspace)
   */
  path?: string;

  /**
   * Whether to show hidden files (starting with .)
   */
  show_hidden?: boolean;

  /**
   * Array of glob patterns to ignore
   */
  ignore?: string[];

  /**
   * Whether to show detailed file information
   */
  detailed?: boolean;
}

/**
 * File entry returned by LS tool
 */
export interface FileEntry {
  /**
   * Name of the file or directory
   */
  name: string;

  /**
   * Whether this entry is a directory
   */
  isDirectory: boolean;

  /**
   * Size of the file in bytes (0 for directories)
   */
  size: number;

  /**
   * Last modified timestamp
   */
  modifiedTime: Date;

  /**
   * File extension (if applicable)
   */
  extension?: string;
}

/**
 * Tool for listing directory contents in the SuperDesign workspace
 */
export class LSTool extends BaseTool {
  readonly name = 'ls';
  readonly description = 'List the contents of a directory in the SuperDesign workspace. Shows files and subdirectories with optional filtering.';
  
  readonly schema: ToolSchema = {
    name: this.name,
    description: this.description,
    parameters: {
      type: 'object',
      properties: {
        path: {
          name: 'path',
          type: 'string',
          description: 'Path to the directory to list (relative to workspace root). Defaults to workspace root.',
          required: false
        },
        show_hidden: {
          name: 'show_hidden',
          type: 'boolean',
          description: 'Whether to show hidden files and directories (starting with .)',
          required: false
        },
        ignore: {
          name: 'ignore',
          type: 'array',
          description: 'Array of glob patterns to ignore (e.g., ["*.log", "temp*"])',
          required: false,
          items: {
            name: 'pattern',
            type: 'string',
            description: 'Glob pattern to ignore'
          }
        },
        detailed: {
          name: 'detailed',
          type: 'boolean',
          description: 'Whether to show detailed file information (size, modified time)',
          required: false
        }
      },
      required: []
    }
  };

  validate(params: LSToolParams): ValidationResult {
    const errors: string[] = [];

    // Path validation
    if (params.path) {
      if (typeof params.path !== 'string') {
        errors.push('path must be a string');
      } else {
        if (path.isAbsolute(params.path)) {
          errors.push('path must be relative to workspace root, not absolute');
        }

        if (params.path.includes('..')) {
          errors.push('path cannot contain ".." for security reasons');
        }
      }
    }

    // Boolean parameter validation
    if (params.show_hidden !== undefined && typeof params.show_hidden !== 'boolean') {
      errors.push('show_hidden must be a boolean');
    }

    if (params.detailed !== undefined && typeof params.detailed !== 'boolean') {
      errors.push('detailed must be a boolean');
    }

    // Ignore patterns validation
    if (params.ignore !== undefined) {
      if (!Array.isArray(params.ignore)) {
        errors.push('ignore must be an array');
      } else {
        params.ignore.forEach((pattern, index) => {
          if (typeof pattern !== 'string') {
            errors.push(`ignore[${index}] must be a string`);
          }
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if a filename should be ignored based on patterns
   */
  private shouldIgnore(filename: string, patterns?: string[]): boolean {
    if (!patterns || patterns.length === 0) {
      return false;
    }

    for (const pattern of patterns) {
      // Convert glob pattern to RegExp (simplified version)
      const regexPattern = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape special regex chars
        .replace(/\*/g, '.*')                   // * becomes .*
        .replace(/\?/g, '.');                   // ? becomes .
      
      const regex = new RegExp(`^${regexPattern}$`);
      if (regex.test(filename)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Format file size in human-readable format
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
  }

  /**
   * Format modified time in relative format
   */
  private formatModifiedTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  }

  async execute(params: LSToolParams, context: ExecutionContext): Promise<ToolResult> {
    const startTime = Date.now();
    
    try {
      // Validate parameters
      const validation = this.validate(params);
      if (!validation.isValid) {
        return this.createResult(false, undefined, `Validation failed: ${validation.errors.join(', ')}`);
      }

      // Resolve target directory
      const targetPath = params.path || '.';
      const absolutePath = path.resolve(context.workingDirectory, targetPath);
      
      // Security check
      if (!this.validatePath(targetPath, context)) {
        return this.createResult(false, undefined, `Path must be within SuperDesign workspace: ${targetPath}`);
      }

      this.log(`Listing directory: ${targetPath}`, context);

      // Check if path exists and is a directory
      if (!fs.existsSync(absolutePath)) {
        return this.createResult(false, undefined, `Directory not found: ${targetPath}`);
      }

      const stats = fs.statSync(absolutePath);
      if (!stats.isDirectory()) {
        return this.createResult(false, undefined, `Path is not a directory: ${targetPath}`);
      }

      // Read directory contents
      const files = fs.readdirSync(absolutePath);
      
      if (files.length === 0) {
        this.log(`Directory is empty: ${targetPath}`, context);
        return this.createResult(
          true,
          {
            path: targetPath,
            absolute_path: absolutePath,
            entries: [],
            total_count: 0
          },
          undefined,
          {
            duration: Date.now() - startTime,
            filesAffected: []
          }
        );
      }

      const showHidden = params.show_hidden || false;
      const detailed = params.detailed || false;
      const entries: FileEntry[] = [];
      let hiddenCount = 0;
      let ignoredCount = 0;

      // Process each file/directory
      for (const file of files) {
        // Skip hidden files unless requested
        if (!showHidden && file.startsWith('.')) {
          hiddenCount++;
          continue;
        }

        // Check ignore patterns
        if (this.shouldIgnore(file, params.ignore)) {
          ignoredCount++;
          continue;
        }

        const fullPath = path.join(absolutePath, file);
        
        try {
          const fileStats = fs.statSync(fullPath);
          const isDir = fileStats.isDirectory();
          
          const entry: FileEntry = {
            name: file,
            isDirectory: isDir,
            size: isDir ? 0 : fileStats.size,
            modifiedTime: fileStats.mtime,
            extension: isDir ? undefined : path.extname(file).slice(1)
          };

          entries.push(entry);
        } catch (error) {
          // Log error but continue with other files
          this.log(`Error accessing ${file}: ${error instanceof Error ? error.message : String(error)}`, context);
        }
      }

      // Sort entries (directories first, then alphabetically)
      entries.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

      const duration = Date.now() - startTime;

      // Create formatted output
      let summary = `Listed ${entries.length} item(s) in ${targetPath}`;
      if (hiddenCount > 0) {
        summary += ` (${hiddenCount} hidden)`;
      }
      if (ignoredCount > 0) {
        summary += ` (${ignoredCount} ignored)`;
      }

      // Create detailed listing if requested
      let detailedListing = '';
      if (detailed && entries.length > 0) {
        detailedListing = '\n\nDetailed listing:\n';
        detailedListing += entries.map(entry => {
          const type = entry.isDirectory ? '[DIR]' : '[FILE]';
          const size = entry.isDirectory ? '' : ` ${this.formatFileSize(entry.size)}`;
          const modified = ` ${this.formatModifiedTime(entry.modifiedTime)}`;
          const ext = entry.extension ? ` .${entry.extension}` : '';
          return `${type} ${entry.name}${size}${modified}${ext}`;
        }).join('\n');
      }

      this.log(`${summary}${detailedListing}`, context);

      return this.createResult(
        true,
        {
          path: targetPath,
          absolute_path: absolutePath,
          entries,
          total_count: entries.length,
          hidden_count: hiddenCount,
          ignored_count: ignoredCount,
          directories: entries.filter(e => e.isDirectory).length,
          files: entries.filter(e => !e.isDirectory).length,
          summary,
          detailed_listing: detailed ? detailedListing : undefined
        },
        undefined,
        {
          duration,
          filesAffected: [absolutePath]
        }
      );

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.log(`Error listing directory: ${errorMessage}`, context);
      
      return this.createResult(
        false,
        undefined,
        `Failed to list directory: ${errorMessage}`,
        { duration }
      );
    }
  }
} 