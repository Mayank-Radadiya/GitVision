import { Loader } from "@/components/custom/Loader";
import dynamic from "next/dynamic";

const CreateNewProjectForm = dynamic(
  () => import("@/components/dashboard/create-new-project/add-repo"),
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
