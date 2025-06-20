# SuperDesign VS Code Extension - Product Requirements Document (PRD)

## 1. Product Overview

### 1.1 Product Vision
SuperDesign is an open source VS Code/Cursor/Windsurf extension that empowers developers to rapidly prototype and iterate on UI designs using AI. It provides an infinite canvas interface where users can generate, preview, and refine multiple UI variations through natural language prompts.

RAW REQUIREMENTS
Key features:
1. It has an infinite canva where users can prompt AI, and AI can generate multiple versions of UI and allow users to preview it
2. User can select a specific versions of UI AI generated, and ask it to iterate a few more versions too
3. Its gonna be an extension that they can open directly

MVP requirements:
1. An extension user can install in VS code or Cursor, Windsurf
2. This extension should initialise a project in the current root with .superdesign which contains all the files
3. The extension should have a side bar, where initially will: ask for user email, and ask users to setup claude API key
4. Then it will be a chat UI, with a button to open the main UI
5. When clicking on main UI, it will open a page in the file UI in the middle, with an infinite canva style
6. Users can prompt in the chat about UI they want to build, then AI will generate 3 variations, and display on the right side
7. AI part we gonna use Claude code sdk (https://docs.anthropic.com/en/docs/claude-code/sdk), with custom prompt & commands
8. Custom prompt around that it is aiming at building UI, and the ui generation rules, e.g. you have to create the whole UI under .superdev folder, and name it ui_1.html, ui_2.html, etc.
9. command will be things like 'Generate more iterations', 'Give feedback'... (BTW command is a special claude code feature in case you don't know, it bascially allow us to create some commands file, with predefined prompts)
10. On the main UI on the right side, we will display & render each html in .superdev folder
11. Users can select any specific HTML, that will have a few buttons 'Create more iterations', 'Give feedback', 'Delete'
12. When user select a specific 'frame' inside canva, the chat on the left should know and be able to bring that context into the next message user sent
13. Users can even select multiple frames and both will be sent to the chat
14. In the chat UI - users should also be able to drop images as mock up refernece too, which should be stored in '.superdev/moodboard', so we can reuse later
15. There should also be an option 'Copy prompt for Cursor' on the frame, and this will basically copy a prompt user can use to cursor to actually implement this UI as reference


BELOW ARE AI GENERATED:

### 1.2 Target Users
- Frontend developers and designers
- Product managers creating mockups
- Full-stack developers needing quick UI prototypes
- Design-conscious developers working in modern code editors

### 1.3 Core Value Proposition
- **Rapid Prototyping**: Generate multiple UI variations instantly
- **Contextual Iteration**: Refine designs based on selected variations
- **Seamless Integration**: Works directly within familiar development environments
- **AI-Powered**: Leverages Claude's capabilities for intelligent UI generation

## 2. MVP Feature Requirements

### 2.1 Extension Installation & Setup

#### 2.1.1 Multi-Editor Support
- **Primary Target**: Cursor, Windsurf
- **Installation Method**: Via respective extension marketplaces

#### 2.1.2 Project Initialization
- **Trigger**: Extension activation in any workspace
- **Action**: Create `.superdesign/` directory structure in workspace root
- **Directory Structure**:
  ```
  .superdesign/
  ├── ui/           # Generated HTML files
  ├── moodboard/    # User-uploaded reference images
  ├── config.json   # Project configuration
  └── metadata.json # UI generation metadata
  ```

### 2.2 User Onboarding

#### 2.2.1 Initial Setup Flow
1. **Email Collection**
   - Purpose: Asking for user email (dont have user auth yet)
   - Validation: Basic email format validation
   - Storage: Local extension storage

2. **Claude API Key Setup**
   - Input field with secure masking
   - Error handling for invalid keys

#### 2.2.2 Setup Completion
- Success confirmation message
- Automatic transition to main interface
- Option to modify settings later

### 2.3 Chat Interface (Sidebar)

#### 2.3.1 Chat UI Components
- **Input Field**: Multi-line text input with send button
- **Message History**: Scrollable conversation log
- **Context Indicators**: Visual indicators when frames are selected
- **Image Upload**: Drag-and-drop area for reference images

#### 2.3.2 Chat Functionality
- **Message Types**:
  - User text prompts
  - User image uploads
  - AI responses with generated UI references
  - System notifications
- **Context Awareness**: Display selected frame information
- **Image Handling**: Automatic upload to `.superdesign/moodboard/`

### 2.4 Main Canvas Interface

#### 2.4.1 Canvas Features
- **Infinite Canvas**: Pan and zoom functionality
- **Frame Display**: Generated UIs displayed as preview cards
- **Selection System**: Single and multi-select capability
- **Grid Layout**: Automatic arrangement of generated UIs

#### 2.4.2 Frame Components
Each UI frame includes:
- **Preview Window**: Rendered HTML content
- **Title Bar**: File name and generation timestamp
- **Action Buttons**:
  - "Create More Iterations"
  - "Give Feedback"
  - "Delete"
- **Selection Indicator**: Visual feedback for selected frames

### 2.5 AI Integration (Claude Code SDK)

#### 2.5.1 Core AI Configuration
- **SDK**: Claude Code SDK integration
- **Model**: Claude Sonnet 4 (claude-sonnet-4-20250514)
- **Custom System Prompt**: UI generation specialist persona

#### 2.5.2 System Prompt Template
```
TBD
```

#### 2.5.3 Custom Commands
- **"Generate More Iterations"**: Create additional variations of selected UI
- **"Give Feedback"**: Provide constructive criticism and improvement suggestions
- **"Refine Design"**: Iterate on specific aspects of selected UI
- **"Create Variant"**: Generate variations based on specific modifications

### 2.6 File Management System

#### 2.6.1 HTML Generation
- **Naming Convention**: `ui_[timestamp]_v[version].html`
- **File Structure**: Self-contained HTML with embedded CSS/JS
- **Metadata Tracking**: JSON metadata for each generated file

#### 2.6.2 Asset Management
- **Image Storage**: `.superdesign/moodboard/` for reference images
- **Supported Formats**: PNG, JPG, JPEG, GIF, SVG
- **File Size Limits**: 10MB per image

## 3. Technical Architecture

### 3.1 Extension Structure
```
src/
├── extension.ts          # Main extension entry point
├── sidebar/             # Chat interface components
├── canvas/              # Main canvas webview
├── ai/                  # Claude SDK integration
├── fileManager/         # File operations
└── utils/               # Helper functions
```

### 3.2 Communication Flow
1. **User Input** → Chat Interface
2. **Chat Interface** → AI Service (Claude SDK)
3. **AI Service** → File Generation
4. **File Watcher** → Canvas Update
5. **Canvas Selection** → Context Update

### 3.3 Data Storage
- **User Settings**: VS Code settings.json
- **API Keys**: VS Code SecretStorage API
- **Project Data**: Local `.superdesign/` directory
- **Chat History**: Local JSON files

## 4. User Experience Flow

### 4.1 First-Time User Journey
1. Install extension from marketplace
2. Open workspace/folder in VS Code
3. Extension auto-activates, creates `.superdesign/` directory
4. Sidebar prompts for email and API key setup
5. Complete setup, access main interface
6. Tutorial overlay explains key features

### 4.2 Core Workflow
1. **Prompt Entry**: User describes desired UI in chat
2. **AI Generation**: Claude generates 3 HTML variations
3. **Canvas Display**: UIs appear as frames on canvas
4. **Selection & Iteration**: User selects frames, requests iterations
5. **Refinement**: Continuous improvement through chat interaction

### 4.3 Advanced Workflows
- **Multi-Frame Selection**: Compare and merge concepts
- **Image Reference**: Upload mockups for AI reference
- **Feedback Loop**: Iterative refinement based on AI suggestions

## 6. 2-Day Sprint Implementation Plan

### Day 1: Core Foundation & Setup (10-12 hours)
**Morning (4 hours)**
- Extension scaffolding with VS Code API
- Basic sidebar panel setup with polished UI
- Email/API key input forms with validation
- `.superdesign/` directory creation (ui/ and moodboard/ folders)

**Afternoon (4 hours)**
- Claude SDK integration with custom system prompt
- Chat interface with image drag-and-drop
- AI prompt handling with context awareness
- HTML file generation to `.superdesign/ui/`

**Evening (2-4 hours)**
- Image upload to moodboard functionality
- File watcher system for auto-updates
- Basic error handling and validation

### Day 2: Canvas & Advanced Interactions (10-12 hours)
**Morning (4 hours)**
- Webview canvas setup with pan/zoom controls
- HTML preview rendering system
- Frame display with professional styling
- Multi-frame selection mechanism

**Afternoon (4 hours)**
- Frame action buttons (Delete, Feedback, Iterate, Copy prompt)
- Context passing between canvas and chat
- Multi-frame context for AI prompts
- Canvas state management

**Evening (2-4 hours)**
- UI polish and responsive design
- Final testing and edge case handling
- Extension packaging and documentation

## 10. Critical Success Criteria (2-Day MVP)
1. **Extension installs and activates** in VS Code
2. **User can set up** email and Claude API key with validation
3. **AI generates 3 HTML files** from text prompt
4. **Canvas displays** generated HTML previews with pan/zoom
5. **User can select single or multiple frames** 
6. **Selected frames provide context** to AI for iterations
7. **Image upload works** and stores in moodboard
8. **Delete and feedback buttons** function on frames
9. **Professional UI** that feels production-ready
10. **Files are properly saved** in `.superdesign/ui/`

### Included (Must-Have)
- ✅ Basic extension setup
- ✅ Email/API key collection
- ✅ Simple chat interface
- ✅ AI HTML generation (3 variations)
- ✅ Canvas with HTML previews
- ✅ Frame selection
- ✅ "Generate more iterations" command

### Included (Must-Have)
- ✅ Basic extension setup
- ✅ Email/API key collection
- ✅ Simple chat interface
- ✅ AI HTML generation (3 variations)
- ✅ Canvas with HTML previews
- ✅ Frame selection & multi-frame selection
- ✅ "Generate more iterations" command
- ✅ Image upload/moodboard functionality
- ✅ Advanced canvas controls (pan/zoom)
- ✅ Delete/feedback buttons on frames
- ✅ UI polish for professional look


## 10. Critical Success Criteria (2-Day MVP)
1. **Extension installs and activates** in VS Code
2. **User can set up** email and Claude API key
3. **AI generates 3 HTML files** from text prompt
4. **Canvas displays** generated HTML previews
5. **User can select a frame** and generate iterations
6. **Files are properly saved** in `.superdesign/ui/`

---

*This is a focused 2-day sprint PRD. Feature scope has been intentionally reduced to ensure a working MVP within the aggressive timeline.*