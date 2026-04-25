import { Message, Session } from '@/types';

export function sessionToMarkdown(session: Session, messages: Message[]): string {
  const date = new Date(session.createdAt).toLocaleString();
  const lines: string[] = [
    `# ${session.title}`,
    '',
    `_Exported from Nexus AI on ${new Date().toLocaleString()}_`,
    `_Session created: ${date}_`,
    '',
    '---',
    '',
  ];

  for (const m of messages) {
    const role = m.role === 'user' ? '🧑 **You**' : m.role === 'assistant' ? '🤖 **Nexus**' : `**${m.role}**`;
    const ts = new Date(m.timestamp).toLocaleTimeString();
    lines.push(`### ${role} _(${ts})_`, '', m.content, '');

    if (m.planSnapshot) {
      lines.push('<details><summary>Plan</summary>', '');
      lines.push(`**Goal:** ${m.planSnapshot.goal}`, '');
      for (const step of m.planSnapshot.steps) {
        const mark = step.status === 'completed' ? '✅' : step.status === 'failed' ? '❌' : '⏳';
        lines.push(`- ${mark} ${step.title}`);
      }
      lines.push('', '</details>', '');
    }

    lines.push('---', '');
  }

  return lines.join('\n');
}

export function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportCurrentSession(session: Session | undefined, messages: Message[]): boolean {
  if (!session || messages.length === 0) return false;
  const md = sessionToMarkdown(session, messages);
  const safe = session.title.replace(/[^a-z0-9-_]+/gi, '_').slice(0, 60) || 'session';
  downloadMarkdown(`nexus_${safe}.md`, md);
  return true;
}
