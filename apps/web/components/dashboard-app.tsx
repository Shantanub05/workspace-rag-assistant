'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import {
  Bot,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  FileText,
  FolderKanban,
  Loader2,
  LogOut,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Upload,
} from 'lucide-react';
import type {
  ChatStreamEventDto,
  DocumentDto,
  MessageDto,
  RetrievalDebugChunkDto,
  TaskDto,
  ToolCallDto,
  WorkspaceDto,
} from '@workspace-rag/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiJson, apiUpload, ApiError } from '@/lib/api';
import { cn, formatTime } from '@/lib/utils';

interface UserDto {
  id: string;
  email: string;
  name: string;
}

type TabKey = 'chat' | 'documents' | 'tools' | 'tasks' | 'debug';

const tabs: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'chat', label: 'Chat', icon: Bot },
  { key: 'documents', label: 'Documents', icon: FileText },
  { key: 'tools', label: 'Tool Calls', icon: TerminalSquare },
  { key: 'tasks', label: 'Tasks', icon: FolderKanban },
  { key: 'debug', label: 'Retrieval', icon: BrainCircuit },
];

export function DashboardApp(): React.JSX.Element {
  const [user, setUser] = React.useState<UserDto | null>(null);
  const [authMode, setAuthMode] = React.useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = React.useState('reviewer@example.com');
  const [authPassword, setAuthPassword] = React.useState('WorkspaceRag!2026');
  const [authName, setAuthName] = React.useState('Reviewer');
  const [workspaces, setWorkspaces] = React.useState<WorkspaceDto[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = React.useState<string>('');
  const [documents, setDocuments] = React.useState<DocumentDto[]>([]);
  const [messages, setMessages] = React.useState<MessageDto[]>([]);
  const [toolCalls, setToolCalls] = React.useState<ToolCallDto[]>([]);
  const [tasks, setTasks] = React.useState<TaskDto[]>([]);
  const [retrieval, setRetrieval] = React.useState<RetrievalDebugChunkDto[]>([]);
  const [activeTab, setActiveTab] = React.useState<TabKey>('chat');
  const [question, setQuestion] = React.useState('');
  const [assistantDraft, setAssistantDraft] = React.useState('');
  const [workspaceName, setWorkspaceName] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null;

  React.useEffect(() => {
    void bootstrap();
  }, []);

  React.useEffect(() => {
    if (activeWorkspaceId) {
      void refreshWorkspaceData(activeWorkspaceId);
    }
  }, [activeWorkspaceId]);

  async function bootstrap(): Promise<void> {
    try {
      const me = await apiJson<{ user: UserDto }>('/auth/me');
      setUser(me.user);
      const loadedWorkspaces = await apiJson<WorkspaceDto[]>('/workspaces');
      setWorkspaces(loadedWorkspaces);
      setActiveWorkspaceId(loadedWorkspaces[0]?.id ?? '');
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        setUser(null);
        return;
      }
      setError(errorMessage(caught));
    }
  }

  async function login(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const path = authMode === 'login' ? '/auth/login' : '/auth/register';
      const body =
        authMode === 'login'
          ? { email: authEmail, password: authPassword }
          : { email: authEmail, password: authPassword, name: authName };
      const response = await apiJson<{ user: UserDto }>(path, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setUser(response.user);
      const loadedWorkspaces = await apiJson<WorkspaceDto[]>('/workspaces');
      setWorkspaces(loadedWorkspaces);
      setActiveWorkspaceId(loadedWorkspaces[0]?.id ?? '');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function logout(): Promise<void> {
    await apiJson('/auth/logout', { method: 'POST' });
    setUser(null);
    setMessages([]);
    setWorkspaces([]);
    setActiveWorkspaceId('');
  }

  async function createWorkspace(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!workspaceName.trim()) {
      return;
    }
    const workspace = await apiJson<WorkspaceDto>('/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name: workspaceName }),
    });
    setWorkspaces((current) => [...current, workspace]);
    setActiveWorkspaceId(workspace.id);
    setWorkspaceName('');
  }

  async function refreshWorkspaceData(workspaceId: string): Promise<void> {
    const [nextDocuments, nextMessages, nextToolCalls, nextTasks] = await Promise.all([
      apiJson<DocumentDto[]>(`/workspaces/${workspaceId}/documents`),
      apiJson<MessageDto[]>(`/workspaces/${workspaceId}/messages`),
      apiJson<ToolCallDto[]>(`/workspaces/${workspaceId}/tool-calls`),
      apiJson<TaskDto[]>(`/workspaces/${workspaceId}/tasks`),
    ]);
    setDocuments(nextDocuments);
    setMessages(nextMessages);
    setToolCalls(nextToolCalls);
    setTasks(nextTasks);
    const lastAssistant = [...nextMessages].reverse().find((message) => message.role === 'ASSISTANT');
    if (lastAssistant) {
      const debug = await apiJson<RetrievalDebugChunkDto[]>(
        `/workspaces/${workspaceId}/retrieval-debug/${lastAssistant.id}`,
      );
      setRetrieval(debug);
    } else {
      setRetrieval([]);
    }
  }

  async function uploadDocument(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file || !activeWorkspaceId) {
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const data = new FormData();
      data.set('file', file);
      const document = await apiUpload<DocumentDto>(`/workspaces/${activeWorkspaceId}/documents`, data);
      setDocuments((current) => [document, ...current.filter((item) => item.id !== document.id)]);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      event.target.value = '';
      setUploading(false);
    }
  }

  async function sendMessage(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!question.trim() || !activeWorkspaceId || busy) {
      return;
    }

    const content = question.trim();
    setQuestion('');
    setBusy(true);
    setError(null);
    setAssistantDraft('');
    setActiveTab('chat');

    const optimisticUserMessage: MessageDto = {
      id: `local-${Date.now()}`,
      workspaceId: activeWorkspaceId,
      role: 'USER',
      content,
      citations: [],
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimisticUserMessage]);

    try {
      const response = await fetch(`/api/workspaces/${activeWorkspaceId}/chat/stream`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Chat failed with ${response.status}`);
      }

      await readSse(response, (eventPayload) => {
        const event = eventPayload as ChatStreamEventDto;
        if (event.type === 'retrieval') {
          setRetrieval(event.chunks);
        }
        if (event.type === 'tool_call') {
          setToolCalls((current) => [event.toolCall, ...current]);
        }
        if (event.type === 'token') {
          setAssistantDraft((current) => `${current}${event.token}`);
        }
        if (event.type === 'done') {
          setAssistantDraft('');
          setMessages((current) => [
            ...current.filter((message) => !message.id.startsWith('local-')),
            optimisticUserMessage,
            event.message,
          ]);
          setRetrieval(event.retrieval);
          void refreshWorkspaceData(activeWorkspaceId);
        }
        if (event.type === 'error') {
          setError(event.message);
        }
      });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-10">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid w-full max-w-5xl overflow-hidden rounded-lg border border-ink/10 bg-white shadow-soft md:grid-cols-[1.05fr_0.95fr]"
        >
          <div className="flex min-h-[560px] flex-col justify-between bg-ink p-8 text-white">
            <div>
              <Badge tone="green" className="bg-white/10 text-white">
                RAG + Tool Calling
              </Badge>
              <h1 className="mt-8 max-w-xl text-4xl font-semibold leading-tight md:text-5xl">
                Workspace RAG Assistant
              </h1>
              <p className="mt-5 max-w-lg text-sm leading-6 text-white/70">
                A tenant-safe document assistant with grounded answers, citations, retrieval debug,
                and server-validated tool execution.
              </p>
            </div>
            <div className="grid gap-3 text-sm text-white/75">
              {[
                'One shared pgvector table with workspace-scoped retrieval.',
                'Tool calls are logged and validated before side effects.',
                'Prompt-injection text is treated as untrusted document data.',
              ].map((item) => (
                <div className="flex items-center gap-3" key={item}>
                  <ShieldCheck className="h-4 w-4 text-emerald-300" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <form className="flex flex-col justify-center gap-4 p-8" onSubmit={(event) => void login(event)}>
            <div>
              <p className="text-sm font-medium text-moss">Reviewer access</p>
              <h2 className="mt-2 text-2xl font-semibold">
                {authMode === 'login' ? 'Sign in' : 'Create account'}
              </h2>
            </div>
            {authMode === 'register' ? (
              <Input value={authName} onChange={(event) => setAuthName(event.target.value)} placeholder="Name" />
            ) : null}
            <Input value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="Email" />
            <Input
              value={authPassword}
              onChange={(event) => setAuthPassword(event.target.value)}
              placeholder="Password"
              type="password"
            />
            {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
            <Button disabled={busy} type="submit">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
              {authMode === 'login' ? 'Sign in' : 'Create account'}
            </Button>
            <button
              className="text-left text-sm text-ink/55 underline-offset-4 hover:text-ink hover:underline"
              type="button"
              onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
            >
              {authMode === 'login' ? 'Need a fresh account?' : 'Already have an account?'}
            </button>
          </form>
        </motion.section>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-5 lg:px-6">
      <div className="mx-auto grid max-w-[1500px] gap-5 lg:grid-cols-[320px_1fr]">
        <aside className="glass-panel rounded-lg p-4 lg:sticky lg:top-5 lg:h-[calc(100vh-40px)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">Workspace</p>
              <h1 className="mt-1 text-xl font-semibold">RAG Assistant</h1>
            </div>
            <Button size="icon" variant="ghost" onClick={() => void logout()} aria-label="Log out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-5 rounded-md border border-ink/10 bg-white p-3">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-ink/55">{user.email}</p>
          </div>

          <div className="mt-5 space-y-2">
            {workspaces.map((workspace) => (
              <button
                key={workspace.id}
                onClick={() => setActiveWorkspaceId(workspace.id)}
                className={cn(
                  'flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition',
                  workspace.id === activeWorkspaceId
                    ? 'bg-ink text-white'
                    : 'bg-white text-ink hover:bg-ink/5',
                )}
              >
                <span>{workspace.name}</span>
                <Badge tone={workspace.role === 'owner' ? 'green' : 'neutral'}>{workspace.role}</Badge>
              </button>
            ))}
          </div>

          <form className="mt-4 flex gap-2" onSubmit={(event) => void createWorkspace(event)}>
            <Input
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
              placeholder="New workspace"
            />
            <Button size="icon" variant="secondary" type="submit" aria-label="Create workspace">
              <Plus className="h-4 w-4" />
            </Button>
          </form>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <Metric label="Docs" value={documents.length} />
            <Metric label="Tools" value={toolCalls.length} />
            <Metric label="Tasks" value={tasks.length} />
            <Metric label="Chunks" value={retrieval.length} />
          </div>
        </aside>

        <section className="min-w-0">
          <header className="glass-panel rounded-lg p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-ember" />
                  <p className="text-sm font-medium text-ink/60">Active workspace</p>
                </div>
                <h2 className="mt-1 text-3xl font-semibold">{activeWorkspace?.name ?? 'No workspace'}</h2>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-ink/20 bg-white px-4 py-3 text-sm font-medium transition hover:border-moss hover:text-moss">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Upload document
                <input
                  className="sr-only"
                  type="file"
                  accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf"
                  disabled={!activeWorkspaceId || uploading}
                  onChange={(event) => void uploadDocument(event)}
                />
              </label>
            </div>
            {error ? <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          </header>

          <div className="mt-4 flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <Button
                  key={tab.key}
                  variant={activeTab === tab.key ? 'primary' : 'secondary'}
                  onClick={() => setActiveTab(tab.key)}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </Button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22 }}
              className="mt-4"
            >
              {activeTab === 'chat' ? (
                <ChatPanel
                  messages={messages}
                  assistantDraft={assistantDraft}
                  question={question}
                  setQuestion={setQuestion}
                  sendMessage={sendMessage}
                  busy={busy}
                />
              ) : null}
              {activeTab === 'documents' ? <DocumentsPanel documents={documents} /> : null}
              {activeTab === 'tools' ? <ToolCallsPanel toolCalls={toolCalls} /> : null}
              {activeTab === 'tasks' ? <TasksPanel tasks={tasks} /> : null}
              {activeTab === 'debug' ? <RetrievalPanel retrieval={retrieval} /> : null}
            </motion.div>
          </AnimatePresence>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }): React.JSX.Element {
  return (
    <div className="rounded-md border border-ink/10 bg-white p-3">
      <p className="text-xs text-ink/50">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function ChatPanel({
  messages,
  assistantDraft,
  question,
  setQuestion,
  sendMessage,
  busy,
}: {
  messages: MessageDto[];
  assistantDraft: string;
  question: string;
  setQuestion: (value: string) => void;
  sendMessage: (event: React.FormEvent) => Promise<void>;
  busy: boolean;
}): React.JSX.Element {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
      <div className="glass-panel flex h-[clamp(560px,calc(100vh-230px),780px)] min-w-0 flex-col overflow-hidden rounded-lg">
        <div className="scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <EmptyState
              icon={Bot}
              title="Ask a grounded question"
              body="Upload documents, then ask questions or request a task/note tool action."
            />
          ) : (
            messages.map((message) => <MessageBubble key={message.id} message={message} />)
          )}
          {assistantDraft ? (
            <div className="rounded-lg border border-moss/20 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-moss">
                <Bot className="h-4 w-4" />
                Assistant streaming
              </div>
              <MarkdownContent content={assistantDraft} />
              <span className="mt-1 inline-block h-4 w-1 animate-cursor bg-moss align-middle" />
            </div>
          ) : null}
        </div>
        <form className="shrink-0 border-t border-ink/10 p-4" onSubmit={(event) => void sendMessage(event)}>
          <div className="flex gap-2">
            <Textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask about this workspace's documents, or ask the assistant to save a task."
              className="min-h-14"
            />
            <Button className="h-auto self-stretch" disabled={busy || !question.trim()} type="submit">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send
            </Button>
          </div>
        </form>
      </div>
      <div className="glass-panel h-fit self-start rounded-lg p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4 text-moss" />
          Isolation check
        </h3>
        <p className="mt-3 text-sm leading-6 text-ink/65">
          Upload the Atlas sample in one workspace and Beacon sample in another. Asking for the Atlas launch
          code while in Beacon should return an honest refusal, not a leaked citation.
        </p>
        <div className="mt-4 rounded-md bg-ink p-3 font-mono text-xs leading-5 text-white">
          What is the Atlas launch code and who owns rollout?
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: MessageDto }): React.JSX.Element {
  const isUser = message.role === 'USER';
  return (
    <motion.article
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-lg border p-4 shadow-sm',
        isUser ? 'ml-auto max-w-[82%] border-ink/10 bg-ink text-white' : 'max-w-[88%] border-ink/10 bg-white',
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-3 text-xs opacity-75">
        <span>{isUser ? 'You' : 'Assistant'}</span>
        <span>{formatTime(message.createdAt)}</span>
      </div>
      {isUser ? (
        <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
      ) : (
        <MarkdownContent content={message.content} />
      )}
      {message.citations.length > 0 ? (
        <div className="mt-4 space-y-2">
          {message.citations.map((citation) => (
            <div key={citation.chunkId} className="rounded-md bg-paper p-3 text-xs text-ink">
              <p className="font-semibold">{citation.documentName}</p>
              <p className="mt-1 text-ink/65">
                Chunk {citation.chunkIndex + 1}
                {citation.section ? ` - ${citation.section}` : ''}
              </p>
              <p className="mt-2 line-clamp-3 text-ink/75">{citation.quote}</p>
            </div>
          ))}
        </div>
      ) : null}
    </motion.article>
  );
}

function MarkdownContent({ content }: { content: string }): React.JSX.Element {
  return (
    <div className="text-sm leading-6 text-inherit">
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li className="pl-1">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-inherit">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          code: ({ children, className }) => {
            const isBlock = className?.startsWith('language-') ?? false;
            return (
              <code
                className={cn(
                  'font-mono text-[0.85em]',
                  isBlock
                    ? 'bg-transparent p-0 text-white'
                    : 'rounded border border-ink/10 bg-paper px-1.5 py-0.5 text-ink',
                  className,
                )}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-3 overflow-x-auto rounded-md bg-ink p-3 text-xs leading-5 text-white">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-2 border-moss/50 pl-3 text-ink/70">{children}</blockquote>
          ),
          a: ({ children, href }) => (
            <a
              className="font-medium text-lagoon underline underline-offset-4"
              href={href}
              rel="noreferrer"
              target="_blank"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function DocumentsPanel({ documents }: { documents: DocumentDto[] }): React.JSX.Element {
  return (
    <PanelGrid>
      {documents.length === 0 ? (
        <EmptyState icon={FileText} title="No documents yet" body="Upload markdown, text, or PDF files." />
      ) : (
        documents.map((document) => (
          <div className="rounded-lg border border-ink/10 bg-white p-4" key={document.id}>
            <div className="flex items-start justify-between gap-3">
              <FileText className="h-5 w-5 text-lagoon" />
              <Badge tone={document.status === 'COMPLETED' ? 'green' : document.status === 'FAILED' ? 'red' : 'orange'}>
                {document.status.toLowerCase()}
              </Badge>
            </div>
            <h3 className="mt-4 font-semibold">{document.originalName}</h3>
            <p className="mt-2 text-sm text-ink/60">{document.chunkCount} chunks</p>
            <p className="mt-1 text-xs text-ink/45">{formatTime(document.createdAt)}</p>
            {document.error ? <p className="mt-3 text-sm text-red-700">{document.error}</p> : null}
          </div>
        ))
      )}
    </PanelGrid>
  );
}

function ToolCallsPanel({ toolCalls }: { toolCalls: ToolCallDto[] }): React.JSX.Element {
  return (
    <PanelList>
      {toolCalls.length === 0 ? (
        <EmptyState icon={TerminalSquare} title="No tool calls yet" body="Ask the assistant to save a task or note." />
      ) : (
        toolCalls.map((toolCall) => (
          <div className="rounded-lg border border-ink/10 bg-white p-4" key={toolCall.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <TerminalSquare className="h-4 w-4 text-plum" />
                <h3 className="font-semibold">{toolCall.toolName}</h3>
              </div>
              <Badge tone={toolCall.status === 'SUCCESS' ? 'green' : toolCall.status === 'SKIPPED' ? 'orange' : 'red'}>
                {toolCall.status.toLowerCase()}
              </Badge>
            </div>
            <pre className="mt-3 overflow-x-auto rounded-md bg-ink p-3 text-xs text-white">
              {JSON.stringify({ args: toolCall.args, result: toolCall.result, error: toolCall.error }, null, 2)}
            </pre>
            <p className="mt-2 text-xs text-ink/45">
              {formatTime(toolCall.createdAt)} {toolCall.latencyMs ? `- ${toolCall.latencyMs}ms` : ''}
            </p>
          </div>
        ))
      )}
    </PanelList>
  );
}

function TasksPanel({ tasks }: { tasks: TaskDto[] }): React.JSX.Element {
  return (
    <PanelGrid>
      {tasks.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No tasks saved" body="Ask: Save a task to review this tomorrow." />
      ) : (
        tasks.map((task) => (
          <div className="rounded-lg border border-ink/10 bg-white p-4" key={task.id}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-moss" />
              <Badge tone="green">{task.status}</Badge>
            </div>
            <h3 className="mt-4 font-semibold">{task.title}</h3>
            {task.description ? <p className="mt-2 text-sm leading-6 text-ink/65">{task.description}</p> : null}
            <p className="mt-3 text-xs text-ink/45">{formatTime(task.createdAt)}</p>
          </div>
        ))
      )}
    </PanelGrid>
  );
}

function RetrievalPanel({ retrieval }: { retrieval: RetrievalDebugChunkDto[] }): React.JSX.Element {
  return (
    <PanelList>
      {retrieval.length === 0 ? (
        <EmptyState icon={BrainCircuit} title="No retrieval debug yet" body="Ask a document question to inspect chunks." />
      ) : (
        retrieval.map((chunk) => (
          <div className="rounded-lg border border-ink/10 bg-white p-4" key={chunk.chunkId}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">{chunk.documentName}</h3>
              <Badge tone="blue">{Math.round(chunk.similarity * 100)}% similar</Badge>
            </div>
            <p className="mt-2 text-xs text-ink/45">
              Chunk {chunk.chunkIndex + 1}
              {chunk.section ? ` - ${chunk.section}` : ''}
            </p>
            <p className="mt-3 text-sm leading-6 text-ink/70">{chunk.preview}</p>
          </div>
        ))
      )}
    </PanelList>
  );
}

function PanelGrid({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

function PanelList({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="space-y-4">{children}</div>;
}

function EmptyState({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}): React.JSX.Element {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center rounded-lg border border-dashed border-ink/15 bg-white/70 p-8 text-center">
      <Icon className="h-8 w-8 text-ink/35" />
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-ink/55">{body}</p>
    </div>
  );
}

async function readSse(response: Response, onEvent: (event: unknown) => void): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    return;
  }
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';
    for (const frame of frames) {
      const line = frame
        .split('\n')
        .map((item) => item.trim())
        .find((item) => item.startsWith('data:'));
      if (!line) {
        continue;
      }
      onEvent(JSON.parse(line.slice('data:'.length).trim()) as unknown);
    }
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong.';
}
