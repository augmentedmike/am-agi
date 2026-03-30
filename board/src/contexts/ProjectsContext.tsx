'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AM_BOARD_PROJECT_ID } from '@/lib/constants';

export type Project = {
  id: string;
  name: string;
  repoDir: string;
  versioned: boolean;
  isTest: boolean;
  prodPort: number | null;
  devPort: number | null;
  demoUrl: string | null;
  templateType: string | null;
  githubRepo: string | null;
  vercelUrl: string | null;
  currentVersion: string | null;
  defaultBranch: string | null;
  createdAt: string;
  updatedAt: string;
};

type ProjectsContextValue = {
  projects: Project[];
  selectedProjectId: string;
  switchProject: (id: string) => void;
  addProject: (p: Project) => void;
};

const ProjectsContext = createContext<ProjectsContextValue>({
  projects: [],
  selectedProjectId: AM_BOARD_PROJECT_ID,
  switchProject: () => {},
  addProject: () => {},
});

export function useProjects() {
  return useContext(ProjectsContext);
}

/** Derive project ID from the URL: /p/<id> → id, / → AM_BOARD_PROJECT_ID */
function projectIdFromPath(pathname: string): string {
  const m = pathname.match(/^\/p\/([^/]+)/);
  return m ? m[1] : AM_BOARD_PROJECT_ID;
}

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [projects, setProjects] = useState<Project[]>([]);
  // "All projects" mode is purely client-side — no URL change
  const [allMode, setAllMode] = useState(false);

  // Clear all-mode whenever the URL changes (user navigated to a real project)
  useEffect(() => { setAllMode(false); }, [pathname]);

  const selectedProjectId = allMode ? '__all__' : projectIdFromPath(pathname);

  // Fetch projects on mount
  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(setProjects).catch(() => {});
  }, []);

  // Listen for project events via WebSocket
  useEffect(() => {
    const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4221';
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

  const addProject = useCallback((p: Project) => {
    setProjects(prev => prev.some(x => x.id === p.id) ? prev : [...prev, p]);
  }, []);

  const switchProject = useCallback((id: string) => {
    if (id === selectedProjectId) return;
    if (id === '__all__') {
      // All-projects is client-side only — no URL push
      setAllMode(true);
    } else {
      setAllMode(false);
      if (id === AM_BOARD_PROJECT_ID) {
        router.push('/');
      } else {
        router.push(`/p/${id}`);
      }
    }
  }, [selectedProjectId, router]);

  return (
    <ProjectsContext.Provider value={{ projects, selectedProjectId, switchProject, addProject }}>
      {children}
    </ProjectsContext.Provider>
  );
}
