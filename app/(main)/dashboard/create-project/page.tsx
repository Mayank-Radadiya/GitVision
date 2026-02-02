import { Loader } from "@/shared/components/feedback/loader";
import dynamic from "next/dynamic";

const CreateNewProjectForm = dynamic(
  () => import("@/features/projects/components/create-project/add-repo"),
  {
    loading: () => <Loader />,
  }
);

export default function AddRepositoryPage() {
  return (
    <main>
      <CreateNewProjectForm />
    </main>
  );
}
