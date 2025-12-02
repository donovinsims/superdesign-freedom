import { Project } from "@/lib/db"

export function openInVSCode(project: Project) {
    // In a real app, this would use the File System Access API to write to disk first,
    // or just open the current folder if running locally.
    // For a web app, we can't easily "open in VS Code" with content without a local server bridge.
    // But we can generate a URI scheme if the user has the extension.

    // For now, we'll just log or show a message that this requires the extension bridge.
    console.log("Opening in VS Code:", project.name)
    window.open(`vscode://file/${project.name}`)
}

export function openInCursor(project: Project) {
    console.log("Opening in Cursor:", project.name)
    window.open(`cursor://file/${project.name}`)
}
