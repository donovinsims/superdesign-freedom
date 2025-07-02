import { CoreMessage } from 'ai';
import { ChatMessage } from '../webview/hooks/useChat';

/**
 * Convert frontend ChatMessage[] to AI SDK CoreMessage[] format
 * 
 * Conversion Rules:
 * - 'user-input' → user role with text content
 * - 'assistant' → assistant role with text content  
 * - 'tool' → assistant role with tool-call content
 * - 'tool-result' → user role with tool-result content
 * - 'result' → SKIP (metadata only)
 * - 'tool-group' → SKIP (UI grouping only)
 */
export function convertChatHistoryToAISDK(chatHistory: ChatMessage[]): CoreMessage[] {
    const convertedMessages: CoreMessage[] = [];
    
    for (const chatMessage of chatHistory) {
        try {
            const converted = convertSingleMessage(chatMessage);
            if (converted) {
                convertedMessages.push(converted);
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
    switch (chatMessage.type) {
        case 'user-input':
            return convertUserInputMessage(chatMessage);
            
        case 'assistant':
            return convertAssistantMessage(chatMessage);
            
        case 'tool':
            return convertToolMessage(chatMessage);
            
        case 'tool-result':
            return convertToolResultMessage(chatMessage);
            
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
 */
function convertUserInputMessage(chatMessage: ChatMessage): CoreMessage {
    return {
        role: 'user',
        content: [{
            type: 'text',
            text: chatMessage.message
        }]
    };
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
 * Convert tool type to assistant role with text content describing the tool call
 * Note: AI SDK handles tool calls internally, so we convert to descriptive text
 */
function convertToolMessage(chatMessage: ChatMessage): CoreMessage | null {
    const metadata = chatMessage.metadata;
    
    if (!metadata?.tool_name) {
        console.warn('Tool message missing tool_name:', metadata);
        return null;
    }
    
    // Convert tool call to descriptive text
    const toolDescription = `Called tool: ${metadata.tool_name}${
        metadata.tool_input ? ` with arguments: ${JSON.stringify(metadata.tool_input)}` : ''
    }`;
    
    return {
        role: 'assistant',
        content: toolDescription
    };
}

/**
 * Convert tool-result type to user role with text content containing the result
 * Note: AI SDK handles tool results internally, so we convert to descriptive text
 */
function convertToolResultMessage(chatMessage: ChatMessage): CoreMessage | null {
    const metadata = chatMessage.metadata;
    
    if (!metadata?.tool_name) {
        console.warn('Tool result message missing tool_name:', metadata);
        return null;
    }
    
    // Convert tool result to descriptive text
    const resultText = metadata.tool_result || chatMessage.message;
    const toolResultDescription = `Tool ${metadata.tool_name} result: ${resultText}`;
    
    return {
        role: 'user',
        content: toolResultDescription
    };
}

/**
 * Helper function to validate converted messages
 * Ensures alternating user/assistant pattern where possible
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
    
    // Check for tool-related content patterns
    for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        const content = typeof message.content === 'string' ? message.content : '';
        
        if (content.includes('Called tool:') && message.role !== 'assistant') {
            warnings.push(`Tool call content found in non-assistant message at index ${i}`);
        }
        
        if (content.includes('Tool ') && content.includes(' result:') && message.role !== 'user') {
            warnings.push(`Tool result content found in non-user message at index ${i}`);
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
    
    console.log('📋 Converted messages:', convertedMessages);
    console.groupEnd();
} 