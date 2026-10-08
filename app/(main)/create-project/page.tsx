/**
 * Create Project Page — Server Component
 *
 * Renders the create project form inside a Suspense boundary because
 * `AddRepoForm` reads `useSearchParams()` to honour the landing page's
 * `?url=` deep link (F-01). Without the boundary `useSearchParams` forces the
 * whole route to client-side rendering at build time.
 */

import { Suspense } from "react";
import CreateNewProjectForm from "@/features/projects/components/create-project/add-repo";
import Loading from "./loading";

export default function CreateProjectPage() {
  return (
    <Suspense fallback={<Loading />}>
      <CreateNewProjectForm />
    </Suspense>
  );
}
