'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export type Project = {
  id: string;
  name: string;
  repoDir: string;
  versioned: boolean;
  isTest: boolean;
  prodPort: number | null;
  devPort: number | null;
  demoUrl: string | null;
  githubRepo: string | null;
  vercelUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

type ProjectsContextValue = {
  projects: Project[];
  selectedProjectId: string | null;
  switchProject: (id: string | null) => void;
};

const ProjectsContext = createContext<ProjectsContextValue>({
  projects: [],
  selectedProjectId: null,
  switchProject: () => {},
});

export function useProjects() {
  return useContext(ProjectsContext);
}

/** Derive project ID from the URL: /p/<id> → id, / → null */
function projectIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/p\/([^/]+)/);
  return m ? m[1] : null;
}

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [projects, setProjects] = useState<Project[]>([]);

  const selectedProjectId = projectIdFromPath(pathname);

  // Fetch projects on mount
  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(setProjects).catch(() => {});
  }, []);

  // Listen for project events via WebSocket
  useEffect(() => {
    const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4201';
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      ws = new WebSocket(WS_URL);
      ws.onmessage = (event: MessageEvent) => {
        try {
          const ev = JSON.parse(event.data);
          if (ev.type === 'project_created' && ev.project) {
            setProjects(prev => {
              if (prev.some((p: Project) => p.id === ev.project.id)) return prev;
              return [...prev, ev.project];
            });
          } else if (ev.type === 'project_updated' && ev.project) {
            setProjects(prev => prev.map((p: Project) => p.id === ev.project.id ? ev.project : p));
          } else if (ev.type === 'project_deleted' && ev.id) {
            setProjects(prev => prev.filter((p: Project) => p.id !== ev.id));
            if (projectIdFromPath(window.location.pathname) === ev.id) {
              router.push('/');
            }
          }
        } catch {}
      };
      ws.onclose = () => { reconnectTimer = setTimeout(connect, 3000); };
      ws.onerror = () => { ws.close(); };
    }

    connect();
    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);

  const switchProject = useCallback((id: string | null) => {
    if (id === selectedProjectId) return;
    router.push(id ? `/p/${id}` : '/');
  }, [selectedProjectId, router]);

  return (
    <ProjectsContext.Provider value={{ projects, selectedProjectId, switchProject }}>
      {children}
    </ProjectsContext.Provider>
  );
}
