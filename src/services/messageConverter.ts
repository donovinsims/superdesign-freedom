import { CoreMessage } from 'ai';
import { ChatMessage } from '../webview/hooks/useChat';

// Type definitions for tool parts (if not exported from 'ai')
interface ToolCallPart {
    type: 'tool-call';
    toolCallId: string;
    toolName: string;
    args: unknown;
}

interface ToolResultPart {
    type: 'tool-result';
    toolCallId: string;
    toolName: string;
    result: unknown;
    isError?: boolean;
}

/**
 * Convert frontend ChatMessage[] to AI SDK CoreMessage[] format
 * 
 * Conversion Rules:
 * - 'user-input' → user role with text content
 * - 'assistant' → assistant role with text content  
 * - 'tool' → assistant role with ToolCallPart + tool role with ToolResultPart (if result exists)
 * - 'result' → SKIP (metadata only)
 * - 'tool-group' → SKIP (UI grouping only)
 */
export function convertChatHistoryToAISDK(chatHistory: ChatMessage[]): CoreMessage[] {
    const convertedMessages: CoreMessage[] = [];
    
    for (const chatMessage of chatHistory) {
        try {
            console.log('=== Converting chat message:', chatMessage);
            
            // Special handling for tool messages that contain both call and result
            if (chatMessage.type === 'tool') {
                console.log('===> Converting tool message with both call and result');
                
                // Always add the tool call
                const toolCall = convertToolCallMessage(chatMessage);
                if (toolCall) {
                    console.log('=== Converted tool call:', toolCall);
                    convertedMessages.push(toolCall);
                }
                
                // Only add tool result if it exists
                if (chatMessage.metadata?.tool_result) {
                    const toolResult = convertToolResultMessage(chatMessage);
                    if (toolResult) {
                        console.log('=== Converted tool result:', toolResult);
                        convertedMessages.push(toolResult);
                    }
                }
            } else {
                // Handle all other message types normally
                const converted = convertSingleMessage(chatMessage);
                console.log('=== Converted message:', converted);
                if (converted) {
                    convertedMessages.push(converted);
                }
            }
        } catch (error) {
            console.warn('Failed to convert chat message:', chatMessage, 'Error:', error);
            // Continue processing other messages
        }
    }
    
    return convertedMessages;
}

/**
 * Convert a single ChatMessage to CoreMessage
 * Returns null if message should be skipped
 */
function convertSingleMessage(chatMessage: ChatMessage): CoreMessage | null {
    console.log('===> convertting single message', chatMessage);
    switch (chatMessage.type) {
        case 'user-input':
            return convertUserInputMessage(chatMessage);
            
        case 'assistant':
            return convertAssistantMessage(chatMessage);
            
        case 'tool':
            // This case is now handled in the main loop above
            console.warn('Tool message should be handled in main loop, not here');
            return null;
            
        case 'result':
        case 'tool-group':
            // Skip metadata and UI grouping messages
            return null;
            
        default:
            console.warn('Unknown message type:', chatMessage.type);
            return null;
    }
}

/**
 * Convert user-input type to user role message
 * Handles both simple text messages and structured content with images
 */
function convertUserInputMessage(chatMessage: ChatMessage): CoreMessage {
    // Check if we have structured content (for images)
    if (chatMessage.content && Array.isArray(chatMessage.content)) {
        // Handle structured content with text and image parts
        const contentParts: any[] = [];
        
        for (const part of chatMessage.content) {
            if (part.type === 'text' && part.text) {
                contentParts.push({
                    type: 'text',
                    text: part.text
                });
            } else if (part.type === 'image' && part.image) {
                contentParts.push({
                    type: 'image',
                    image: part.image, // Base64 string or URL
                    mimeType: part.mimeType
                });
            }
        }
        
        return {
            role: 'user',
            content: contentParts.length > 0 ? contentParts : [{
                type: 'text',
                text: chatMessage.message || '[Message with attachments]'
            }]
        };
    } else {
        // Handle simple text content (original behavior)
        return {
            role: 'user',
            content: [{
                type: 'text',
                text: chatMessage.message
            }]
        };
    }
}

/**
 * Convert assistant type to assistant role message
 */
function convertAssistantMessage(chatMessage: ChatMessage): CoreMessage {
    return {
        role: 'assistant',
        content: [{
            type: 'text',
            text: chatMessage.message
        }]
    };
}

/**
 * Convert tool type to assistant role with ToolCallPart content
 */
function convertToolCallMessage(chatMessage: ChatMessage): CoreMessage | null {
    const metadata = chatMessage.metadata;
    
    if (!metadata?.tool_name) {
        console.warn('Tool message missing tool_name:', metadata);
        return null;
    }
    
    if (!metadata?.tool_id) {
        console.warn('Tool message missing tool_id:', metadata);
        return null;
    }
    
    // Create proper ToolCallPart structure
    const toolCallPart: ToolCallPart = {
        type: 'tool-call',
        toolCallId: metadata.tool_id,
        toolName: metadata.tool_name,
        args: metadata.tool_input || {}
    };
    
    return {
        role: 'assistant',
        content: [toolCallPart]
    };
}

/**
 * Convert tool-result type to tool role with ToolResultPart content
 */
function convertToolResultMessage(chatMessage: ChatMessage): CoreMessage | null {
    const metadata = chatMessage.metadata;
    
    if (!metadata?.tool_name) {
        console.warn('Tool result message missing tool_name:', metadata);
        return null;
    }
    
    if (!metadata?.tool_id) {
        console.warn('Tool result message missing tool_id:', metadata);
        return null;
    }
    
    // Extract result content
    const resultContent = metadata.tool_result || chatMessage.message;
    
    // Create proper ToolResultPart structure
    const toolResultPart: ToolResultPart = {
        type: 'tool-result',
        toolCallId: metadata.tool_id,
        toolName: metadata.tool_name,
        result: resultContent,
        isError: metadata.result_is_error || false
    };
    
    return {
        role: 'tool',
        content: [toolResultPart]
    };
}

/**
 * Helper function to validate converted messages
 * Ensures proper tool call/result structure and reasonable message flow
 */
export function validateConvertedMessages(messages: CoreMessage[]): {
    isValid: boolean;
    warnings: string[];
} {
    const warnings: string[] = [];
    let isValid = true;
    
    if (messages.length === 0) {
        return { isValid: true, warnings: [] };
    }
    
    // Check for consecutive messages from same role (except system)
    for (let i = 1; i < messages.length; i++) {
        const prev = messages[i - 1];
        const curr = messages[i];
        
        if (prev.role === curr.role && curr.role !== 'system') {
            warnings.push(`Consecutive ${curr.role} messages at index ${i - 1} and ${i}`);
        }
    }
    
    // Check for proper tool call/result structure
    for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        
        if (message.role === 'assistant' && Array.isArray(message.content)) {
            const toolCalls = message.content.filter((part: any) => part.type === 'tool-call');
            if (toolCalls.length > 0) {
                for (const toolCall of toolCalls) {
                    const tc = toolCall as ToolCallPart;
                    if (!tc.toolCallId || !tc.toolName) {
                        warnings.push(`Invalid tool call structure at index ${i}`);
                    }
                }
            }
        }
        
        if (message.role === 'tool' && Array.isArray(message.content)) {
            for (const toolResult of message.content) {
                if (toolResult.type === 'tool-result') {
                    const tr = toolResult as ToolResultPart;
                    if (!tr.toolCallId || !tr.toolName) {
                        warnings.push(`Invalid tool result structure at index ${i}`);
                    }
                }
            }
        }
    }
    
    return { isValid: warnings.length === 0, warnings };
}

/**
 * Debug helper to log conversion results
 */
export function debugConversion(
    originalMessages: ChatMessage[], 
    convertedMessages: CoreMessage[]
): void {
    console.group('🔄 Message Conversion Debug');
    console.log(`📥 Input: ${originalMessages.length} frontend messages`);
    console.log(`📤 Output: ${convertedMessages.length} AI SDK messages`);
    
    const skippedCount = originalMessages.length - convertedMessages.length;
    if (skippedCount > 0) {
        console.log(`⏭️ Skipped: ${skippedCount} messages (metadata/grouping)`);
    }
    
    const validation = validateConvertedMessages(convertedMessages);
    if (!validation.isValid) {
        console.warn('⚠️ Validation warnings:', validation.warnings);
    } else {
        console.log('✅ Conversion validation passed');
    }
    console.log('📋 Original messages:', originalMessages);
    console.log('📋 Converted messages:', convertedMessages);
    console.groupEnd();
} 