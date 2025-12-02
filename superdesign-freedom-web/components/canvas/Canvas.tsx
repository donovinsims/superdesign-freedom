"use client"

import { useCallback } from "react"
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    Edge,
    Node,
} from "reactflow"
import "reactflow/dist/style.css"

interface CanvasProps {
    projectId: string
    initialNodes?: Node[]
    initialEdges?: Edge[]
}

export function Canvas({ projectId, initialNodes = [], initialEdges = [] }: CanvasProps) {
    // Use projectId for saving later
    console.log("Canvas for project:", projectId)
    const [nodes, , onNodesChange] = useNodesState(initialNodes)
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    )

    return (
        <div className="h-full w-full">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                fitView
                className="bg-background"
            >
                <Background />
                <Controls />
                <MiniMap />
            </ReactFlow>
        </div>
    )
}
