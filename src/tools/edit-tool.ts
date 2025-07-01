// import * as vscode from 'vscode';
// import * as fs from 'fs';
// import * as path from 'path';
// import { BaseTool, ToolResult, ExecutionContext, ToolSchema, ValidationResult } from './base-tool';

// /**
//  * Parameters for the Edit tool
//  */
// export interface EditToolParams {
//   /**
//    * The path to the file to edit (relative to workspace)
//    */
//   file_path: string;

//   /**
//    * The exact text to find and replace
//    */
//   old_string: string;

//   /**
//    * The text to replace it with
//    */
//   new_string: string;

//   /**
//    * Number of replacements expected (default: 1)
//    */
//   expected_replacements?: number;
// }

// /**
//  * Result of calculating an edit operation
//  */
// interface CalculatedEdit {
//   currentContent: string;
//   newContent: string;
//   occurrences: number;
//   isNewFile: boolean;
//   error?: string;
// }

// /**
//  * Tool for editing files using find-and-replace operations
//  */
// export class EditTool extends BaseTool {
//   readonly name = 'edit';
//   readonly description = 'Replace text within a file using exact string matching. Requires precise text matching including whitespace and indentation.';
  
//   readonly schema: ToolSchema = {
//     name: this.name,
//     description: this.description,
//     parameters: {
//       type: 'object',
//       properties: {
//         file_path: {
//           name: 'file_path',
//           type: 'string',
//           description: 'Path to the file to edit (relative to workspace root)',
//           required: true
//         },
//         old_string: {
//           name: 'old_string',
//           type: 'string',
//           description: 'The exact text to find and replace. Must match exactly including whitespace, indentation, and context. For single replacements, include 3+ lines of context before and after the target text.',
//           required: true
//         },
//         new_string: {
//           name: 'new_string',
//           type: 'string',
//           description: 'The text to replace old_string with. Should maintain proper indentation and formatting.',
//           required: true
//         },
//         expected_replacements: {
//           name: 'expected_replacements',
//           type: 'number',
//           description: 'Number of replacements expected (default: 1). Use when replacing multiple occurrences.',
//           required: false
//         }
//       },
//       required: ['file_path', 'old_string', 'new_string']
//     }
//   };

//   validate(params: EditToolParams): ValidationResult {
//     const errors: string[] = [];

//     // Basic parameter validation
//     if (!params.file_path || typeof params.file_path !== 'string') {
//       errors.push('file_path is required and must be a string');
//     }

//     if (params.old_string === undefined || params.old_string === null) {
//       errors.push('old_string is required');
//     }

//     if (typeof params.old_string !== 'string') {
//       errors.push('old_string must be a string');
//     }

//     if (params.new_string === undefined || params.new_string === null) {
//       errors.push('new_string is required');
//     }

//     if (typeof params.new_string !== 'string') {
//       errors.push('new_string must be a string');
//     }

//     if (params.expected_replacements !== undefined && 
//         (typeof params.expected_replacements !== 'number' || params.expected_replacements < 1)) {
//       errors.push('expected_replacements must be a positive number');
//     }

//     // Path validation
//     if (params.file_path) {
//       if (path.isAbsolute(params.file_path)) {
//         errors.push('file_path must be relative to workspace root, not absolute');
//       }

//       if (params.file_path.includes('..')) {
//         errors.push('file_path cannot contain ".." for security reasons');
//       }

//       if (params.file_path.startsWith('/') || params.file_path.startsWith('\\')) {
//         errors.push('file_path should not start with path separators');
//       }
//     }

//     return {
//       isValid: errors.length === 0,
//       errors
//     };
//   }

//   /**
//    * Calculate the edit operation without executing it
//    */
//   private calculateEdit(params: EditToolParams, context: ExecutionContext): CalculatedEdit {
//     const absolutePath = path.resolve(context.workingDirectory, params.file_path);
//     const expectedReplacements = params.expected_replacements ?? 1;
    
//     // Check if file exists
//     if (!fs.existsSync(absolutePath)) {
//       if (params.old_string === '') {
//         // Creating a new file
//         return {
//           currentContent: '',
//           newContent: params.new_string,
//           occurrences: 1,
//           isNewFile: true
//         };
//       } else {
//         return {
//           currentContent: '',
//           newContent: '',
//           occurrences: 0,
//           isNewFile: false,
//           error: `File not found: ${params.file_path}. Cannot apply edit. Use empty old_string to create a new file.`
//         };
//       }
//     }

//     // Read current content
//     let currentContent: string;
//     try {
//       currentContent = fs.readFileSync(absolutePath, 'utf8');
//       // Normalize line endings to LF
//       currentContent = currentContent.replace(/\r\n/g, '\n');
//     } catch (error) {
//       return {
//         currentContent: '',
//         newContent: '',
//         occurrences: 0,
//         isNewFile: false,
//         error: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`
//       };
//     }

//     // Handle creating file that already exists
//     if (params.old_string === '') {
//       return {
//         currentContent,
//         newContent: '',
//         occurrences: 0,
//         isNewFile: false,
//         error: `File already exists, cannot create: ${params.file_path}`
//       };
//     }

//     // Count occurrences
//     const occurrences = (currentContent.match(new RegExp(this.escapeRegExp(params.old_string), 'g')) || []).length;

//     // Validate occurrence count
//     if (occurrences === 0) {
//       return {
//         currentContent,
//         newContent: currentContent,
//         occurrences: 0,
//         isNewFile: false,
//         error: `Text not found in file. 0 occurrences of old_string found. Ensure exact text match including whitespace and indentation.`
//       };
//     }

//     if (occurrences !== expectedReplacements) {
//       return {
//         currentContent,
//         newContent: currentContent,
//         occurrences,
//         isNewFile: false,
//         error: `Expected ${expectedReplacements} replacement(s) but found ${occurrences} occurrence(s).`
//       };
//     }

//     // Apply replacement
//     const newContent = currentContent.split(params.old_string).join(params.new_string);

//     return {
//       currentContent,
//       newContent,
//       occurrences,
//       isNewFile: false
//     };
//   }

//   /**
//    * Escape special regex characters
//    */
//   private escapeRegExp(string: string): string {
//     return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
//   }

//   async execute(params: EditToolParams, context: ExecutionContext): Promise<ToolResult> {
//     const startTime = Date.now();
    
//     try {
//       // Validate parameters
//       const validation = this.validate(params);
//       if (!validation.isValid) {
//         return this.createResult(false, undefined, `Validation failed: ${validation.errors.join(', ')}`);
//       }

//       // Security check
//       if (!this.validatePath(params.file_path, context)) {
//         return this.createResult(false, undefined, `File path must be within SuperDesign workspace: ${params.file_path}`);
//       }

//       this.log(`Editing file: ${params.file_path}`, context);

//       // Calculate the edit
//       const editResult = this.calculateEdit(params, context);
      
//       if (editResult.error) {
//         return this.createResult(false, undefined, editResult.error);
//       }

//       const absolutePath = path.resolve(context.workingDirectory, params.file_path);

//       // Create parent directories if needed (for new files)
//       if (editResult.isNewFile) {
//         const dirName = path.dirname(absolutePath);
//         if (!fs.existsSync(dirName)) {
//           fs.mkdirSync(dirName, { recursive: true });
//           this.log(`Created parent directories for: ${params.file_path}`, context);
//         }
//       }

//       // Write the updated content
//       fs.writeFileSync(absolutePath, editResult.newContent, 'utf8');

//       const duration = Date.now() - startTime;
//       const newLines = editResult.newContent.split('\n').length;
//       const newSize = Buffer.byteLength(editResult.newContent, 'utf8');

//       if (editResult.isNewFile) {
//         this.log(`Created new file: ${params.file_path} (${newLines} lines)`, context);
//       } else {
//         this.log(`Applied ${editResult.occurrences} replacement(s) to: ${params.file_path} (${newLines} lines)`, context);
//       }

//       return this.createResult(
//         true,
//         {
//           file_path: params.file_path,
//           absolute_path: absolutePath,
//           is_new_file: editResult.isNewFile,
//           replacements_made: editResult.occurrences,
//           lines_total: newLines,
//           bytes_total: newSize,
//           old_string_length: params.old_string.length,
//           new_string_length: params.new_string.length
//         },
//         undefined,
//         {
//           duration,
//           filesAffected: [absolutePath],
//           outputSize: newSize
//         }
//       );

//     } catch (error) {
//       const duration = Date.now() - startTime;
//       const errorMessage = error instanceof Error ? error.message : String(error);
      
//       this.log(`Error editing file: ${errorMessage}`, context);
      
//       return this.createResult(
//         false,
//         undefined,
//         `Failed to edit file: ${errorMessage}`,
//         { duration }
//       );
//     }
//   }
// } 