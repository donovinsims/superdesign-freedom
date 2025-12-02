"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { ReactFlowProvider, Node, Edge } from "reactflow"

import { Canvas } from "@/components/canvas/Canvas"
import { ChatInterface } from "@/components/chat/ChatInterface"
import { CodeViewer } from "@/components/editor/CodeViewer"
import { useProjectStore } from "@/store/useProjectStore"
import { Project } from "@/lib/db"
import { Loader2 } from "lucide-react"

export default function ProjectPage() {
    const params = useParams()
    const id = params.id as string
    const { projects, loadProjects, isLoading } = useProjectStore()
    const [project, setProject] = useState<Project | null>(null)

    useEffect(() => {
        if (projects.length === 0) {
            loadProjects()
        }
    }, [loadProjects, projects.length])

    useEffect(() => {
        const found = projects.find((p) => p.id === id)
        if (found) {
            setProject(found)
        }
    }, [projects, id])

    if (isLoading || !project) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="flex h-screen w-full overflow-hidden bg-background">
            {/* Left Sidebar: Chat */}
            <div className="w-[400px] border-r bg-muted/10 flex flex-col">
                <ChatInterface projectId={id} />
            </div>

            {/* Center: Canvas */}
            <div className="flex-1 relative">
                <ReactFlowProvider>
                    <Canvas projectId={id} initialNodes={project.nodes as Node[]} initialEdges={project.edges as Edge[]} />
                </ReactFlowProvider>
            </div>

            {/* Right Sidebar: Code Viewer */}
            <div className="w-[400px] border-l bg-muted/10 flex flex-col">
                <CodeViewer />
            </div>
        </div>
    )
}
