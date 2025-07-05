# Custom Agent Conversation History Implementation Plan

## 🎯 **Problem Statement**

Currently, `CustomAgentService` receives only the latest user message without conversation context, while `ClaudeCodeService` maintains session-based conversation history through Claude Code SDK's internal session management.

**Current Flow:**
```
Frontend chatHistory[] → Extension → ChatMessageService → CustomAgentService.query(latestMessage)
❌ No conversation context passed to AI SDK
```

**Desired Flow:**
```
Frontend chatHistory[] → Extension → ChatMessageService → Convert → CustomAgentService.query(messages[])
✅ Full conversation context passed to AI SDK
```

## 📊 **Message Type Reference**

### **Frontend Message Types (ChatMessage)**
```typescript
interface ChatMessage {
    type: 'user' | 'assistant' | 'result' | 'user-input' | 'tool' | 'tool-result' | 'tool-group';
    message: string;
    timestamp?: number;
    subtype?: string;
    metadata?: {
        duration_ms?: number;
        total_cost_usd?: number;
        is_error?: boolean;
        tool_name?: string;
        tool_id?: string;
        tool_input?: any;
        tool_result?: string;
        // ... other metadata
    };
}
```

**Frontend Message Types Mapping:**
- `'user-input'` → Actual user messages for conversation
- `'assistant'` → AI responses (text content)
- `'tool'` → Tool calls in progress
- `'tool-result'` → Tool execution results  
- `'result'` → Metadata messages (duration, cost, errors) - **SKIP**
- `'tool-group'` → UI grouping - **SKIP**

### **AI SDK Message Types (CoreMessage)**
```typescript
type CoreMessage = {
    role: 'user' | 'assistant' | 'system';
    content: string | Array<TextPart | ImagePart | ToolCallPart | ToolResultPart>;
};

type TextPart = { type: 'text'; text: string };
type ToolCallPart = { type: 'tool-call'; toolCallId: string; toolName: string; args: any };
type ToolResultPart = { type: 'tool-result'; toolCallId: string; result: any };
```

### **Conversion Rules**

| Frontend Type | AI SDK Role | AI SDK Content | Notes |
|---------------|-------------|----------------|-------|
| `'user-input'` | `'user'` | `{ type: 'text', text: message }` | Main user messages |
| `'assistant'` | `'assistant'` | `{ type: 'text', text: message }` | AI text responses |
| `'tool'` | `'assistant'` | `{ type: 'tool-call', ... }` | From tool metadata |
| `'tool-result'` | `'user'` | `{ type: 'tool-result', ... }` | From tool metadata |
| `'result'` | **SKIP** | - | Metadata only |
| `'tool-group'` | **SKIP** | - | UI grouping only |

## 🏗️ **Implementation Plan**

### **Option B: Pass Full History (Recommended)**

**Why Option B:**
- ✅ Simpler than session management
- ✅ Stateless service (easier to debug)  
- ✅ Frontend already maintains full history
- ✅ More explicit conversation handling

### **Phase 1: Message Conversion Utility**

**File:** `src/services/messageConverter.ts`
```typescript
export function convertChatHistoryToAISDK(chatHistory: ChatMessage[]): CoreMessage[] {
    // Filter and convert frontend messages to AI SDK format
    // Handle tool calls and results properly
    // Skip metadata-only messages
}
```

### **Phase 2: Update ChatMessageService**

**Changes needed:**
1. Receive full `chatHistory` from frontend (not just latest message)
2. Convert to AI SDK format using messageConverter
3. Pass full conversation context to CustomAgentService

### **Phase 3: Update CustomAgentService**

**Changes needed:**
1. Modify `query()` method signature:
   ```typescript
   // Before
   query(prompt: string, options?, abortController?, onMessage?)
   
   // After  
   query(messages: CoreMessage[], options?, abortController?, onMessage?)
   ```

2. Update `streamText()` call:
   ```typescript
   // Before
   streamText({ model, system, prompt, tools, ... })
   
   // After
   streamText({ model, system, messages, tools, ... })
   ```

### **Phase 4: Update Frontend Message Passing**

**Changes needed:**
1. Extension: Pass full `chatHistory` instead of just latest message
2. Frontend: Send complete conversation context in message

## ✅ **Minimal To-Do List**

### **🔧 Core Implementation**
- [x] **Create `messageConverter.ts`**
  - [x] `convertChatHistoryToAISDK()` function
  - [x] Handle tool calls/results conversion
  - [x] Filter non-conversation messages
  - [x] Add unit tests (skipped per user request)

- [x] **Update ChatMessageService**
  - [x] Modify `handleChatMessage()` to accept full history
  - [x] Import and use message converter
  - [x] Pass converted messages to agent service
  - [x] Update `AgentService` interface to support both prompt and messages

- [x] **Update CustomAgentService**
  - [x] Change `query()` signature: `conversationHistory?: CoreMessage[]`
  - [x] Support both `prompt` and `conversationHistory` parameters 
  - [x] Update `streamText()` configuration to use appropriate input format
  - [x] Maintain backward compatibility with single prompt mode

- [x] **Update Frontend→Extension Communication**
  - [x] Extension: Modify message handler to expect full history *(Already implemented)*
  - [x] Frontend: Send `chatHistory` array in message
  - [x] Update message command structure *(Maintains backward compatibility)*

### **🧪 Testing & Validation**
- [ ] **Test Conversation Context**
  - [ ] Verify AI remembers previous messages
  - [ ] Test multi-turn conversations
  - [ ] Verify tool usage with context

- [ ] **Test Clear History**
  - [ ] Ensure frontend clear works
  - [ ] Verify backend gets fresh context
  - [ ] Test new conversation starts clean

### **🐛 Edge Cases**
- [ ] **Handle Empty History**
  - [ ] First message (no history)
  - [ ] After clear history
  
- [ ] **Tool Call Continuity**
  - [ ] Tool calls span multiple turns
  - [ ] Tool results maintain context

## 🔍 **Key Files to Modify**

| File | Changes |
|------|---------|
| `messageConverter.ts` | **NEW** - Convert ChatMessage[] → CoreMessage[] |
| `chatMessageService.ts` | Accept full history, use converter |
| `customAgentService.ts` | Change query signature, use messages array |
| `extension.ts` | Pass full chatHistory in message |
| `useChat.ts` | Send full chatHistory to extension |

## 📝 **Message Flow After Implementation**

```
1. Frontend: User types message
2. Frontend: Add to chatHistory[], send full chatHistory[] to extension  
3. Extension: Receive full chatHistory[], pass to ChatMessageService
4. ChatMessageService: Convert chatHistory[] → CoreMessage[]
5. CustomAgentService: Receive CoreMessage[], pass to AI SDK
6. AI SDK: Process with full conversation context
7. Response: Stream back with context awareness
```

## 🚧 **Implementation Notes**

- **Start Small:** Implement with text messages first, add tool support after
- **Preserve Tool Context:** Ensure tool calls/results maintain conversation flow
- **Error Handling:** Graceful fallback if conversion fails
- **Performance:** Consider conversation length limits (AI SDK token limits)
- **Compatibility:** Ensure ClaudeCodeService continues working unchanged

---

**Status:** 📋 Ready for implementation
**Estimated Effort:** 2-3 hours
**Priority:** High (core functionality) 