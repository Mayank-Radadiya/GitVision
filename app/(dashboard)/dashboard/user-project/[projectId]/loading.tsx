import { Loader } from "@/components/custom/Loader";

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader message="Loading project details..." />
    </div>
  );
}
