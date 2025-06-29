import * as fs from 'fs';
import * as path from 'path';
import * as mime from 'mime-types';
import { BaseTool, ToolSchema, ExecutionContext, ToolResult } from './base-tool';

/**
 * Parameters for the SuperDesign Read tool
 */
export interface ReadToolParams {
  /**
   * The path to the file to read (relative to workspace or absolute)
   */
  filePath: string;

  /**
   * Optional: The line number to start reading from (1-based)
   */
  startLine?: number;

  /**
   * Optional: The number of lines to read
   */
  lineCount?: number;

  /**
   * Optional: File encoding (defaults to utf-8)
   */
  encoding?: string;
}

/**
 * File read result with metadata
 */
export interface FileReadResult {
  content: string;
  filePath: string;
  fileType: 'text' | 'image' | 'pdf' | 'binary';
  mimeType?: string;
  lineCount?: number;
  isTruncated?: boolean;
  linesShown?: [number, number]; // [startLine, endLine]
  size: number;
}

// Constants for file processing
const DEFAULT_MAX_LINES = 1000;
const MAX_LINE_LENGTH = 2000;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * SuperDesign Read Tool for reading files within the design workspace
 */
export class ReadTool extends BaseTool {
  readonly name = 'read';
  readonly description = 'Read the contents of a file within the SuperDesign workspace. Supports text files, images (PNG, JPG, SVG, etc.), and handles large files with line-range reading.';
  
  readonly schema: ToolSchema = {
    name: 'read',
    description: this.description,
    parameters: {
      type: 'object',
      properties: {
        filePath: {
          name: 'filePath',
          type: 'string',
          description: 'Path to the file to read, relative to the workspace root or absolute path within workspace'
        },
        startLine: {
          name: 'startLine',
          type: 'number',
          description: 'Optional: Starting line number to read from (1-based). Use with lineCount for large files.'
        },
        lineCount: {
          name: 'lineCount', 
          type: 'number',
          description: 'Optional: Number of lines to read. Use with startLine to read specific sections.'
        },
        encoding: {
          name: 'encoding',
          type: 'string',
          description: 'Optional: File encoding (utf-8, ascii, etc.). Defaults to utf-8.'
        }
      },
      required: ['filePath']
    }
  };

  /**
   * Validate file path and parameters
   */
  validate(params: ReadToolParams): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required parameters
    if (!params.filePath || typeof params.filePath !== 'string') {
      errors.push('filePath is required and must be a string');
    }

    // Validate line parameters
    if (params.startLine !== undefined) {
      if (typeof params.startLine !== 'number' || params.startLine < 1) {
        errors.push('startLine must be a positive number (1-based)');
      }
    }

    if (params.lineCount !== undefined) {
      if (typeof params.lineCount !== 'number' || params.lineCount < 1) {
        errors.push('lineCount must be a positive number');
      }
    }

    // Validate encoding
    if (params.encoding && typeof params.encoding !== 'string') {
      errors.push('encoding must be a string');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if a file is likely binary by sampling content
   */
  private isBinaryFile(filePath: string): boolean {
    try {
      const fd = fs.openSync(filePath, 'r');
      const fileSize = fs.fstatSync(fd).size;
      
      if (fileSize === 0) {
        fs.closeSync(fd);
        return false;
      }

      const bufferSize = Math.min(4096, fileSize);
      const buffer = Buffer.alloc(bufferSize);
      const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
      fs.closeSync(fd);

      if (bytesRead === 0) return false;

      // Check for null bytes (strong binary indicator)
      for (let i = 0; i < bytesRead; i++) {
        if (buffer[i] === 0) {
          return true;
        }
      }

      // Count non-printable characters
      let nonPrintableCount = 0;
      for (let i = 0; i < bytesRead; i++) {
        if (buffer[i] < 9 || (buffer[i] > 13 && buffer[i] < 32)) {
          nonPrintableCount++;
        }
      }

      // If >30% non-printable characters, consider binary
      return nonPrintableCount / bytesRead > 0.3;
    } catch {
      return false;
    }
  }

  /**
   * Detect file type based on extension and content
   */
  private detectFileType(filePath: string): 'text' | 'image' | 'pdf' | 'binary' {
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = mime.lookup(filePath);

    // Check for images
    if (mimeType && mimeType.startsWith('image/')) {
      return 'image';
    }

    // Check for PDF
    if (mimeType === 'application/pdf') {
      return 'pdf';
    }

    // Known binary extensions
    const binaryExtensions = [
      '.exe', '.dll', '.so', '.dylib', '.zip', '.tar', '.gz', '.7z',
      '.bin', '.dat', '.class', '.jar', '.war', '.pyc', '.pyo',
      '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.odt', '.ods', '.odp', '.wasm', '.obj', '.o', '.a', '.lib'
    ];

    if (binaryExtensions.includes(ext)) {
      return 'binary';
    }

    // Content-based binary detection
    if (this.isBinaryFile(filePath)) {
      return 'binary';
    }

    return 'text';
  }

  /**
   * Process text file content with line range support
   */
  private async processTextFile(
    filePath: string,
    startLine?: number,
    lineCount?: number,
    encoding: string = 'utf-8'
  ): Promise<{ content: string; metadata: Partial<FileReadResult> }> {
    const content = await fs.promises.readFile(filePath, encoding as BufferEncoding);
    const lines = content.split('\n');
    const originalLineCount = lines.length;

    // Handle line range
    const actualStartLine = Math.max((startLine || 1) - 1, 0); // Convert to 0-based
    const actualLineCount = lineCount || Math.min(DEFAULT_MAX_LINES, originalLineCount);
    const endLine = Math.min(actualStartLine + actualLineCount, originalLineCount);

    const selectedLines = lines.slice(actualStartLine, endLine);
    
    // Truncate long lines
    let linesWereTruncated = false;
    const processedLines = selectedLines.map(line => {
      if (line.length > MAX_LINE_LENGTH) {
        linesWereTruncated = true;
        return line.substring(0, MAX_LINE_LENGTH) + '... [line truncated]';
      }
      return line;
    });

    const contentWasTruncated = endLine < originalLineCount;
    const isTruncated = contentWasTruncated || linesWereTruncated;

    let processedContent = processedLines.join('\n');
    
    // Add truncation notice
    if (contentWasTruncated) {
      processedContent = `[Content truncated: showing lines ${actualStartLine + 1}-${endLine} of ${originalLineCount} total lines]\n\n` + processedContent;
    } else if (linesWereTruncated) {
      processedContent = `[Some lines truncated due to length (max ${MAX_LINE_LENGTH} chars)]\n\n` + processedContent;
    }

    return {
      content: processedContent,
      metadata: {
        lineCount: originalLineCount,
        isTruncated,
        linesShown: [actualStartLine + 1, endLine]
      }
    };
  }

  /**
   * Process image or PDF file
   */
  private async processMediaFile(
    filePath: string,
    fileType: 'image' | 'pdf'
  ): Promise<{ content: string; metadata: Partial<FileReadResult> }> {
    const buffer = await fs.promises.readFile(filePath);
    const base64Data = buffer.toString('base64');
    const mimeType = mime.lookup(filePath) || 'application/octet-stream';
    
    // For SuperDesign, we'll return a descriptive message rather than raw base64
    // The actual file handling would be done by the VS Code webview
    const fileName = path.basename(filePath);
    const fileSize = (buffer.length / 1024).toFixed(1);
    
    return {
      content: `[${fileType.toUpperCase()} FILE: ${fileName}]\nFile size: ${fileSize} KB\nMIME type: ${mimeType}\nBase64 data available for webview display.`,
      metadata: {
        mimeType
      }
    };
  }

  /**
   * Execute the read tool
   */
  async execute(params: ReadToolParams, context: ExecutionContext): Promise<ToolResult> {
    const startTime = Date.now();
    
    try {
      // Validate parameters
      const validation = this.validate(params);
      if (!validation.isValid) {
        return this.createResult(false, null, validation.errors.join('; '));
      }

      // Resolve and validate file path
      const absolutePath = path.isAbsolute(params.filePath) 
        ? params.filePath 
        : path.resolve(context.workingDirectory, params.filePath);

      if (!this.validatePath(params.filePath, context)) {
        return this.createResult(false, null, 'File path is outside the allowed workspace');
      }

      // Check file existence
      if (!fs.existsSync(absolutePath)) {
        return this.createResult(false, null, `File not found: ${params.filePath}`);
      }

      // Check if it's a directory
      const stats = fs.statSync(absolutePath);
      if (stats.isDirectory()) {
        return this.createResult(false, null, `Path is a directory, not a file: ${params.filePath}`);
      }

      // Check file size
      if (stats.size > MAX_FILE_SIZE_BYTES) {
        const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
        return this.createResult(false, null, `File too large (${sizeMB}MB). Maximum size: ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`);
      }

      // Detect file type
      const fileType = this.detectFileType(absolutePath);
      this.log(`Reading ${fileType} file: ${params.filePath} (${(stats.size / 1024).toFixed(1)} KB)`, context);

      let content: string;
      let metadata: Partial<FileReadResult> = {};

      // Process based on file type
      switch (fileType) {
        case 'text': {
          const result = await this.processTextFile(
            absolutePath,
            params.startLine,
            params.lineCount,
            params.encoding
          );
          content = result.content;
          metadata = result.metadata;
          break;
        }

        case 'image':
        case 'pdf': {
          const result = await this.processMediaFile(absolutePath, fileType);
          content = result.content;
          metadata = result.metadata;
          break;
        }

        case 'binary': {
          const fileName = path.basename(absolutePath);
          const fileSize = (stats.size / 1024).toFixed(1);
          content = `[BINARY FILE: ${fileName}]\nFile size: ${fileSize} KB\nCannot display binary content as text.`;
          break;
        }

        default:
          return this.createResult(false, null, `Unsupported file type: ${fileType}`);
      }

      // Create result
      const fileReadResult: FileReadResult = {
        content,
        filePath: params.filePath,
        fileType,
        mimeType: mime.lookup(absolutePath) || undefined,
        size: stats.size,
        ...metadata
      };

      const duration = Date.now() - startTime;
      this.log(`File read completed in ${duration}ms`, context);

      return this.createResult(true, fileReadResult, undefined, {
        duration,
        filesAffected: [params.filePath],
        outputSize: content.length
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`Read failed: ${errorMessage}`, context);
      
      return this.createResult(false, null, `Failed to read file: ${errorMessage}`);
    }
  }
} 