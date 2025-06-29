import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { BaseTool, ToolResult, ExecutionContext, ToolSchema, ValidationResult } from './base-tool';

/**
 * Parameters for the Write tool
 */
export interface WriteToolParams {
  /**
   * The path to the file to write to (relative to workspace)
   */
  file_path: string;

  /**
   * The content to write to the file
   */
  content: string;

  /**
   * Whether to create parent directories if they don't exist
   */
  create_dirs?: boolean;
}

/**
 * Tool for writing content to files in the SuperDesign workspace
 */
export class WriteTool extends BaseTool {
  readonly name = 'write';
  readonly description = 'Write content to a file in the SuperDesign workspace. Creates parent directories if needed.';
  
  readonly schema: ToolSchema = {
    name: this.name,
    description: this.description,
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          name: 'file_path',
          type: 'string',
          description: 'Path to the file to write to (relative to workspace root)',
          required: true
        },
        content: {
          name: 'content',
          type: 'string',
          description: 'Content to write to the file',
          required: true
        },
        create_dirs: {
          name: 'create_dirs',
          type: 'boolean',
          description: 'Whether to create parent directories if they don\'t exist (default: true)',
          required: false
        }
      },
      required: ['file_path', 'content']
    }
  };

  validate(params: WriteToolParams): ValidationResult {
    const errors: string[] = [];

    // Basic parameter validation
    if (!params.file_path || typeof params.file_path !== 'string') {
      errors.push('file_path is required and must be a string');
    }

    if (params.content === undefined || params.content === null) {
      errors.push('content is required');
    }

    if (typeof params.content !== 'string') {
      errors.push('content must be a string');
    }

    // Path validation
    if (params.file_path) {
      if (path.isAbsolute(params.file_path)) {
        errors.push('file_path must be relative to workspace root, not absolute');
      }

      if (params.file_path.includes('..')) {
        errors.push('file_path cannot contain ".." for security reasons');
      }

      if (params.file_path.startsWith('/') || params.file_path.startsWith('\\')) {
        errors.push('file_path should not start with path separators');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async execute(params: WriteToolParams, context: ExecutionContext): Promise<ToolResult> {
    const startTime = Date.now();
    
    try {
      // Validate parameters
      const validation = this.validate(params);
      if (!validation.isValid) {
        return this.createResult(false, undefined, `Validation failed: ${validation.errors.join(', ')}`);
      }

      // Resolve absolute path within workspace
      const absolutePath = path.resolve(context.workingDirectory, params.file_path);
      
      // Security check - ensure path is within workspace
      if (!this.validatePath(params.file_path, context)) {
        return this.createResult(false, undefined, `File path must be within SuperDesign workspace: ${params.file_path}`);
      }

      this.log(`Writing to file: ${params.file_path}`, context);

      // Check if target is a directory
      if (fs.existsSync(absolutePath)) {
        const stats = fs.lstatSync(absolutePath);
        if (stats.isDirectory()) {
          return this.createResult(false, undefined, `Target path is a directory, not a file: ${params.file_path}`);
        }
      }

      // Create parent directories if needed and requested
      const createDirs = params.create_dirs !== false; // Default to true
      if (createDirs) {
        const dirName = path.dirname(absolutePath);
        if (!fs.existsSync(dirName)) {
          fs.mkdirSync(dirName, { recursive: true });
          this.log(`Created parent directories for: ${params.file_path}`, context);
        }
      }

      // Determine if this is a new file or overwrite
      const isNewFile = !fs.existsSync(absolutePath);
      
      // Write the file
      fs.writeFileSync(absolutePath, params.content, 'utf8');

      const duration = Date.now() - startTime;
      const lines = params.content.split('\n').length;
      const size = Buffer.byteLength(params.content, 'utf8');

      this.log(`${isNewFile ? 'Created' : 'Updated'} file: ${params.file_path} (${lines} lines, ${size} bytes)`, context);

      return this.createResult(
        true,
        {
          file_path: params.file_path,
          absolute_path: absolutePath,
          is_new_file: isNewFile,
          lines_written: lines,
          bytes_written: size
        },
        undefined,
        {
          duration,
          filesAffected: [absolutePath],
          outputSize: size
        }
      );

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.log(`Error writing file: ${errorMessage}`, context);
      
      return this.createResult(
        false,
        undefined,
        `Failed to write file: ${errorMessage}`,
        { duration }
      );
    }
  }
} 