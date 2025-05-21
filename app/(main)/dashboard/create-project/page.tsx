import { Skeleton } from "@/components/ui/skeleton";
import dynamic from "next/dynamic";

const CreateNewProjectForm = dynamic(
  () => import("@/components/dashboard/create-new-project/add-repo"),
  {
    loading: () => (
      <div className="flex h-screen flex-col justify-center items-center">
        <Skeleton className="h-[475px]  border border-white/30 w-full max-w-md relative z-10" />
      </div>
    ),
  }
);

export default function AddRepositoryPage() {
  return (
    <main>
      <CreateNewProjectForm />
    </main>
  );
}
