# Superdesign

[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code-Marketplace-blue)](https://marketplace.visualstudio.com/items?itemName=superdesign.superdesign)
[![Version](https://img.shields.io/badge/version-0.0.1-green)]()

**Superdesign** is an AI-powered design assistant extension for VS Code that brings intelligent design iteration capabilities directly to your development workflow. Think "Cursor for Figma" - but integrated into your code editor.

## ✨ Key Features

### 🤖 AI-Powered Design Chat
- **Claude AI Integration**: Chat with Claude to get design suggestions, code improvements, and creative guidance
- **Context-Aware Assistance**: The AI understands your project structure and provides relevant design advice
- **Real-time Collaboration**: Get instant feedback on your design decisions

### 🎨 Visual Design Canvas
- **Interactive Canvas View**: Visualize your HTML design iterations in a dynamic canvas
- **Tree/Hierarchy View**: Default tree layout shows design relationships and evolution paths
- **Multiple Layout Modes**: Switch between grid and hierarchical views of your designs
- **Responsive Preview**: View designs in desktop, tablet, and mobile viewports

### 🔄 Design Iteration Management
- **Automatic File Detection**: Scans `.superdesign/ui_iterations/` for HTML design files
- **Version Tracking**: Track design evolution and relationships between iterations
- **Live File Watching**: Auto-updates canvas when design files change
- **Connection Visualization**: See how your designs relate to each other with connection lines

### 🖼️ Moodboard Integration
- **Image Upload**: Save design inspirations to `.superdesign/moodboard/`
- **Visual Reference**: Keep design references organized within your project

## 🚀 Getting Started

### Installation

1. **From VS Code Marketplace**:
   - Open VS Code
   - Go to Extensions (Ctrl+Shift+X)
   - Search for "Superdesign"
   - Click Install

2. **From VSIX** (for development):
   ```bash
   code --install-extension superdesign-0.0.1.vsix
   ```

### Setup

1. **Configure API Key**:
   - Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
   - Run `Superdesign: Configure Anthropic API Key`
   - Enter your Claude API key

2. **Create Project Structure**:
   ```
   your-project/
   ├── .superdesign/
   │   ├── ui_iterations/     # Your HTML design files go here
   │   └── moodboard/         # Design inspiration images
   └── ... your other files
   ```

## 💡 Usage

### Opening Superdesign

- **Sidebar**: Click the Superdesign icon in the Activity Bar
- **Command Palette**: Run `Superdesign: Show Chat Sidebar`
- **Canvas View**: Run `Superdesign: Open Canvas View` or click the window icon in the sidebar

### Creating Design Iterations

1. Create HTML files in `.superdesign/ui_iterations/`
2. Use naming conventions like `design_v1.html`, `design_v2.html` to show evolution
3. The canvas will automatically detect and display your designs

### Using the AI Chat

1. Open the Superdesign sidebar
2. Start chatting with Claude about your design needs
3. The AI can help with:
   - Design suggestions and improvements
   - Code optimization
   - Creative problem-solving
   - Best practices guidance

### Canvas Features

- **Tree View** (Default): Shows design hierarchy and relationships
- **Grid View**: Traditional grid layout of your designs
- **Responsive Testing**: Switch between device viewports
- **Zoom & Pan**: Navigate large design collections easily
- **Frame Selection**: Click designs to get context in chat

## 🎯 Available Commands

| Command | Description |
|---------|-------------|
| `Superdesign: Show Chat Sidebar` | Open the AI chat interface |
| `Superdesign: Open Canvas View` | Open the visual design canvas |
| `Superdesign: Configure Anthropic API Key` | Set up your Claude API key |
| `Superdesign: Clear Chat` | Clear the chat history |
| `Superdesign: Reset Welcome Screen` | Reset the welcome flow |

## ⚙️ Configuration

### Settings

- **`superdesign.anthropicApiKey`**: Your Anthropic API key for Claude integration

### File Structure

Superdesign works best with this project structure:

```
.superdesign/
├── ui_iterations/
│   ├── landing_v1.html
│   ├── landing_v2.html
│   ├── dashboard_v1.html
│   └── ...
└── moodboard/
    ├── inspiration1.jpg
    ├── wireframe.png
    └── ...
```

## 🔧 Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/superdesigndev/superdesign.git
cd superdesign

# Install dependencies
npm install

# Build the extension
npm run compile

# Package for distribution
npm run package
```

### Testing

```bash
# Run tests
npm test

# Run with watch mode
npm run watch
```

## 📸 Screenshots

*Screenshots will be added to show the extension in action*

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📋 Requirements

- **VS Code**: Version 1.95.0 or higher
- **Anthropic API Key**: Required for AI chat functionality
- **Node.js**: For development (16.x or higher)

## 🔗 Links

- [GitHub Repository](https://github.com/superdesigndev/superdesign)
- [Issues](https://github.com/superdesigndev/superdesign/issues)
- [Discussions](https://github.com/superdesigndev/superdesign/discussions)

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

Having issues? Here's how to get help:

1. Check the [FAQ](https://github.com/superdesigndev/superdesign/wiki/FAQ)
2. Search [existing issues](https://github.com/superdesigndev/superdesign/issues)
3. Create a [new issue](https://github.com/superdesigndev/superdesign/issues/new)

---

**Happy Designing! 🎨✨**
