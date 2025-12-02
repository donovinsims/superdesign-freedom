import Dexie, { type Table } from 'dexie';

export interface Project {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    thumbnail?: string; // Data URL
    nodes: unknown[]; // React Flow nodes
    edges: unknown[]; // React Flow edges
}

export class SuperDesignDB extends Dexie {
    projects!: Table<Project>;

    constructor() {
        super('SuperDesignDB');
        this.version(1).stores({
            projects: 'id, name, createdAt, updatedAt'
        });
    }
}

export const db = new SuperDesignDB();
