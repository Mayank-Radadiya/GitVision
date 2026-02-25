import { Inngest, EventSchemas } from "inngest";

type Events = {
  "project/created": {
    data: {
      projectId: string;
      repoUrl: string;
      projectName: string;
      owner: string;
      repo: string;
    };
  };
};

// Create a client to send and receive events
export const inngest = new Inngest({
  id: "git-vision",
  schemas: new EventSchemas().fromRecord<Events>(),
});
