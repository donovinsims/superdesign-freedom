import { DefaultToolRegistry, ToolRegistry, Tool } from './base-tool';
import { ReadTool } from './read-tool';

/**
 * SuperDesign Tool Registry
 * Contains all tools required for SuperDesign's coding agent
 */
export class SuperDesignToolRegistry extends DefaultToolRegistry {
  
  constructor() {
    super();
    this.registerSuperDesignTools();
  }

  /**
   * Register all SuperDesign-specific tools
   */
  private registerSuperDesignTools(): void {
    // File Operations
    this.registerTool(new ReadTool());
    
    // TODO: Register additional tools as they're implemented
    // this.registerTool(new WriteTool());
    // this.registerTool(new EditTool());
    // this.registerTool(new MultiEditTool());
    
    // TODO: Directory Operations
    // this.registerTool(new LSTool());
    
    // TODO: Search Operations
    // this.registerTool(new GrepTool());
    // this.registerTool(new GlobTool());
    
    // TODO: Command Execution
    // this.registerTool(new BashTool());
  }

  /**
   * Get tools by category
   */
  getFileTools(): Tool[] {
    return this.getToolsByPattern(/^(read|write|edit|multiedit)$/);
  }

  getSearchTools(): Tool[] {
    return this.getToolsByPattern(/^(grep|glob|ls)$/);
  }

  getExecutionTools(): Tool[] {
    return this.getToolsByPattern(/^(bash|shell|run)$/);
  }

  /**
   * Get essential tools for basic SuperDesign functionality
   */
  getEssentialTools(): Tool[] {
    const essentialToolNames = ['read', 'write', 'edit', 'ls'];
    return this.getAllTools().filter(tool => essentialToolNames.includes(tool.name));
  }

  /**
   * Validate that all required SuperDesign tools are available
   */
  validateSupport(): { isValid: boolean; missingTools: string[] } {
    const requiredTools = [
      'read',   // ReadTool - ✅ Implemented
      'write',  // WriteTool - TODO
      'edit',   // EditTool - TODO
      'ls'      // LSTool - TODO
    ];

    const missingTools = requiredTools.filter(toolName => !this.hasTool(toolName));

    return {
      isValid: missingTools.length === 0,
      missingTools
    };
  }

  /**
   * Get tool statistics for debugging/monitoring
   */
  getToolStats(): {
    total: number;
    byCategory: {
      file: number;
      search: number;
      execution: number;
    };
    implemented: string[];
    pending: string[];
  } {
    const fileTools = this.getFileTools();
    const searchTools = this.getSearchTools();
    const executionTools = this.getExecutionTools();
    
    const allTools = this.getAllTools();
    const implementedTools = allTools.map(tool => tool.name);
    
    const plannedTools = [
      'read', 'write', 'edit', 'multiedit',  // File tools
      'ls', 'grep', 'glob',                  // Search tools
      'bash'                                 // Execution tools
    ];
    
    const pendingTools = plannedTools.filter(toolName => !implementedTools.includes(toolName));

    return {
      total: allTools.length,
      byCategory: {
        file: fileTools.length,
        search: searchTools.length,
        execution: executionTools.length
      },
      implemented: implementedTools,
      pending: pendingTools
    };
  }
}

/**
 * Create and return a configured SuperDesign tool registry
 */
export function createSuperDesignToolRegistry(): SuperDesignToolRegistry {
  return new SuperDesignToolRegistry();
}

/**
 * Export the standard registry interface for compatibility
 */
export { ToolRegistry, Tool } from './base-tool'; 