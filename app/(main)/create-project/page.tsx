/**
 * Create Project Page — Server Component
 *
 * Renders the create project form directly (no dynamic import needed).
 */

import CreateNewProjectForm from "@/features/projects/components/create-project/add-repo";

export default function CreateProjectPage() {
  return (
    <main>
      <CreateNewProjectForm />
    </main>
  );
}
