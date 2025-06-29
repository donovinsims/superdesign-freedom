import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn, ChildProcess } from 'child_process';
import { BaseTool, ToolResult, ExecutionContext, ToolSchema, ValidationResult } from './base-tool';

/**
 * Parameters for the Bash tool
 */
export interface BashToolParams {
  /**
   * The command to execute
   */
  command: string;

  /**
   * Brief description of what the command does
   */
  description?: string;

  /**
   * Directory to run the command in (relative to workspace)
   */
  directory?: string;

  /**
   * Timeout in milliseconds (default: 30000ms = 30s)
   */
  timeout?: number;

  /**
   * Whether to capture and return output (default: true)
   */
  capture_output?: boolean;

  /**
   * Environment variables to set for the command
   */
  env?: Record<string, string>;
}

/**
 * Command execution result
 */
export interface CommandResult {
  command: string;
  directory: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: string | null;
  duration: number;
  timedOut: boolean;
  processId?: number;
}

/**
 * Tool for executing bash/shell commands in the SuperDesign workspace
 */
export class BashTool extends BaseTool {
  readonly name = 'bash';
  readonly description = 'Execute shell/bash commands within the SuperDesign workspace. Supports timeouts, output capture, and secure execution.';
  
  readonly schema: ToolSchema = {
    name: this.name,
    description: this.description,
    parameters: {
      type: 'object',
      properties: {
        command: {
          name: 'command',
          type: 'string',
          description: 'Shell command to execute (e.g., "npm install", "ls -la", "git status")',
          required: true
        },
        description: {
          name: 'description',
          type: 'string',
          description: 'Brief description of what the command does for logging purposes',
          required: false
        },
        directory: {
          name: 'directory',
          type: 'string',
          description: 'Directory to run command in (relative to workspace root). Defaults to workspace root.',
          required: false
        },
        timeout: {
          name: 'timeout',
          type: 'number',
          description: 'Timeout in milliseconds (default: 30000ms = 30 seconds)',
          required: false
        },
        capture_output: {
          name: 'capture_output',
          type: 'boolean',
          description: 'Whether to capture and return command output (default: true)',
          required: false
        },
        env: {
          name: 'env',
          type: 'object',
          description: 'Environment variables to set for the command execution',
          required: false
        }
      },
      required: ['command']
    }
  };

  validate(params: BashToolParams): ValidationResult {
    const errors: string[] = [];

    // Command validation
    if (!params.command || typeof params.command !== 'string') {
      errors.push('command is required and must be a string');
    } else {
      if (params.command.trim() === '') {
        errors.push('command cannot be empty');
      }

      // Security checks
      if (this.hasUnsafeCommand(params.command)) {
        errors.push('command contains potentially unsafe operations');
      }
    }

    // Directory validation
    if (params.directory) {
      if (typeof params.directory !== 'string') {
        errors.push('directory must be a string');
      } else {
        if (path.isAbsolute(params.directory)) {
          errors.push('directory must be relative to workspace root, not absolute');
        }

        if (params.directory.includes('..')) {
          errors.push('directory cannot contain ".." for security reasons');
        }
      }
    }

    // Description validation
    if (params.description !== undefined && typeof params.description !== 'string') {
      errors.push('description must be a string');
    }

    // Timeout validation
    if (params.timeout !== undefined) {
      if (typeof params.timeout !== 'number' || params.timeout <= 0) {
        errors.push('timeout must be a positive number');
      }
    }

    // Capture output validation
    if (params.capture_output !== undefined && typeof params.capture_output !== 'boolean') {
      errors.push('capture_output must be a boolean');
    }

    // Environment variables validation
    if (params.env !== undefined) {
      if (typeof params.env !== 'object' || Array.isArray(params.env) || params.env === null) {
        errors.push('env must be an object');
      } else {
        for (const [key, value] of Object.entries(params.env)) {
          if (typeof key !== 'string' || typeof value !== 'string') {
            errors.push('env variables must be string key-value pairs');
            break;
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check for potentially unsafe commands
   */
  private hasUnsafeCommand(command: string): boolean {
    const unsafePatterns = [
      // System modification - improved pattern for rm commands
      /\brm\s+(-[rf]*\s+)?\/\s*$/i,
      /\brm\s+-[rf]*\s+\/$/i,
      /\b(format|fdisk|mkfs)\b/i,
      // Network operations that could be dangerous
      /\b(curl|wget)\s+.*\|\s*(bash|sh|python|ruby|perl)/i,
      // Process manipulation
      /\b(kill|killall|pkill)\s+(-9\s+)?1\b/i,
      // System shutdown/reboot
      /\b(shutdown|reboot|halt|init\s+0)\b/i,
      // Privilege escalation
      /\b(sudo\s+su|sudo.*passwd|chmod\s+777)/i,
      // Directory traversal attempts
      /\.\.(\/|\\)/,
      // Dangerous redirections
      />\s*(\/dev\/|\/proc\/|\/sys\/)/i,
    ];

    return unsafePatterns.some(pattern => pattern.test(command));
  }

  /**
   * Get the root command for identification
   */
  private getCommandRoot(command: string): string {
    return command
      .trim()
      .replace(/[{}()]/g, '') // Remove grouping operators
      .split(/[\s;&|]+/)[0] // Split on whitespace/operators, take first part
      ?.split(/[/\\]/) // Split on path separators
      .pop() || ''; // Take last part (command name)
  }

  /**
   * Execute the command with proper process management
   */
  private async executeCommand(
    command: string,
    options: {
      cwd: string;
      env: NodeJS.ProcessEnv;
      timeout: number;
      captureOutput: boolean;
    }
  ): Promise<CommandResult> {
    const startTime = Date.now();
    const isWindows = os.platform() === 'win32';
    
    // Choose shell based on platform
    const shell = isWindows ? 'cmd.exe' : 'bash';
    const shellArgs = isWindows ? ['/c', command] : ['-c', command];

    const child: ChildProcess = spawn(shell, shellArgs, {
      cwd: options.cwd,
      env: options.env,
      stdio: options.captureOutput ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      detached: !isWindows, // Create process group on Unix systems
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    // Capture output if requested
    if (options.captureOutput && child.stdout && child.stderr) {
      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });
    }

    // Set up timeout
    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      if (child.pid) {
        try {
          if (isWindows) {
            // On Windows, use taskkill to terminate process tree
            spawn('taskkill', ['/pid', child.pid.toString(), '/f', '/t']);
          } else {
            // On Unix, kill the process group
            process.kill(-child.pid, 'SIGTERM');
            // Force kill after 1 second if still running
            setTimeout(() => {
              if (child.pid && !child.killed) {
                try {
                  process.kill(-child.pid, 'SIGKILL');
                } catch (e) {
                  // Process might already be dead
                }
              }
            }, 1000);
          }
        } catch (error) {
          // Process might already be dead
        }
      }
    }, options.timeout);

    // Wait for process to complete
    const exitPromise = new Promise<{ code: number | null; signal: string | null }>((resolve) => {
      child.on('exit', (code, signal) => {
        clearTimeout(timeoutHandle);
        resolve({ code, signal });
      });
    });

    const { code, signal } = await exitPromise;
    const duration = Date.now() - startTime;

    return {
      command,
      directory: path.relative(options.cwd, options.cwd) || '.',
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode: code,
      signal: signal,
      duration,
      timedOut,
      processId: child.pid
    };
  }

  async execute(params: BashToolParams, context: ExecutionContext): Promise<ToolResult> {
    const startTime = Date.now();
    
    try {
      // Validate parameters
      const validation = this.validate(params);
      if (!validation.isValid) {
        return this.createResult(false, undefined, `Validation failed: ${validation.errors.join(', ')}`);
      }

      // Resolve execution directory
      const workingDir = params.directory || '.';
      const absolutePath = path.resolve(context.workingDirectory, workingDir);
      
      // Security check
      if (!this.validatePath(workingDir, context)) {
        return this.createResult(false, undefined, `Directory must be within SuperDesign workspace: ${workingDir}`);
      }

      // Check if directory exists
      if (!fs.existsSync(absolutePath)) {
        return this.createResult(false, undefined, `Directory does not exist: ${workingDir}`);
      }

      const timeout = params.timeout || 30000; // 30 seconds default
      const captureOutput = params.capture_output !== false; // Default to true
      const commandRoot = this.getCommandRoot(params.command);

      this.log(`Executing command: ${params.command}${params.description ? ` (${params.description})` : ''}`, context);
      this.log(`Working directory: ${workingDir}`, context);
      this.log(`Command root: ${commandRoot}`, context);

      // Prepare environment
      const env = {
        ...process.env,
        ...params.env
      };

      // Execute the command
      const result = await this.executeCommand(params.command, {
        cwd: absolutePath,
        env,
        timeout,
        captureOutput
      });

      const executionTime = Date.now() - startTime;

      // Log results
      if (result.timedOut) {
        this.log(`Command timed out after ${timeout}ms`, context);
      } else if (result.exitCode === 0) {
        this.log(`Command completed successfully in ${result.duration}ms`, context);
      } else {
        this.log(`Command failed with exit code ${result.exitCode} in ${result.duration}ms`, context);
      }

      // Create summary for display
      let summary = `Command: ${params.command}\n`;
      summary += `Directory: ${result.directory}\n`;
      summary += `Exit Code: ${result.exitCode}\n`;
      summary += `Duration: ${result.duration}ms\n`;
      
      if (result.timedOut) {
        summary += `Status: TIMED OUT (${timeout}ms)\n`;
      } else if (result.signal) {
        summary += `Signal: ${result.signal}\n`;
      }

      if (captureOutput) {
        if (result.stdout) {
          summary += `\nStdout:\n${result.stdout}\n`;
        }
        if (result.stderr) {
          summary += `\nStderr:\n${result.stderr}\n`;
        }
      }

      const success = !result.timedOut && result.exitCode === 0;
      const errorMessage = result.timedOut 
        ? `Command timed out after ${timeout}ms`
        : result.exitCode !== 0 
        ? `Command failed with exit code ${result.exitCode}`
        : undefined;

      return this.createResult(
        success,
        {
          ...result,
          summary,
          command_root: commandRoot,
          working_directory: workingDir,
          absolute_path: absolutePath
        },
        errorMessage,
        {
          duration: executionTime,
          filesAffected: [absolutePath]
        }
      );

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.log(`Error executing command: ${errorMessage}`, context);
      
      return this.createResult(
        false,
        undefined,
        `Failed to execute command: ${errorMessage}`,
        { duration }
      );
    }
  }
} 