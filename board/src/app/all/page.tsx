import { redirect } from 'next/navigation';

// /all is no longer a standalone URL — "all projects" is a client-side board state
export default function AllProjectsPage() {
  redirect('/');
}
