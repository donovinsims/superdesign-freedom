"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, Loader2, Trash2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useProjectStore } from "@/store/useProjectStore"

export default function Dashboard() {
  const router = useRouter()
  const { projects, isLoading, loadProjects, createProject, deleteProject } = useProjectStore()
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProjectName.trim()) return

    setIsCreating(true)
    try {
      const id = await createProject(newProjectName)
      setIsNewProjectOpen(false)
      setNewProjectName("")
      router.push(`/project/${id}`)
    } catch (error) {
      console.error("Failed to create project:", error)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">SuperDesign Freedom</h1>
          <p className="text-muted-foreground mt-2">
            Unlimited, free, open-source design & code generator.
          </p>
        </div>
        <Dialog open={isNewProjectOpen} onOpenChange={setIsNewProjectOpen}>
          <DialogTrigger asChild>
            <Button size="lg">
              <Plus className="mr-2 h-4 w-4" /> New Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>
                Give your project a name to get started.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateProject}>
              <div className="grid gap-4 py-4">
                <Input
                  placeholder="Project Name"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isCreating || !newProjectName.trim()}>
                  {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Project
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20 border rounded-lg bg-muted/10">
          <h2 className="text-2xl font-semibold mb-2">No projects yet</h2>
          <p className="text-muted-foreground mb-6">Create your first project to start designing.</p>
          <Button onClick={() => setIsNewProjectOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Create Project
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Card key={project.id} className="group relative hover:shadow-md transition-shadow">
              <Link href={`/project/${project.id}`} className="absolute inset-0 z-10">
                <span className="sr-only">Open project</span>
              </Link>
              <CardHeader>
                <CardTitle className="truncate">{project.name}</CardTitle>
                <CardDescription>
                  Edited {formatDistanceToNow(project.updatedAt, { addSuffix: true })}
                </CardDescription>
              </CardHeader>
              <CardContent className="h-32 bg-muted/20 flex items-center justify-center text-muted-foreground text-sm">
                {project.thumbnail ? (
                  <img src={project.thumbnail} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  "No preview"
                )}
              </CardContent>
              <CardFooter className="flex justify-between z-20 relative">
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  Open
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (confirm("Are you sure you want to delete this project?")) {
                      deleteProject(project.id)
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
