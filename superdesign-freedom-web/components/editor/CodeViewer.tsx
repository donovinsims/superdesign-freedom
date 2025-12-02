"use client"

import Editor from "@monaco-editor/react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Download, Code as CodeIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { exportToZip } from "@/lib/export/zip"
import { openInVSCode, openInCursor } from "@/lib/export/ide"
import { useProjectStore } from "@/store/useProjectStore"
import { useParams } from "next/navigation"

export function CodeViewer() {
    const params = useParams()
    const id = params.id as string
    const { projects } = useProjectStore()
    const project = projects.find(p => p.id === id)

    const handleExportZip = async () => {
        if (project) await exportToZip(project)
    }

    const code = `// Generated code will appear here
export default function Component() {
  return (
    <div className="p-4">
      <h1>Hello World</h1>
    </div>
  )
}
`

    return (
        <div className="flex flex-col h-full">
            <div className="p-2 border-b bg-muted/50 flex justify-between items-center">
                <Tabs defaultValue="react" className="w-full">
                    <TabsList className="w-full justify-start">
                        <TabsTrigger value="react">React</TabsTrigger>
                        <TabsTrigger value="html">HTML</TabsTrigger>
                        <TabsTrigger value="css">CSS</TabsTrigger>
                    </TabsList>
                    <TabsContent value="react" className="hidden" />
                    <TabsContent value="html" className="hidden" />
                    <TabsContent value="css" className="hidden" />
                </Tabs>
                <div className="flex gap-1 ml-2">
                    <Button variant="ghost" size="icon" onClick={() => project && openInVSCode(project)} title="Open in VS Code">
                        <CodeIcon className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => project && openInCursor(project)} title="Open in Cursor">
                        <CodeIcon className="h-4 w-4 text-blue-500" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleExportZip} title="Download ZIP">
                        <Download className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            <div className="flex-1">
                <Editor
                    height="100%"
                    defaultLanguage="typescript"
                    defaultValue={code}
                    theme="vs-dark"
                    options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        readOnly: true,
                    }}
                />
            </div>
        </div>
    )
}
