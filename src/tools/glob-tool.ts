// import * as vscode from 'vscode';
// import * as fs from 'fs';
// import * as path from 'path';
// import { BaseTool, ToolResult, ExecutionContext, ToolSchema, ValidationResult } from './base-tool';

// /**
//  * Parameters for the Glob tool
//  */
// export interface GlobToolParams {
//   /**
//    * The glob pattern to match files against
//    */
//   pattern: string;

//   /**
//    * The directory to search in (relative to workspace)
//    */
//   path?: string;

//   /**
//    * Whether the search should be case-sensitive
//    */
//   case_sensitive?: boolean;

//   /**
//    * Whether to include directories in results (default: false)
//    */
//   include_dirs?: boolean;

//   /**
//    * Whether to show hidden files (starting with .)
//    */
//   show_hidden?: boolean;

//   /**
//    * Maximum number of results to return (default: 500)
//    */
//   max_results?: number;

//   /**
//    * Whether to sort results by modification time (newest first)
//    */
//   sort_by_time?: boolean;
// }

// /**
//  * Single file entry result
//  */
// export interface GlobFileEntry {
//   /**
//    * Relative path from search directory
//    */
//   path: string;

//   /**
//    * Absolute path
//    */
//   absolutePath: string;

//   /**
//    * Whether this is a directory
//    */
//   isDirectory: boolean;

//   /**
//    * File size in bytes (0 for directories)
//    */
//   size: number;

//   /**
//    * Last modified timestamp
//    */
//   modifiedTime: Date;

//   /**
//    * File extension (if applicable)
//    */
//   extension?: string;
// }

// /**
//  * Tool for finding files matching glob patterns
//  */
// export class GlobTool extends BaseTool {
//   readonly name = 'glob';
//   readonly description = 'Find files and directories matching glob patterns (e.g., "*.js", "src/**/*.ts"). Efficient for locating files by name or path structure.';
  
//   readonly schema: ToolSchema = {
//     name: this.name,
//     description: this.description,
//     parameters: {
//       type: 'object',
//       properties: {
//         pattern: {
//           name: 'pattern',
//           type: 'string',
//           description: 'Glob pattern to match (e.g., "*.js", "src/**/*.ts", "**/*.{js,ts}")',
//           required: true
//         },
//         path: {
//           name: 'path',
//           type: 'string',
//           description: 'Directory to search in (relative to workspace root). Defaults to workspace root.',
//           required: false
//         },
//         case_sensitive: {
//           name: 'case_sensitive',
//           type: 'boolean',
//           description: 'Whether the search should be case-sensitive (default: false)',
//           required: false
//         },
//         include_dirs: {
//           name: 'include_dirs',
//           type: 'boolean',
//           description: 'Whether to include directories in results (default: false)',
//           required: false
//         },
//         show_hidden: {
//           name: 'show_hidden',
//           type: 'boolean',
//           description: 'Whether to include hidden files/directories (starting with .)',
//           required: false
//         },
//         max_results: {
//           name: 'max_results',
//           type: 'number',
//           description: 'Maximum number of results to return (default: 500)',
//           required: false
//         },
//         sort_by_time: {
//           name: 'sort_by_time',
//           type: 'boolean',
//           description: 'Whether to sort results by modification time, newest first (default: false)',
//           required: false
//         }
//       },
//       required: ['pattern']
//     }
//   };

//   validate(params: GlobToolParams): ValidationResult {
//     const errors: string[] = [];

//     // Pattern validation
//     if (!params.pattern || typeof params.pattern !== 'string') {
//       errors.push('pattern is required and must be a string');
//     } else {
//       if (params.pattern.trim() === '') {
//         errors.push('pattern cannot be empty');
//       }
//     }

//     // Path validation
//     if (params.path) {
//       if (typeof params.path !== 'string') {
//         errors.push('path must be a string');
//       } else {
//         if (path.isAbsolute(params.path)) {
//           errors.push('path must be relative to workspace root, not absolute');
//         }

//         if (params.path.includes('..')) {
//           errors.push('path cannot contain ".." for security reasons');
//         }
//       }
//     }

//     // Boolean validation
//     if (params.case_sensitive !== undefined && typeof params.case_sensitive !== 'boolean') {
//       errors.push('case_sensitive must be a boolean');
//     }

//     if (params.include_dirs !== undefined && typeof params.include_dirs !== 'boolean') {
//       errors.push('include_dirs must be a boolean');
//     }

//     if (params.show_hidden !== undefined && typeof params.show_hidden !== 'boolean') {
//       errors.push('show_hidden must be a boolean');
//     }

//     if (params.sort_by_time !== undefined && typeof params.sort_by_time !== 'boolean') {
//       errors.push('sort_by_time must be a boolean');
//     }

//     // Number validation
//     if (params.max_results !== undefined) {
//       if (typeof params.max_results !== 'number' || params.max_results < 1) {
//         errors.push('max_results must be a positive number');
//       }
//     }

//     return {
//       isValid: errors.length === 0,
//       errors
//     };
//   }

//   /**
//    * Convert glob pattern to regex pattern
//    */
//   private globToRegex(pattern: string, caseSensitive: boolean = false): RegExp {
//     // Handle special cases for braces {js,ts}
//     let regexPattern = pattern;
    
//     // Handle brace expansion like {js,ts,jsx}
//     const braceRegex = /\{([^}]+)\}/g;
//     regexPattern = regexPattern.replace(braceRegex, (match, content) => {
//       const options = content.split(',').map((s: string) => s.trim());
//       return `(${options.join('|')})`;
//     });

//     // Escape regex special characters except glob chars
//     regexPattern = regexPattern
//       .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape special regex chars except *, ?, and already handled {}
//       .replace(/\\\{/g, '{')                 // Restore { that we want to keep
//       .replace(/\\\}/g, '}')                 // Restore } that we want to keep
//       .replace(/\\\|/g, '|')                 // Restore | that we want to keep
//       .replace(/\\\(/g, '(')                 // Restore ( that we want to keep
//       .replace(/\\\)/g, ')')                 // Restore ) that we want to keep

//     // Handle glob patterns
//     regexPattern = regexPattern
//       .replace(/\*\*/g, '###DOUBLESTAR###')   // Temporarily replace **
//       .replace(/\*/g, '[^/]*')                // * becomes [^/]* (match any chars except path separator)
//       .replace(/###DOUBLESTAR###/g, '.*')     // ** becomes .* (match any chars including path separator)
//       .replace(/\?/g, '[^/]');                // ? becomes [^/] (match single char except path separator)

//     const flags = caseSensitive ? '' : 'i';
//     return new RegExp(`^${regexPattern}$`, flags);
//   }

//   /**
//    * Check if a file should be skipped based on common patterns
//    */
//   private shouldSkipPath(relativePath: string, showHidden: boolean): boolean {
//     // Skip hidden files unless requested
//     if (!showHidden && relativePath.split('/').some(part => part.startsWith('.'))) {
//       return true;
//     }

//     // Skip common directories that should never be searched
//     const skipPatterns = [
//       /node_modules/,
//       /\.git$/,
//       /\.svn$/,
//       /\.hg$/,
//       /\.vscode$/,
//       /dist$/,
//       /build$/,
//       /coverage$/,
//       /\.nyc_output$/,
//       /\.next$/,
//       /\.cache$/
//     ];

//     return skipPatterns.some(pattern => pattern.test(relativePath));
//   }

//   /**
//    * Recursively find files matching the pattern
//    */
//   private async findMatches(
//     searchDir: string,
//     pattern: RegExp,
//     options: {
//       includeDirs: boolean;
//       showHidden: boolean;
//       maxResults: number;
//     }
//   ): Promise<GlobFileEntry[]> {
//     const results: GlobFileEntry[] = [];
    
//     const scanDirectory = async (currentDir: string): Promise<void> => {
//       if (results.length >= options.maxResults) return;

//       try {
//         const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
        
//         for (const entry of entries) {
//           if (results.length >= options.maxResults) break;

//           const fullPath = path.join(currentDir, entry.name);
//           const relativePath = path.relative(searchDir, fullPath);

//           // Skip paths that should be ignored
//           if (this.shouldSkipPath(relativePath, options.showHidden)) {
//             continue;
//           }

//           const isDirectory = entry.isDirectory();

//           // Check if this path matches the pattern
//           const matches = pattern.test(relativePath);
          
//           if (matches && (options.includeDirs || !isDirectory)) {
//             try {
//               const stats = await fs.promises.stat(fullPath);
              
//               results.push({
//                 path: relativePath,
//                 absolutePath: fullPath,
//                 isDirectory,
//                 size: isDirectory ? 0 : stats.size,
//                 modifiedTime: stats.mtime,
//                 extension: isDirectory ? undefined : path.extname(entry.name).slice(1)
//               });
//             } catch (error) {
//               // Ignore stat errors and continue
//             }
//           }

//           // Recursively scan subdirectories
//           if (isDirectory) {
//             await scanDirectory(fullPath);
//           }
//         }
//       } catch (error) {
//         // Ignore permission errors and continue
//       }
//     };

//     await scanDirectory(searchDir);
//     return results;
//   }

//   /**
//    * Sort results by modification time (newest first) or alphabetically
//    */
//   private sortResults(results: GlobFileEntry[], sortByTime: boolean): GlobFileEntry[] {
//     if (!sortByTime) {
//       // Sort alphabetically with directories first
//       return results.sort((a, b) => {
//         if (a.isDirectory && !b.isDirectory) return -1;
//         if (!a.isDirectory && b.isDirectory) return 1;
//         return a.path.localeCompare(b.path);
//       });
//     }

//     // Sort by modification time (newest first) with recent files prioritized
//     const oneDayAgo = new Date().getTime() - (24 * 60 * 60 * 1000);
    
//     return results.sort((a, b) => {
//       const aTime = a.modifiedTime.getTime();
//       const bTime = b.modifiedTime.getTime();
//       const aIsRecent = aTime > oneDayAgo;
//       const bIsRecent = bTime > oneDayAgo;

//       // Both recent: newest first
//       if (aIsRecent && bIsRecent) {
//         return bTime - aTime;
//       }
      
//       // One recent: recent first
//       if (aIsRecent) return -1;
//       if (bIsRecent) return 1;
      
//       // Both old: alphabetical
//       return a.path.localeCompare(b.path);
//     });
//   }

//   async execute(params: GlobToolParams, context: ExecutionContext): Promise<ToolResult> {
//     const startTime = Date.now();
    
//     try {
//       // Validate parameters
//       const validation = this.validate(params);
//       if (!validation.isValid) {
//         return this.createResult(false, undefined, `Validation failed: ${validation.errors.join(', ')}`);
//       }

//       // Resolve search directory
//       const searchPath = params.path || '.';
//       const absolutePath = path.resolve(context.workingDirectory, searchPath);
      
//       // Security check
//       if (!this.validatePath(searchPath, context)) {
//         return this.createResult(false, undefined, `Path must be within SuperDesign workspace: ${searchPath}`);
//       }

//       // Check if path exists and is a directory
//       if (!fs.existsSync(absolutePath)) {
//         return this.createResult(false, undefined, `Search path not found: ${searchPath}`);
//       }

//       const stats = fs.statSync(absolutePath);
//       if (!stats.isDirectory()) {
//         return this.createResult(false, undefined, `Search path is not a directory: ${searchPath}`);
//       }

//       const caseSensitive = params.case_sensitive || false;
//       const includeDirs = params.include_dirs || false;
//       const showHidden = params.show_hidden || false;
//       const maxResults = params.max_results || 500;
//       const sortByTime = params.sort_by_time || false;

//       this.log(`Finding files matching pattern "${params.pattern}" in ${searchPath}`, context);

//       // Convert glob pattern to regex
//       const regex = this.globToRegex(params.pattern, caseSensitive);

//       // Find matching files
//       const matches = await this.findMatches(absolutePath, regex, {
//         includeDirs,
//         showHidden,
//         maxResults
//       });

//       // Sort results
//       const sortedMatches = this.sortResults(matches, sortByTime);

//       const duration = Date.now() - startTime;

//       // Create summary
//       const fileCount = sortedMatches.filter(m => !m.isDirectory).length;
//       const dirCount = sortedMatches.filter(m => m.isDirectory).length;
      
//       let summary = `Found ${sortedMatches.length} match(es) for pattern "${params.pattern}"`;
//       if (fileCount > 0 && dirCount > 0) {
//         summary += ` (${fileCount} files, ${dirCount} directories)`;
//       } else if (fileCount > 0) {
//         summary += ` (${fileCount} files)`;
//       } else if (dirCount > 0) {
//         summary += ` (${dirCount} directories)`;
//       }

//       if (sortedMatches.length >= maxResults) {
//         summary += ` - results truncated at ${maxResults}`;
//       }

//       this.log(summary, context);

//       return this.createResult(
//         true,
//         {
//           pattern: params.pattern,
//           search_path: searchPath,
//           matches: sortedMatches,
//           total_matches: sortedMatches.length,
//           file_count: fileCount,
//           directory_count: dirCount,
//           summary,
//           truncated: sortedMatches.length >= maxResults,
//           sorted_by_time: sortByTime
//         },
//         undefined,
//         {
//           duration,
//           filesAffected: sortedMatches.map(m => m.absolutePath)
//         }
//       );

//     } catch (error) {
//       const duration = Date.now() - startTime;
//       const errorMessage = error instanceof Error ? error.message : String(error);
      
//       this.log(`Error in glob search: ${errorMessage}`, context);
      
//       return this.createResult(
//         false,
//         undefined,
//         `Failed to find files: ${errorMessage}`,
//         { duration }
//       );
//     }
//   }
// } 