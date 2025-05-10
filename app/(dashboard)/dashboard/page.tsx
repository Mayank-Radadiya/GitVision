import { SignOutButton } from "@clerk/nextjs";
import { NextPage } from "next";

const Page: NextPage = ({}) => {
  return (
    <div>
      <p>welcome to GitVision</p>

      <SignOutButton />
    </div>
  );
};

export default Page;
