import { AM_BOARD_PROJECT_ID } from './constants';

type WebProjectCandidate = {
  id: string;
  templateType: string | null;
};

/**
 * Returns true iff the project is a real, user-owned web app whose dev server
 * we can launch from the project selector. The AM Board pseudo-project is
 * excluded — it is already serving on `localhost:4220`.
 */
export function isWebProject(project: WebProjectCandidate | null | undefined): boolean {
  if (!project) return false;
  if (project.id === AM_BOARD_PROJECT_ID) return false;
  return project.templateType === 'next-app';
}
