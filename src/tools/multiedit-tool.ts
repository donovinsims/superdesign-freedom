// import * as vscode from 'vscode';
// import * as fs from 'fs';
// import * as path from 'path';
// import { BaseTool, ToolResult, ExecutionContext, ToolSchema, ValidationResult } from './base-tool';

// /**
//  * Single edit operation within a multi-edit
//  */
// export interface SingleEdit {
//   /**
//    * The exact text to find and replace
//    */
//   old_string: string;

//   /**
//    * The text to replace it with
//    */
//   new_string: string;

//   /**
//    * Number of replacements expected for this edit (default: 1)
//    */
//   expected_replacements?: number;
// }

// /**
//  * Parameters for the MultiEdit tool
//  */
// export interface MultiEditToolParams {
//   /**
//    * The path to the file to edit (relative to workspace)
//    */
//   file_path: string;

//   /**
//    * Array of edit operations to perform
//    */
//   edits: SingleEdit[];

//   /**
//    * Whether to stop on first error or continue with remaining edits
//    */
//   fail_fast?: boolean;
// }

// /**
//  * Result of a single edit operation
//  */
// interface EditResult {
//   edit: SingleEdit;
//   success: boolean;
//   occurrences: number;
//   error?: string;
// }

// /**
//  * Tool for performing multiple find-and-replace operations on a single file
//  */
// export class MultiEditTool extends BaseTool {
//   readonly name = 'multiedit';
//   readonly description = 'Perform multiple find-and-replace operations on a single file in sequence. Each edit is applied to the result of the previous edit.';
  
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
//         edits: {
//           name: 'edits',
//           type: 'array',
//           description: 'Array of edit operations to perform in sequence',
//           required: true,
//           items: {
//             name: 'edit',
//             type: 'object',
//             description: 'Single edit operation',
//             properties: {
//               old_string: {
//                 name: 'old_string',
//                 type: 'string',
//                 description: 'The exact text to find and replace. Must match exactly including whitespace.',
//                 required: true
//               },
//               new_string: {
//                 name: 'new_string',
//                 type: 'string',
//                 description: 'The text to replace old_string with.',
//                 required: true
//               },
//               expected_replacements: {
//                 name: 'expected_replacements',
//                 type: 'number',
//                 description: 'Number of replacements expected (default: 1)',
//                 required: false
//               }
//             }
//           }
//         },
//         fail_fast: {
//           name: 'fail_fast',
//           type: 'boolean',
//           description: 'Whether to stop on first error (true) or continue with remaining edits (false, default)',
//           required: false
//         }
//       },
//       required: ['file_path', 'edits']
//     }
//   };

//   validate(params: MultiEditToolParams): ValidationResult {
//     const errors: string[] = [];

//     // Basic parameter validation
//     if (!params.file_path || typeof params.file_path !== 'string') {
//       errors.push('file_path is required and must be a string');
//     }

//     if (!params.edits || !Array.isArray(params.edits)) {
//       errors.push('edits is required and must be an array');
//     } else {
//       if (params.edits.length === 0) {
//         errors.push('edits array cannot be empty');
//       }

//       // Validate each edit
//       params.edits.forEach((edit, index) => {
//         if (!edit || typeof edit !== 'object') {
//           errors.push(`edits[${index}] must be an object`);
//           return;
//         }

//         if (edit.old_string === undefined || edit.old_string === null) {
//           errors.push(`edits[${index}].old_string is required`);
//         }

//         if (typeof edit.old_string !== 'string') {
//           errors.push(`edits[${index}].old_string must be a string`);
//         }

//         if (edit.new_string === undefined || edit.new_string === null) {
//           errors.push(`edits[${index}].new_string is required`);
//         }

//         if (typeof edit.new_string !== 'string') {
//           errors.push(`edits[${index}].new_string must be a string`);
//         }

//         if (edit.expected_replacements !== undefined && 
//             (typeof edit.expected_replacements !== 'number' || edit.expected_replacements < 1)) {
//           errors.push(`edits[${index}].expected_replacements must be a positive number`);
//         }
//       });
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
//    * Apply a single edit to content
//    */
//   private applySingleEdit(content: string, edit: SingleEdit): EditResult {
//     const expectedReplacements = edit.expected_replacements ?? 1;

//     // Count occurrences
//     const regex = new RegExp(this.escapeRegExp(edit.old_string), 'g');
//     const matches = content.match(regex) || [];
//     const occurrences = matches.length;

//     // Validate occurrence count
//     if (occurrences === 0) {
//       return {
//         edit,
//         success: false,
//         occurrences: 0,
//         error: `Text not found: "${edit.old_string.substring(0, 50)}${edit.old_string.length > 50 ? '...' : ''}"`
//       };
//     }

//     if (occurrences !== expectedReplacements) {
//       return {
//         edit,
//         success: false,
//         occurrences,
//         error: `Expected ${expectedReplacements} replacement(s) but found ${occurrences} occurrence(s)`
//       };
//     }

//     return {
//       edit,
//       success: true,
//       occurrences
//     };
//   }

//   /**
//    * Escape special regex characters
//    */
//   private escapeRegExp(string: string): string {
//     return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
//   }

//   async execute(params: MultiEditToolParams, context: ExecutionContext): Promise<ToolResult> {
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

//       const absolutePath = path.resolve(context.workingDirectory, params.file_path);

//       // Check if file exists
//       if (!fs.existsSync(absolutePath)) {
//         return this.createResult(false, undefined, `File not found: ${params.file_path}`);
//       }

//       this.log(`Performing ${params.edits.length} edit(s) on: ${params.file_path}`, context);

//       // Read current content
//       let currentContent: string;
//       try {
//         currentContent = fs.readFileSync(absolutePath, 'utf8');
//         // Normalize line endings to LF
//         currentContent = currentContent.replace(/\r\n/g, '\n');
//       } catch (error) {
//         return this.createResult(false, undefined, `Failed to read file: ${error instanceof Error ? error.message : String(error)}`);
//       }

//       const originalContent = currentContent;
//       const failFast = params.fail_fast !== false; // Default to true
//       const editResults: EditResult[] = [];
//       let successCount = 0;
//       let totalReplacements = 0;

//       // Apply edits sequentially
//       for (let i = 0; i < params.edits.length; i++) {
//         const edit = params.edits[i];
        
//         this.log(`Applying edit ${i + 1}/${params.edits.length}: "${edit.old_string.substring(0, 30)}..." => "${edit.new_string.substring(0, 30)}..."`, context);

//         const editResult = this.applySingleEdit(currentContent, edit);
//         editResults.push(editResult);

//         if (editResult.success) {
//           // Apply the edit
//           currentContent = currentContent.split(edit.old_string).join(edit.new_string);
//           successCount++;
//           totalReplacements += editResult.occurrences;
//           this.log(`✓ Edit ${i + 1} successful: ${editResult.occurrences} replacement(s)`, context);
//         } else {
//           this.log(`✗ Edit ${i + 1} failed: ${editResult.error}`, context);
          
//           if (failFast) {
//             return this.createResult(
//               false,
//               {
//                 file_path: params.file_path,
//                 edits_attempted: i + 1,
//                 edits_successful: successCount,
//                 edit_results: editResults
//               },
//               `Edit operation failed at step ${i + 1}: ${editResult.error}`
//             );
//           }
//         }
//       }

//       // Write the updated content if any edits were successful
//       if (successCount > 0) {
//         fs.writeFileSync(absolutePath, currentContent, 'utf8');
//       }

//       const duration = Date.now() - startTime;
//       const newLines = currentContent.split('\n').length;
//       const newSize = Buffer.byteLength(currentContent, 'utf8');
//       const hasErrors = editResults.some(r => !r.success);

//       this.log(`Multi-edit completed: ${successCount}/${params.edits.length} edits successful, ${totalReplacements} total replacements`, context);

//       return this.createResult(
//         !hasErrors || (!failFast && successCount > 0),
//         {
//           file_path: params.file_path,
//           absolute_path: absolutePath,
//           edits_total: params.edits.length,
//           edits_successful: successCount,
//           edits_failed: params.edits.length - successCount,
//           total_replacements: totalReplacements,
//           lines_total: newLines,
//           bytes_total: newSize,
//           content_changed: currentContent !== originalContent,
//           edit_results: editResults
//         },
//         hasErrors && failFast ? `Some edits failed${failFast ? ' (fail-fast mode)' : ''}` : undefined,
//         {
//           duration,
//           filesAffected: successCount > 0 ? [absolutePath] : [],
//           outputSize: newSize
//         }
//       );

//     } catch (error) {
//       const duration = Date.now() - startTime;
//       const errorMessage = error instanceof Error ? error.message : String(error);
      
//       this.log(`Error in multi-edit: ${errorMessage}`, context);
      
//       return this.createResult(
//         false,
//         undefined,
//         `Failed to perform multi-edit: ${errorMessage}`,
//         { duration }
//       );
//     }
//   }
// } 