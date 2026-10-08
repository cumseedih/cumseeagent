"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "../lib/api";
import { Button, cx } from "./ui";
import { IconCheck, IconFile, IconFolder, IconGithub, IconPlus, IconSettings, IconShield, IconSparkle, IconTrash, IconX } from "./icons";

export type WorkspaceSection = "chat" | "agents" | "groups" | "projects" | "artifacts" | "skills" | "workflows" | "connections" | "settings";
type Project = { id: string; name: string; defaultBranch?: string; repositoryUrl?: string | null };
type Skill = { id: string; name: string; description?: string | null; instructions: string; enabled: boolean; updatedAt: string };
type Workflow = { id: string; name: string; description?: string | null; prompt: string; projectId?: string | null; enabled: boolean; runs?: Array<{ id: string; status: string; createdAt: string; errorMessage?: string | null }> };
type Artifact = { id: string; name: string; kind: string; mimeType?: string | null; sizeBytes?: number | null; projectId?: string | null; createdAt: string };
type HubUser = { id: string; email: string; username?: string | null; displayName?: string | null; avatarUrl?: string | null };
type AgentProfile = { id: string; name: string; instructions: string; memory: string; avatarUrl?: string | null; isDefault: boolean; isPinned: boolean; _count?: { sessions: number; memberships: number } };
type GroupChat = { id: string; name: string; isPinned: boolean; agents: Array<Pick<AgentProfile, "id" | "name" | "avatarUrl">>; sessionCount?: number };

const HEADINGS: Record<Exclude<WorkspaceSection, "chat">, { eyebrow: string; title: string; description: string }> = {
  projects: { eyebrow: "Workspace", title: "Projects", description: "Choose the codebase the agent should work in." },
  artifacts: { eyebrow: "Your work", title: "Artifacts", description: "Browse reports, documents, and other files created by agent runs." },
  skills: { eyebrow: "Customize", title: "Skills", description: "Save reusable instructions that guide the agent on future tasks." },
  workflows: { eyebrow: "Reusable work", title: "Workflows", description: "Save a task once, then launch it in a fresh session whenever you need it." },
  connections: { eyebrow: "Connected apps", title: "Integrations", description: "Manage services Delvin can use in your workspace." },
  settings: { eyebrow: "Your account", title: "Settings", description: "Review your profile, usage, and the safeguards around agent runs." },
  agents: { eyebrow: "Your assistants", title: "Agents", description: "Give each Agent its own instructions, saved memory, and place in your workspace." },
  groups: { eyebrow: "Your conversations", title: "Group Chats", description: "Bring one or more of your Agents together in a shared conversational chat." },
};

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cx("rounded-2xl border border-border-faint bg-surface-secondary p-4 shadow-card sm:p-5", className)}>{children}</section>;
}

function Empty({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-border-medium bg-surface-secondary/70 px-5 py-10 text-center"><p className="text-sm font-medium text-text-primary">{title}</p><p className="mx-auto mt-1 max-w-md text-xs leading-5 text-text-muted">{detail}</p>{action && <div className="mt-4">{action}</div>}</div>;
}

function Field({ label, value, onChange, placeholder, multiline = false, rows = 4 }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; multiline?: boolean; rows?: number }) {
  const shared = "mt-1.5 w-full rounded-xl border border-border-faint bg-surface-floating px-3 py-2.5 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-border-strong";
  return <label className="block text-xs font-medium text-text-secondary">{label}{multiline ? <textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={`${shared} resize-y leading-5`} /> : <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={`${shared} h-10`} />}</label>;
}

export function WorkspaceHub({
  section,
  project,
  user,
  quota,
  guest = false,
  onSelectProject,
  onOpenRepository,
  onManageConnections,
  onOpenAccount,
  onRequestLogin,
  onRunWorkflow,
  reloadKey = 0,
}: {
  section: Exclude<WorkspaceSection, "chat">;
  project?: Project | null;
  user?: HubUser | null;
  quota?: { remaining: number | null; limit: number; exhausted: boolean; unlimited: boolean } | null;
  guest?: boolean;
  onSelectProject: (project: Project) => void;
  onOpenRepository: () => void;
  onManageConnections: () => void;
  onOpenAccount: () => void;
  onRequestLogin: () => void;
  onRunWorkflow: (workflowId: string) => Promise<void>;
  reloadKey?: number;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [connections, setConnections] = useState<{ github: boolean; google: boolean }>({ github: false, google: false });
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [prompt, setPrompt] = useState("");
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [groups, setGroups] = useState<GroupChat[]>([]);
  const [memory, setMemory] = useState("");
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [editingAgent, setEditingAgent] = useState<AgentProfile | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupAgentIds, setEditingGroupAgentIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<{ name: string; content: string } | null>(null);

  async function load() {
    if (guest) return;
    setLoading(true);
    setError(null);
    try {
      if (section === "projects") {
        const result: any = await api.listProjects();
        setProjects(result.projects || []);
      } else if (section === "artifacts") {
        const result: any = await api.listArtifacts();
        setArtifacts(result.artifacts || []);
      } else if (section === "skills") {
        const result: any = await api.listSkills();
        setSkills(result.skills || []);
      } else if (section === "workflows") {
        const result: any = await api.listWorkflows();
        setWorkflows(result.workflows || []);
      } else if (section === "agents") {
        const result: any = await api.listAgents();
        setAgents(result.agents || []);
      } else if (section === "groups") {
        const [agentResult, groupResult]: any[] = await Promise.all([api.listAgents(), api.listGroups()]);
        setAgents(agentResult.agents || []);
        setGroups(groupResult.groups || []);
      } else if (section === "connections") {
        const [github, google] = await Promise.all([api.githubStatus().catch(() => ({ connected: false })), api.googleStatus().catch(() => ({ connected: false }))]);
        setConnections({ github: Boolean((github as any).connected), google: Boolean((google as any).connected) });
      }
    } catch (cause: any) {
      setError(cause.message || "Unable to load this section.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); /* load follows the active product section */ }, [section, project?.id, reloadKey, guest]);

  async function createSkill(event: FormEvent) {
    event.preventDefault();
    setBusyId("create"); setError(null); setNotice(null);
    try {
      const result: any = await api.createSkill({ name, description, instructions });
      setSkills((items) => [result.skill, ...items]);
      setName(""); setDescription(""); setInstructions(""); setAdding(false);
      setNotice("Skill saved. Its instructions will be included in your next agent run.");
    } catch (cause: any) { setError(cause.message || "Could not save the Skill."); }
    finally { setBusyId(null); }
  }

  async function toggleSkill(skill: Skill) {
    setBusyId(skill.id); setError(null);
    try {
      const result: any = await api.updateSkill(skill.id, { enabled: !skill.enabled });
      setSkills((items) => items.map((item) => item.id === skill.id ? result.skill : item));
    } catch (cause: any) { setError(cause.message || "Could not update the Skill."); }
    finally { setBusyId(null); }
  }

  async function removeSkill(skill: Skill) {
    if (!window.confirm(`Delete the Skill “${skill.name}”?`)) return;
    setBusyId(skill.id); setError(null);
    try { await api.deleteSkill(skill.id); setSkills((items) => items.filter((item) => item.id !== skill.id)); }
    catch (cause: any) { setError(cause.message || "Could not delete the Skill."); }
    finally { setBusyId(null); }
  }

  async function createWorkflow(event: FormEvent) {
    event.preventDefault(); setBusyId("create"); setError(null); setNotice(null);
    try {
      const result: any = await api.createWorkflow({ name, description, prompt, projectId: project?.id || null });
      setWorkflows((items) => [result.workflow, ...items]);
      setName(""); setDescription(""); setPrompt(""); setAdding(false);
      setNotice("Workflow saved. It is ready to run manually in a new session.");
    } catch (cause: any) { setError(cause.message || "Could not save the workflow."); }
    finally { setBusyId(null); }
  }

  async function toggleWorkflow(workflow: Workflow) {
    setBusyId(workflow.id); setError(null);
    try {
      const result: any = await api.updateWorkflow(workflow.id, { enabled: !workflow.enabled });
      setWorkflows((items) => items.map((item) => item.id === workflow.id ? { ...item, ...result.workflow } : item));
    } catch (cause: any) { setError(cause.message || "Could not update the workflow."); }
    finally { setBusyId(null); }
  }

  async function removeWorkflow(workflow: Workflow) {
    if (!window.confirm(`Delete the workflow “${workflow.name}”?`)) return;
    setBusyId(workflow.id); setError(null);
    try { await api.deleteWorkflow(workflow.id); setWorkflows((items) => items.filter((item) => item.id !== workflow.id)); }
    catch (cause: any) { setError(cause.message || "Could not delete the workflow."); }
    finally { setBusyId(null); }
  }

  async function openArtifact(artifact: Artifact) {
    setBusyId(artifact.id); setError(null);
    try {
      const result: any = await api.getArtifactContent(artifact.id);
      setPreview({ name: result.artifact?.name || artifact.name, content: result.content || "" });
    } catch (cause: any) { setError(cause.message || "Could not open the artifact."); }
    finally { setBusyId(null); }
  }

  const heading = HEADINGS[section];
  async function createAgent(event: FormEvent) {
    event.preventDefault(); setBusyId("create-agent"); setError(null); setNotice(null);
    try {
      const result: any = await api.createAgent({ name, instructions, memory });
      setAgents((items) => [result.agent, ...items]);
      setName(""); setInstructions(""); setMemory(""); setAdding(false);
      setNotice("Agent saved. Its instructions and memory will guide new conversations assigned to it.");
    } catch (cause: any) { setError(cause.message || "Could not save the Agent."); }
    finally { setBusyId(null); }
  }

  async function saveAgent(agent: AgentProfile) {
    setBusyId(agent.id); setError(null);
    try {
      const result: any = await api.updateAgent(agent.id, { name: agent.name, instructions: agent.instructions, memory: agent.memory });
      setAgents((items) => items.map((item) => item.id === agent.id ? result.agent : item));
      setEditingAgent(null);
    } catch (cause: any) { setError(cause.message || "Could not update the Agent."); }
    finally { setBusyId(null); }
  }

  async function toggleAgentPin(agent: AgentProfile) {
    setBusyId(agent.id); setError(null);
    try {
      const result: any = await api.updateAgent(agent.id, { isPinned: !agent.isPinned });
      setAgents((items) => items.map((item) => item.id === agent.id ? result.agent : item));
    } catch (cause: any) { setError(cause.message || "Could not update the Agent."); }
    finally { setBusyId(null); }
  }

  async function removeAgent(agent: AgentProfile) {
    if (!window.confirm(`Delete the Agent “${agent.name}”? Existing sessions will keep their history.`)) return;
    setBusyId(agent.id); setError(null);
    try { await api.deleteAgent(agent.id); setAgents((items) => items.filter((item) => item.id !== agent.id)); }
    catch (cause: any) { setError(cause.message || "Could not delete the Agent."); }
    finally { setBusyId(null); }
  }

  async function createGroup(event: FormEvent) {
    event.preventDefault(); setBusyId("create-group"); setError(null); setNotice(null);
    try {
      const result: any = await api.createGroup({ name, agentIds: selectedAgentIds });
      setGroups((items) => [result.group, ...items]);
      setName(""); setSelectedAgentIds([]); setAdding(false);
      setNotice("Group Chat saved. Create a new chat from the sidebar to start a conversation with these Agents.");
    } catch (cause: any) { setError(cause.message || "Could not save the Group Chat."); }
    finally { setBusyId(null); }
  }

  async function saveGroupMembers(group: GroupChat) {
    if (!editingGroupAgentIds.length) return;
    setBusyId(group.id); setError(null);
    try {
      const result: any = await api.updateGroup(group.id, { agentIds: editingGroupAgentIds });
      setGroups((items) => items.map((item) => item.id === group.id ? result.group : item));
      setEditingGroupId(null);
    } catch (cause: any) { setError(cause.message || "Could not update Group Chat members."); }
    finally { setBusyId(null); }
  }

  async function toggleGroupPin(group: GroupChat) {
    setBusyId(group.id); setError(null);
    try {
      const result: any = await api.updateGroup(group.id, { isPinned: !group.isPinned });
      setGroups((items) => items.map((item) => item.id === group.id ? result.group : item));
    } catch (cause: any) { setError(cause.message || "Could not update the Group Chat."); }
    finally { setBusyId(null); }
  }

  async function removeGroup(group: GroupChat) {
    if (!window.confirm(`Delete the Group Chat “${group.name}”? Its existing session history will remain.`)) return;
    setBusyId(group.id); setError(null);
    try { await api.deleteGroup(group.id); setGroups((items) => items.filter((item) => item.id !== group.id)); }
    catch (cause: any) { setError(cause.message || "Could not delete the Group Chat."); }
    finally { setBusyId(null); }
  }

  return <main className="min-h-0 flex-1 overflow-y-auto bg-surface-primary px-4 py-6 sm:px-8 sm:py-8">
    <div className="mx-auto w-full max-w-[980px]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">{heading.eyebrow}</p><h1 className="mt-1 font-serif-display text-3xl tracking-[-0.04em] text-text-primary sm:text-4xl">{heading.title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">{heading.description}</p></div>
        <button type="button" onClick={() => void load()} disabled={loading || guest} className="rounded-lg border border-border-faint bg-surface-secondary px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-raised disabled:opacity-50">{loading ? "Loading…" : "Refresh"}</button>
      </div>

      {guest && <Empty title="Sign in to use your workspace library" detail="Your projects, Skills, artifacts, and saved workflows are private to your Delvin account." action={<Button onClick={onRequestLogin}>Sign in</Button>} />}
      {!guest && (error || notice) && <p role={error ? "alert" : "status"} className={cx("mb-4 rounded-xl border px-3 py-2.5 text-xs", error ? "border-interactive-negative/25 bg-interactive-negative/[0.06] text-interactive-negative" : "border-interactive-positive/25 bg-interactive-positive/[0.06] text-interactive-positive")}>{error || notice}</p>}
      {!guest && loading && <div className="rounded-2xl border border-border-faint bg-surface-secondary p-8 text-center text-sm text-text-muted">Loading {heading.title.toLowerCase()}…</div>}

      {!guest && !loading && section === "projects" && <div className="space-y-3">
        {projects.length === 0 ? <Empty title="No projects yet" detail="Connect a GitHub repository or choose a workspace to give the agent a codebase to work in." action={<Button onClick={onOpenRepository}><IconPlus className="h-4 w-4" /> Select repository</Button>} /> : <>
          <div className="flex justify-end"><Button variant="secondary" size="sm" onClick={onOpenRepository}><IconPlus className="h-4 w-4" /> Add project</Button></div>
          {projects.map((item) => <button key={item.id} type="button" onClick={() => onSelectProject(item)} className={cx("flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-colors", project?.id === item.id ? "border-border-strong bg-surface-raised/60" : "border-border-faint bg-surface-secondary hover:bg-surface-raised/50")}><span className="grid h-10 w-10 place-items-center rounded-xl bg-surface-tertiary text-text-secondary"><IconFolder className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-text-primary">{item.name}</span><span className="mt-1 block truncate text-xs text-text-muted">{item.repositoryUrl || "Delvin workspace"} · {item.defaultBranch || "main"}</span></span><span className="text-xs text-text-muted">{project?.id === item.id ? "Current project" : "Use project"}</span></button>)}
        </>}
      </div>}

      {!guest && !loading && section === "artifacts" && <div className="space-y-3">
        {artifacts.length === 0 ? <Empty title="No artifacts yet" detail="When Delvin creates reports, documents, or other deliverables in a run, they’ll be collected here." /> : artifacts.map((artifact) => <Card key={artifact.id} className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-tertiary text-text-secondary"><IconFile className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-text-primary">{artifact.name}</p><p className="mt-1 truncate text-xs text-text-muted">{artifact.kind} · {artifact.sizeBytes ? `${Math.max(1, Math.round(artifact.sizeBytes / 1024))} KB` : "file"} · {new Date(artifact.createdAt).toLocaleDateString()}</p></div><Button variant="secondary" size="sm" disabled={busyId === artifact.id} onClick={() => void openArtifact(artifact)}>{busyId === artifact.id ? "Opening…" : "Preview"}</Button></Card>)}
      </div>}

      {!guest && !loading && section === "agents" && <div className="space-y-3">
        <div className="flex justify-end"><Button size="sm" onClick={() => { setAdding((value) => !value); setError(null); }}><IconPlus className="h-4 w-4" /> New Agent</Button></div>
        {adding && <Card><form onSubmit={createAgent} className="space-y-3"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-text-primary">Create an Agent</p><p className="mt-1 text-xs text-text-muted">Instructions and memory are reusable prompt context. They do not grant new tools or permissions.</p></div><button type="button" onClick={() => setAdding(false)} aria-label="Close Agent form" className="text-text-muted hover:text-text-primary"><IconX className="h-4 w-4" /></button></div><Field label="Name" value={name} onChange={setName} placeholder="e.g. Code Reviewer" /><Field label="Instructions" value={instructions} onChange={setInstructions} multiline rows={5} placeholder="How should this Agent approach its work?" /><Field label="Saved memory" value={memory} onChange={setMemory} multiline rows={4} placeholder="Useful preferences or context to remember for this Agent…" /><div className="flex justify-end"><Button type="submit" disabled={busyId === "create-agent" || name.trim().length < 2}>{busyId === "create-agent" ? "Saving…" : "Save Agent"}</Button></div></form></Card>}
        {agents.length === 0 && !adding ? <Empty title="No Agents yet" detail="A default Agent is created automatically. Create a specialized Agent for reviews, research, or another recurring role." action={<Button onClick={() => setAdding(true)}><IconPlus className="h-4 w-4" /> Create Agent</Button>} /> : agents.map((agent) => {
          const draft = editingAgent?.id === agent.id ? editingAgent : agent;
          return <Card key={agent.id}><div className="flex flex-wrap items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-tertiary text-text-secondary"><IconSparkle className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-medium text-text-primary">{agent.name}</h2>{agent.isDefault && <span className="rounded-full bg-surface-raised px-2 py-0.5 text-[10px] text-text-muted">Default</span>}{agent.isPinned && <span className="rounded-full bg-interactive-link/10 px-2 py-0.5 text-[10px] text-interactive-link">Pinned</span>}</div>{editingAgent?.id === agent.id ? <div className="mt-3 space-y-3"><Field label="Name" value={draft.name} onChange={(value) => setEditingAgent((current) => current?.id === agent.id ? { ...current, name: value } : current)} /><Field label="Instructions" value={draft.instructions} onChange={(value) => setEditingAgent((current) => current?.id === agent.id ? { ...current, instructions: value } : current)} multiline rows={4} /><Field label="Saved memory" value={draft.memory} onChange={(value) => setEditingAgent((current) => current?.id === agent.id ? { ...current, memory: value } : current)} multiline rows={3} /><div className="flex justify-end gap-2"><Button variant="secondary" size="sm" onClick={() => setEditingAgent(null)}>Cancel</Button><Button size="sm" disabled={busyId === agent.id || draft.name.trim().length < 2} onClick={() => void saveAgent(draft)}>{busyId === agent.id ? "Saving…" : "Save changes"}</Button></div></div> : <><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-text-secondary">{agent.instructions || "No custom instructions."}</p><p className="mt-2 whitespace-pre-wrap text-[11px] leading-5 text-text-muted">Memory: {agent.memory || "None saved"}</p><p className="mt-2 text-[10px] text-text-muted">{agent._count?.sessions ?? 0} sessions</p></>}</div><div className="flex shrink-0 items-center gap-1.5"><Button variant="secondary" size="sm" disabled={busyId === agent.id} onClick={() => void toggleAgentPin(agent)}>{agent.isPinned ? "Unpin" : "Pin"}</Button>{!agent.isDefault && <button type="button" onClick={() => setEditingAgent({ ...agent })} className="rounded-lg border border-border-faint px-2.5 py-1.5 text-[11px] text-text-secondary hover:bg-surface-raised">Edit</button>}{!agent.isDefault && <button type="button" onClick={() => void removeAgent(agent)} disabled={busyId === agent.id} aria-label={`Delete ${agent.name}`} className="grid h-8 w-8 place-items-center rounded-lg text-text-muted hover:bg-interactive-negative/10 hover:text-interactive-negative disabled:opacity-50"><IconTrash className="h-4 w-4" /></button>}</div></div></Card>;
        })}
      </div>}

      {!guest && !loading && section === "groups" && <div className="space-y-3">
        <div className="flex justify-end"><Button size="sm" onClick={() => { setAdding((value) => !value); setError(null); }}><IconPlus className="h-4 w-4" /> New Group Chat</Button></div>
        {adding && <Card><form onSubmit={createGroup} className="space-y-3"><div><p className="text-sm font-medium text-text-primary">Create a Group Chat</p><p className="mt-1 text-xs text-text-muted">Choose at least one Agent. Group conversations are conversational; workspace tools are disabled for group runs.</p></div><Field label="Group name" value={name} onChange={setName} placeholder="e.g. Design review" /><div className="space-y-2">{agents.map((agent) => <label key={agent.id} className="flex items-center gap-2 rounded-lg border border-border-faint px-3 py-2 text-xs text-text-secondary"><input type="checkbox" checked={selectedAgentIds.includes(agent.id)} onChange={(event) => setSelectedAgentIds((ids) => event.target.checked ? [...ids, agent.id] : ids.filter((id) => id !== agent.id))} className="accent-[hsl(var(--interactive-link))]" />{agent.name}{agent.isDefault ? " · Default" : ""}</label>)}</div><div className="flex justify-end"><Button type="submit" disabled={busyId === "create-group" || name.trim().length < 2 || selectedAgentIds.length < 1}>{busyId === "create-group" ? "Saving…" : "Save Group Chat"}</Button></div></form></Card>}
        {groups.length === 0 && !adding ? <Empty title="No Group Chats yet" detail="Combine your Agents for a multi-perspective conversation. Create a Group Chat here, then start it from the sidebar." action={<Button onClick={() => setAdding(true)}><IconPlus className="h-4 w-4" /> Create Group Chat</Button>} /> : groups.map((group) => <Card key={group.id}><div className="flex flex-wrap items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-tertiary text-text-secondary"><IconSparkle className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-medium text-text-primary">{group.name}</h2>{group.isPinned && <span className="rounded-full bg-interactive-link/10 px-2 py-0.5 text-[10px] text-interactive-link">Pinned</span>}</div><p className="mt-1 text-xs leading-5 text-text-muted">{group.agents.map((agent) => agent.name).join(" · ")} · {group.sessionCount || 0} chats</p>{editingGroupId === group.id && <div className="mt-3 space-y-2">{agents.map((agent) => <label key={agent.id} className="flex items-center gap-2 rounded-lg border border-border-faint px-3 py-2 text-xs text-text-secondary"><input type="checkbox" checked={editingGroupAgentIds.includes(agent.id)} onChange={(event) => setEditingGroupAgentIds((ids) => event.target.checked ? [...ids, agent.id] : ids.filter((id) => id !== agent.id))} className="accent-[hsl(var(--interactive-link))]" />{agent.name}</label>)}<div className="flex justify-end gap-2"><Button variant="secondary" size="sm" onClick={() => setEditingGroupId(null)}>Cancel</Button><Button size="sm" disabled={!editingGroupAgentIds.length || busyId === group.id} onClick={() => void saveGroupMembers(group)}>{busyId === group.id ? "Saving…" : "Save members"}</Button></div></div>}</div><div className="flex shrink-0 items-center gap-1.5"><Button variant="secondary" size="sm" onClick={() => void toggleGroupPin(group)} disabled={busyId === group.id}>{group.isPinned ? "Unpin" : "Pin"}</Button><button type="button" onClick={() => { setEditingGroupId(group.id); setEditingGroupAgentIds(group.agents.map((agent) => agent.id)); }} className="rounded-lg border border-border-faint px-2.5 py-1.5 text-[11px] text-text-secondary hover:bg-surface-raised">Edit members</button><button type="button" onClick={() => void removeGroup(group)} disabled={busyId === group.id} aria-label={`Delete ${group.name}`} className="grid h-8 w-8 place-items-center rounded-lg text-text-muted hover:bg-interactive-negative/10 hover:text-interactive-negative disabled:opacity-50"><IconTrash className="h-4 w-4" /></button></div></div></Card>)}
      </div>}

      {!guest && !loading && section === "skills" && <div className="space-y-3">
        <div className="flex justify-end"><Button size="sm" onClick={() => { setAdding((value) => !value); setError(null); }}><IconPlus className="h-4 w-4" /> New Skill</Button></div>
        {adding && <Card><form onSubmit={createSkill} className="space-y-3"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-text-primary">Create a Skill</p><p className="mt-1 text-xs text-text-muted">Skills are plain instructions—not executable code—and are added to the agent’s context when enabled.</p></div><button type="button" onClick={() => setAdding(false)} aria-label="Close Skill form" className="text-text-muted hover:text-text-primary"><IconX className="h-4 w-4" /></button></div><Field label="Name" value={name} onChange={setName} placeholder="e.g. Review TypeScript changes" /><Field label="Short description" value={description} onChange={setDescription} placeholder="What this Skill is for" /><Field label="Instructions" value={instructions} onChange={setInstructions} multiline rows={6} placeholder="Write clear, reusable guidance for the agent…" /><div className="flex justify-end"><Button type="submit" disabled={busyId === "create" || name.trim().length < 2 || instructions.trim().length < 3}>{busyId === "create" ? "Saving…" : "Save Skill"}</Button></div></form></Card>}
        {skills.length === 0 && !adding ? <Empty title="Make Delvin work your way" detail="Add a Skill with reusable conventions, review criteria, or project instructions. Enabled Skills guide the next agent run." action={<Button onClick={() => setAdding(true)}><IconPlus className="h-4 w-4" /> Create first Skill</Button>} /> : skills.map((skill) => <Card key={skill.id}><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-tertiary text-text-secondary"><IconSparkle className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-medium text-text-primary">{skill.name}</h2><span className={cx("rounded-full px-2 py-0.5 text-[10px]", skill.enabled ? "bg-interactive-positive/10 text-interactive-positive" : "bg-surface-raised text-text-muted")}>{skill.enabled ? "Enabled" : "Disabled"}</span></div><p className="mt-1 text-xs leading-5 text-text-muted">{skill.description || skill.instructions.slice(0, 160)}</p><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-text-secondary">{skill.instructions.slice(0, 360)}{skill.instructions.length > 360 ? "…" : ""}</p></div><div className="flex shrink-0 items-center gap-1"><button type="button" onClick={() => void toggleSkill(skill)} disabled={busyId === skill.id} aria-label={`${skill.enabled ? "Disable" : "Enable"} ${skill.name}`} className="rounded-lg border border-border-faint px-2.5 py-1.5 text-[11px] text-text-secondary hover:bg-surface-raised disabled:opacity-50">{busyId === skill.id ? "…" : skill.enabled ? "Disable" : "Enable"}</button><button type="button" onClick={() => void removeSkill(skill)} disabled={busyId === skill.id} aria-label={`Delete ${skill.name}`} className="grid h-8 w-8 place-items-center rounded-lg text-text-muted hover:bg-interactive-negative/10 hover:text-interactive-negative disabled:opacity-50"><IconTrash className="h-4 w-4" /></button></div></div></Card>)}
      </div>}

      {!guest && !loading && section === "workflows" && <div className="space-y-3">
        <div className="flex justify-end"><Button size="sm" onClick={() => { setAdding((value) => !value); setError(null); }}><IconPlus className="h-4 w-4" /> New workflow</Button></div>
        {adding && <Card><form onSubmit={createWorkflow} className="space-y-3"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-text-primary">Create a reusable workflow</p><p className="mt-1 text-xs text-text-muted">Manual launch only: each run starts a fresh session and uses the saved project, if selected.</p></div><button type="button" onClick={() => setAdding(false)} aria-label="Close workflow form" className="text-text-muted hover:text-text-primary"><IconX className="h-4 w-4" /></button></div><Field label="Name" value={name} onChange={setName} placeholder="e.g. Run the release checklist" /><Field label="Description" value={description} onChange={setDescription} placeholder="Optional summary" /><Field label="Task prompt" value={prompt} onChange={setPrompt} multiline rows={6} placeholder="What should Delvin do each time this workflow runs?" /><p className="text-[11px] text-text-muted">Saved project: {project?.name || "None — the run will use the default workspace"}</p><div className="flex justify-end"><Button type="submit" disabled={busyId === "create" || name.trim().length < 2 || prompt.trim().length < 3}>{busyId === "create" ? "Saving…" : "Save workflow"}</Button></div></form></Card>}
        {workflows.length === 0 && !adding ? <Empty title="Turn repeat work into one-click runs" detail="Create a reusable prompt for release checks, code reviews, or other recurring tasks. Scheduled triggers are not enabled yet." action={<Button onClick={() => setAdding(true)}><IconPlus className="h-4 w-4" /> Create workflow</Button>} /> : workflows.map((workflow) => <Card key={workflow.id}><div className="flex flex-wrap items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-tertiary text-text-secondary"><IconShield className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-medium text-text-primary">{workflow.name}</h2><span className={cx("rounded-full px-2 py-0.5 text-[10px]", workflow.enabled ? "bg-interactive-positive/10 text-interactive-positive" : "bg-surface-raised text-text-muted")}>{workflow.enabled ? "Ready" : "Disabled"}</span></div><p className="mt-1 text-xs leading-5 text-text-muted">{workflow.description || workflow.prompt.slice(0, 160)}</p><p className="mt-2 text-[11px] text-text-muted">{workflow.runs?.[0] ? `Last run: ${workflow.runs[0].status} · ${new Date(workflow.runs[0].createdAt).toLocaleString()}` : "Not run yet"}</p></div><div className="flex items-center gap-1.5"><Button size="sm" disabled={!workflow.enabled || busyId === workflow.id || quota?.exhausted} onClick={() => { setBusyId(workflow.id); void onRunWorkflow(workflow.id).finally(() => setBusyId(null)); }}>{busyId === workflow.id ? "Starting…" : "Run now"}</Button><button type="button" onClick={() => void toggleWorkflow(workflow)} disabled={busyId === workflow.id} className="rounded-lg border border-border-faint px-2.5 py-1.5 text-[11px] text-text-secondary hover:bg-surface-raised disabled:opacity-50">{workflow.enabled ? "Disable" : "Enable"}</button><button type="button" onClick={() => void removeWorkflow(workflow)} disabled={busyId === workflow.id} aria-label={`Delete ${workflow.name}`} className="grid h-8 w-8 place-items-center rounded-lg text-text-muted hover:bg-interactive-negative/10 hover:text-interactive-negative disabled:opacity-50"><IconTrash className="h-4 w-4" /></button></div></div></Card>)}
      </div>}

      {!guest && !loading && section === "connections" && <div className="grid gap-3 sm:grid-cols-2">
        <Card><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-surface-tertiary text-text-primary"><IconGithub className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h2 className="text-sm font-medium text-text-primary">GitHub</h2><p className="mt-1 text-xs text-text-muted">Repositories, branches, and version-control actions</p></div><span className={cx("rounded-full px-2 py-1 text-[10px]", connections.github ? "bg-interactive-positive/10 text-interactive-positive" : "bg-surface-raised text-text-muted")}>{connections.github ? "Connected" : "Not connected"}</span></div><Button variant="secondary" className="mt-4 w-full" onClick={onManageConnections}>Manage GitHub</Button></Card>
        <Card><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-surface-tertiary text-[#4285F4] text-sm font-bold">G</span><div className="min-w-0 flex-1"><h2 className="text-sm font-medium text-text-primary">Google Workspace</h2><p className="mt-1 text-xs text-text-muted">Drive, Docs, Sheets, Slides, Gmail, and Calendar</p></div><span className={cx("rounded-full px-2 py-1 text-[10px]", connections.google ? "bg-interactive-positive/10 text-interactive-positive" : "bg-surface-raised text-text-muted")}>{connections.google ? "Connected" : "Not connected"}</span></div><Button variant="secondary" className="mt-4 w-full" onClick={onManageConnections}>Manage Google</Button></Card>
        <p className="text-xs leading-5 text-text-muted sm:col-span-2">Only integrations shown as connected can be selected in a prompt. Delvin does not expose Cue-only Mail, Phone, or Wallet features.</p>
      </div>}

      {!guest && !loading && section === "settings" && <div className="grid gap-3 lg:grid-cols-[1.15fr_.85fr]">
        <Card><div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-surface-tertiary text-sm font-medium text-text-secondary">{user?.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" /> : (user?.displayName || user?.email || "D").slice(0, 1).toUpperCase()}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-text-primary">{user?.displayName || "Your profile"}</p><p className="truncate text-xs text-text-muted">{user?.email || "Signed-in account"}</p></div><Button variant="secondary" size="sm" onClick={onOpenAccount}><IconSettings className="h-4 w-4" /> Edit</Button></div><div className="mt-5 border-t border-border-faint pt-4"><p className="text-xs font-medium text-text-secondary">Profile and sign-in</p><p className="mt-1 text-xs leading-5 text-text-muted">Update your name or avatar, sign out, or manage your Delvin account.</p><button type="button" onClick={onOpenAccount} className="mt-3 text-xs font-medium text-interactive-link underline-offset-2 hover:underline">Open profile settings</button></div></Card>
        <Card><p className="text-sm font-medium text-text-primary">Usage</p><p className="mt-1 text-xs leading-5 text-text-muted">Agent runs available in the current daily allowance.</p><div className="mt-4 flex items-end gap-2"><span className="font-serif-display text-3xl text-text-primary">{quota?.unlimited ? "∞" : quota?.remaining ?? "—"}</span><span className="pb-1 text-xs text-text-muted">{quota?.unlimited ? "unlimited" : `of ${quota?.limit ?? "—"} runs remaining`}</span></div>{quota?.exhausted && <p className="mt-3 rounded-xl bg-interactive-warning/10 px-3 py-2 text-xs text-interactive-warning">The current allowance is used. It resets at UTC midnight.</p>}</Card>
        <Card className="lg:col-span-2"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-tertiary text-interactive-positive"><IconShield className="h-5 w-5" /></span><div><p className="text-sm font-medium text-text-primary">Run safeguards</p><p className="mt-1 text-xs leading-5 text-text-muted">Commands run in the project workspace. High-risk shell commands wait for your approval, files are path-validated, and tool results are recorded in the activity timeline.</p><button type="button" onClick={onManageConnections} className="mt-3 text-xs font-medium text-interactive-link underline-offset-2 hover:underline">Manage connected services</button></div></div></Card>
      </div>}
    </div>

    {preview && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-label={`Preview ${preview.name}`} onClick={() => setPreview(null)}><section className="flex max-h-[86dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border-faint bg-surface-floating shadow-floating" onClick={(event) => event.stopPropagation()}><header className="flex items-center gap-3 border-b border-border-faint px-4 py-3"><IconFile className="h-4 w-4 text-text-muted" /><h2 className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">{preview.name}</h2><button type="button" aria-label="Close preview" onClick={() => setPreview(null)} className="text-text-muted hover:text-text-primary"><IconX className="h-4 w-4" /></button></header><pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-5 text-text-secondary">{preview.content}</pre></section></div>}
  </main>;
}
