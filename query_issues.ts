import { db } from "./db/index";
import { issuesTable, projectTables } from "./db/schema";
import { eq } from "drizzle-orm";

async function run() {
  const projects = await db.select().from(projectTables);
  console.log("Projects:", projects.map(p => ({id: p.id, name: p.projectName, url: p.githubUrl})));
  
  const issues = await db.select().from(issuesTable).limit(20);
  console.log("Issues:", issues.map(i => ({ project: i.projectId, title: i.title, pr: i.isPullRequest, state: i.state, num: i.issueNumber })));
}
run().catch(console.error).then(() => process.exit(0));
