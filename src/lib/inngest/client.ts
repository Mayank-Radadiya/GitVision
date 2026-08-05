import { Inngest } from "inngest";

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
  "embeddings/generate": {
    data: {
      projectId: string;
    };
  };
  "embeddings/cancel": {
    data: {
      projectId: string;
    };
  };
};

// Create a client to send and receive events
export const inngest = new Inngest({
  id: "git-vision",
  schemas: {
    events: {} as Events,
  },
});
