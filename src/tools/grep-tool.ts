import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { BaseTool, ToolResult, ExecutionContext, ToolSchema, ValidationResult } from './base-tool';

/**
 * Parameters for the Grep tool
 */
export interface GrepToolParams {
  /**
   * The regex pattern to search for in file contents
   */
  pattern: string;

  /**
   * The directory to search in (relative to workspace)
   */
  path?: string;

  /**
   * File pattern to include in the search (e.g. "*.js", "*.{ts,tsx}")
   */
  include?: string;

  /**
   * Whether the search should be case-sensitive
   */
  case_sensitive?: boolean;

  /**
   * Maximum number of files to search (default: 1000)
   */
  max_files?: number;

  /**
   * Maximum number of matches to return (default: 100)
   */
  max_matches?: number;
}

/**
 * Single match result
 */
export interface GrepMatch {
  filePath: string;
  lineNumber: number;
  line: string;
  matchStart: number;
  matchEnd: number;
}

/**
 * Tool for searching text content within files using regex patterns
 */
export class GrepTool extends BaseTool {
  readonly name = 'grep';
  readonly description = 'Search for text patterns within file contents using regular expressions. Can filter by file types and paths.';
  
  readonly schema: ToolSchema = {
    name: this.name,
    description: this.description,
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          name: 'pattern',
          type: 'string',
          description: 'Regular expression pattern to search for (e.g., "function\\s+\\w+", "import.*from")',
          required: true
        },
        path: {
          name: 'path',
          type: 'string',
          description: 'Directory to search in (relative to workspace root). Defaults to workspace root.',
          required: false
        },
        include: {
          name: 'include',
          type: 'string',
          description: 'File pattern to include (e.g., "*.js", "*.{ts,tsx}", "src/**/*.ts")',
          required: false
        },
        case_sensitive: {
          name: 'case_sensitive',
          type: 'boolean',
          description: 'Whether the search should be case-sensitive (default: false)',
          required: false
        },
        max_files: {
          name: 'max_files',
          type: 'number',
          description: 'Maximum number of files to search (default: 1000)',
          required: false
        },
        max_matches: {
          name: 'max_matches',
          type: 'number',
          description: 'Maximum number of matches to return (default: 100)',
          required: false
        }
      },
      required: ['pattern']
    }
  };

  validate(params: GrepToolParams): ValidationResult {
    const errors: string[] = [];

    // Pattern validation
    if (!params.pattern || typeof params.pattern !== 'string') {
      errors.push('pattern is required and must be a string');
    } else {
      try {
        new RegExp(params.pattern);
      } catch (error) {
        errors.push(`Invalid regular expression pattern: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

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

    // Include pattern validation
    if (params.include !== undefined && typeof params.include !== 'string') {
      errors.push('include must be a string');
    }

    // Boolean validation
    if (params.case_sensitive !== undefined && typeof params.case_sensitive !== 'boolean') {
      errors.push('case_sensitive must be a boolean');
    }

    // Number validation
    if (params.max_files !== undefined) {
      if (typeof params.max_files !== 'number' || params.max_files < 1) {
        errors.push('max_files must be a positive number');
      }
    }

    if (params.max_matches !== undefined) {
      if (typeof params.max_matches !== 'number' || params.max_matches < 1) {
        errors.push('max_matches must be a positive number');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if a file path matches the include pattern
   */
  private matchesIncludePattern(filePath: string, includePattern?: string): boolean {
    if (!includePattern) return true;

    // Convert glob pattern to regex (simplified)
    const regexPattern = includePattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape special regex chars
      .replace(/\*\*/g, '###DOUBLESTAR###')   // Temporarily replace **
      .replace(/\*/g, '[^/]*')                // * becomes [^/]* (no directory separators)
      .replace(/###DOUBLESTAR###/g, '.*')     // ** becomes .* (any characters)
      .replace(/\?/g, '[^/]');                // ? becomes [^/] (single char, no dir sep)

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }

  /**
   * Check if a file should be skipped based on common patterns
   */
  private shouldSkipFile(filePath: string): boolean {
    const skipPatterns = [
      /node_modules/,
      /\.git/,
      /\.vscode/,
      /dist/,
      /build/,
      /coverage/,
      /\.nyc_output/,
      /\.next/,
      /\.cache/,
      /\.DS_Store/,
      /Thumbs\.db/,
      /\.log$/,
      /\.tmp$/,
      /\.temp$/
    ];

    return skipPatterns.some(pattern => pattern.test(filePath));
  }

  /**
   * Recursively find files to search
   */
  private async findFilesToSearch(
    dirPath: string, 
    includePattern?: string, 
    maxFiles: number = 1000
  ): Promise<string[]> {
    const files: string[] = [];
    
    const scanDirectory = async (currentPath: string): Promise<void> => {
      if (files.length >= maxFiles) return;

      try {
        const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
        
        for (const entry of entries) {
          if (files.length >= maxFiles) break;

          const fullPath = path.join(currentPath, entry.name);
          const relativePath = path.relative(dirPath, fullPath);

          // Skip common directories and files
          if (this.shouldSkipFile(relativePath)) {
            continue;
          }

          if (entry.isDirectory()) {
            await scanDirectory(fullPath);
          } else if (entry.isFile()) {
            // Check if file matches include pattern
            if (this.matchesIncludePattern(relativePath, includePattern)) {
              // Only include text files (basic check)
              if (this.isTextFile(fullPath)) {
                files.push(fullPath);
              }
            }
          }
        }
      } catch (error) {
        // Ignore permission errors and continue
      }
    };

    await scanDirectory(dirPath);
    return files;
  }

  /**
   * Simple check if file is likely a text file
   */
  private isTextFile(filePath: string): boolean {
    const textExtensions = [
      '.js', '.ts', '.jsx', '.tsx', '.json', '.html', '.htm', '.css', '.scss', '.sass',
      '.py', '.java', '.cpp', '.c', '.h', '.hpp', '.cs', '.php', '.rb', '.go',
      '.rs', '.swift', '.kt', '.scala', '.clj', '.hs', '.elm', '.ml', '.f',
      '.txt', '.md', '.rst', '.asciidoc', '.xml', '.yaml', '.yml', '.toml',
      '.ini', '.cfg', '.conf', '.properties', '.env', '.gitignore', '.gitattributes',
      '.dockerfile', '.makefile', '.sh', '.bat', '.ps1', '.sql', '.graphql',
      '.vue', '.svelte', '.astro', '.prisma', '.proto'
    ];

    const ext = path.extname(filePath).toLowerCase();
    return textExtensions.includes(ext) || !ext; // Include extensionless files
  }

  /**
   * Search for pattern in a single file
   */
  private async searchInFile(filePath: string, regex: RegExp, maxMatches: number): Promise<GrepMatch[]> {
    const matches: GrepMatch[] = [];
    
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const lines = content.split(/\r?\n/);
      
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        if (matches.length >= maxMatches) break;

        const line = lines[lineIndex];
        let match;
        regex.lastIndex = 0; // Reset regex state
        
        while ((match = regex.exec(line)) !== null) {
          matches.push({
            filePath,
            lineNumber: lineIndex + 1,
            line: line,
            matchStart: match.index,
            matchEnd: match.index + match[0].length
          });

          if (matches.length >= maxMatches) break;
          
          // Prevent infinite loop on zero-length matches
          if (match.index === regex.lastIndex) {
            regex.lastIndex++;
          }
        }
      }
    } catch (error) {
      // Ignore files that can't be read (binary files, permission issues, etc.)
    }

    return matches;
  }

  async execute(params: GrepToolParams, context: ExecutionContext): Promise<ToolResult> {
    const startTime = Date.now();
    
    try {
      // Validate parameters
      const validation = this.validate(params);
      if (!validation.isValid) {
        return this.createResult(false, undefined, `Validation failed: ${validation.errors.join(', ')}`);
      }

      // Resolve search directory
      const searchPath = params.path || '.';
      const absolutePath = path.resolve(context.workingDirectory, searchPath);
      
      // Security check
      if (!this.validatePath(searchPath, context)) {
        return this.createResult(false, undefined, `Path must be within SuperDesign workspace: ${searchPath}`);
      }

      // Check if path exists and is a directory
      if (!fs.existsSync(absolutePath)) {
        return this.createResult(false, undefined, `Search path not found: ${searchPath}`);
      }

      const stats = fs.statSync(absolutePath);
      if (!stats.isDirectory()) {
        return this.createResult(false, undefined, `Search path is not a directory: ${searchPath}`);
      }

      const caseSensitive = params.case_sensitive || false;
      const maxFiles = params.max_files || 1000;
      const maxMatches = params.max_matches || 100;

      this.log(`Searching for pattern "${params.pattern}" in ${searchPath}`, context);

      // Create regex pattern
      const regexFlags = caseSensitive ? 'g' : 'gi';
      const regex = new RegExp(params.pattern, regexFlags);

      // Find files to search
      const filesToSearch = await this.findFilesToSearch(absolutePath, params.include, maxFiles);
      
      if (filesToSearch.length === 0) {
        const message = `No files found to search in ${searchPath}${params.include ? ` matching ${params.include}` : ''}`;
        return this.createResult(
          true,
          {
            pattern: params.pattern,
            search_path: searchPath,
            include_pattern: params.include,
            files_searched: 0,
            matches: [],
            total_matches: 0
          },
          message
        );
      }

      // Search in files
      const allMatches: GrepMatch[] = [];
      let filesSearched = 0;
      let filesWithMatches = 0;

      for (const file of filesToSearch) {
        if (allMatches.length >= maxMatches) break;

        const fileMatches = await this.searchInFile(file, regex, maxMatches - allMatches.length);
        if (fileMatches.length > 0) {
          // Convert absolute paths to relative paths for output
          const relativePath = path.relative(absolutePath, file);
          fileMatches.forEach(match => {
            match.filePath = relativePath;
          });
          
          allMatches.push(...fileMatches);
          filesWithMatches++;
        }
        filesSearched++;
      }

      const duration = Date.now() - startTime;

      // Format results
      let summary = `Found ${allMatches.length} match(es) for "${params.pattern}" in ${filesWithMatches} file(s)`;
      if (filesSearched < filesToSearch.length) {
        summary += ` (searched ${filesSearched}/${filesToSearch.length} files)`;
      }

      // Group matches by file for better readability
      const matchesByFile: Record<string, GrepMatch[]> = {};
      allMatches.forEach(match => {
        if (!matchesByFile[match.filePath]) {
          matchesByFile[match.filePath] = [];
        }
        matchesByFile[match.filePath].push(match);
      });

      this.log(summary, context);

      return this.createResult(
        true,
        {
          pattern: params.pattern,
          search_path: searchPath,
          include_pattern: params.include,
          files_searched: filesSearched,
          files_with_matches: filesWithMatches,
          matches: allMatches,
          matches_by_file: matchesByFile,
          total_matches: allMatches.length,
          summary,
          truncated: allMatches.length >= maxMatches
        },
        undefined,
        {
          duration,
          filesAffected: Object.keys(matchesByFile).map(f => path.resolve(absolutePath, f))
        }
      );

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.log(`Error in grep search: ${errorMessage}`, context);
      
      return this.createResult(
        false,
        undefined,
        `Failed to search files: ${errorMessage}`,
        { duration }
      );
    }
  }
} 