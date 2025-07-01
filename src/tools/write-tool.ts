import * as fs from 'fs';
import * as path from 'path';
import { tool } from 'ai';
import { z } from 'zod';
import { ExecutionContext } from '../types/agent';

/**
 * Write tool result with metadata
 */
export interface WriteToolResult {
  file_path: string;
  absolute_path: string;
  is_new_file: boolean;
  lines_written: number;
  bytes_written: number;
}

/**
 * Validate file path is within workspace and secure
 */
function validateWritePath(filePath: string, context: ExecutionContext): boolean {
  if (!filePath || !context.workingDirectory) {
    return false;
  }

  // Check for security issues
  if (path.isAbsolute(filePath)) {
    return false; // Must be relative
  }

  if (filePath.includes('..')) {
    return false; // No parent directory traversal
  }

  if (filePath.startsWith('/') || filePath.startsWith('\\')) {
    return false; // Should not start with separators
  }

  // Check workspace boundary
  const resolvedPath = path.resolve(context.workingDirectory, filePath);
  const workspacePath = path.resolve(context.workingDirectory);
  
  return resolvedPath.startsWith(workspacePath);
}

/**
 * Create SuperDesign write tool with execution context
 */
export function createWriteTool(context: ExecutionContext) {
  return tool({
    description: 'Write content to a file in the SuperDesign workspace. Creates parent directories if needed.',
    parameters: z.object({
      file_path: z.string().describe('Path to the file to write to (relative to workspace root)'),
      content: z.string().describe('Content to write to the file'),
      create_dirs: z.boolean().optional().default(true).describe('Whether to create parent directories if they don\'t exist (default: true)')
    }),
    execute: async ({ file_path, content, create_dirs = true }) => {
      const startTime = Date.now();
      
      try {
        // Validate file path
        if (!validateWritePath(file_path, context)) {
          throw new Error(`Invalid file path: ${file_path}. Must be relative to workspace and not contain ".." or absolute paths.`);
        }

        // Resolve absolute path within workspace
        const absolutePath = path.resolve(context.workingDirectory, file_path);
        
        context.outputChannel.appendLine(`[write] Writing to file: ${file_path}`);

        // Check if target is a directory
        if (fs.existsSync(absolutePath)) {
          const stats = fs.lstatSync(absolutePath);
          if (stats.isDirectory()) {
            throw new Error(`Target path is a directory, not a file: ${file_path}`);
          }
        }

        // Create parent directories if needed and requested
        if (create_dirs) {
          const dirName = path.dirname(absolutePath);
          if (!fs.existsSync(dirName)) {
            fs.mkdirSync(dirName, { recursive: true });
            context.outputChannel.appendLine(`[write] Created parent directories for: ${file_path}`);
          }
        }

        // Determine if this is a new file or overwrite
        const isNewFile = !fs.existsSync(absolutePath);
        
        // Write the file
        fs.writeFileSync(absolutePath, content, 'utf8');

        const duration = Date.now() - startTime;
        const lines = content.split('\n').length;
        const size = Buffer.byteLength(content, 'utf8');

        context.outputChannel.appendLine(`[write] ${isNewFile ? 'Created' : 'Updated'} file: ${file_path} (${lines} lines, ${size} bytes) in ${duration}ms`);

        const result: WriteToolResult = {
          file_path,
          absolute_path: absolutePath,
          is_new_file: isNewFile,
          lines_written: lines,
          bytes_written: size
        };

        return result;

      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        context.outputChannel.appendLine(`[write] Error writing file: ${errorMessage} (${duration}ms)`);
        throw new Error(`Failed to write file: ${errorMessage}`);
      }
    }
  });
} 