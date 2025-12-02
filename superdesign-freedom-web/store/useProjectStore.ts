import { create } from 'zustand';
import { db, type Project } from '@/lib/db';

interface ProjectState {
    projects: Project[];
    isLoading: boolean;
    loadProjects: () => Promise<void>;
    createProject: (name: string) => Promise<string>;
    deleteProject: (id: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set) => ({
    projects: [],
    isLoading: true,
    loadProjects: async () => {
        set({ isLoading: true });
        try {
            const projects = await db.projects.orderBy('updatedAt').reverse().toArray();
            set({ projects });
        } catch (error) {
            console.error('Failed to load projects:', error);
        } finally {
            set({ isLoading: false });
        }
    },
    createProject: async (name: string) => {
        const newProject: Project = {
            id: crypto.randomUUID(),
            name,
            createdAt: new Date(),
            updatedAt: new Date(),
            nodes: [],
            edges: []
        };
        await db.projects.add(newProject);
        set((state) => ({ projects: [newProject, ...state.projects] }));
        return newProject.id;
    },
    deleteProject: async (id: string) => {
        await db.projects.delete(id);
        set((state) => ({ projects: state.projects.filter((p) => p.id !== id) }));
    }
}));
