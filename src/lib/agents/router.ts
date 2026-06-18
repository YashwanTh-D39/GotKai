import type { AgentType } from "./config";

const CODE_PATTERNS = [
  /\b(code|program|script|function|class|method|api|sdk|library)\b/i,
  /\b(write|create|implement|build|develop|refactor|debug|fix|compile)\b.*\b(code|app|program|script|function)\b/i,
  /\b(javascript|typescript|python|java|rust|go|ruby|php|c\+\+|swift|kotlin)\b/i,
  /\b(react|vue|angular|next\.?js|node|django|flask|spring|rails|express)\b/i,
  /\b(error|bug|exception|crash|stack.?trace|syntax|undefined|null|undefined)\b/i,
  /\b(algorithm|data.?structure|leetcode|hackerrank)\b/i,
  /\b(sql|query|database|schema|table|index|migration)\b/i,
  /\b(regex|regular expression|parsing|serialize|deserialize)\b/i,
  /\b(bash|shell|terminal|command.?line|cli)\b/i,
  /\b(docker|kubernetes|k8s|deploy|ci\/cd|pipeline)\b/i,
  /\b(git|commit|branch|merge|pull.?request|pr)\b/i,
  /\b(review|refactor|optimize|performance|memory.?leak)\b/i,
];

const RESEARCH_PATTERNS = [
  /\b(research|study|paper|article|journal|publication)\b/i,
  /\b(what.?is|who.?is|where.?is|when.?was|how.?does)\b.*\b(the|a|an)\b/i,
  /\b(facts?|evidence|data|statistics|findings|analysis)\b/i,
  /\b(compare|contrast|difference|similarities|versus|vs)\b/i,
  /\b(history|background|origin|timeline|evolution)\b/i,
  /\b(define|explain|describe|elaborate|clarify)\b/i,
  /\b(sources?|references?|citations?|bibliography)\b/i,
  /\b(latest|recent|current|trending|news|update)\b/i,
  /\b(scientific|academic|scholarly|peer.?reviewed)\b/i,
  /\b(survey|overview|comprehensive|in.?depth)\b/i,
  /\b(why|how)\s+(do|does|did|is|are|was|were)\b/i,
];

const WRITING_PATTERNS = [
  /\b(write|draft|compose|author|pen|craft)\b.*\b(essay|article|blog|post|story|poem|letter|email)\b/i,
  /\b(edit|proofread|rewrite|revise|polish|refine)\b/i,
  /\b(creative|story|novel|fiction|narrative|plot|character|dialogue)\b/i,
  /\b(blog|article|newsletter|post|content|copy)\b/i,
  /\b(essay|thesis|paper|report|memo|brief|proposal)\b/i,
  /\b(poem|poetry|lyrics|script|screenplay|dialogue)\b/i,
  /\b(email|letter|memo|press.?release|announcement)\b/i,
  /\b(tone|voice|audience|style|grammar|vocabulary)\b/i,
  /\b(outline|structure|format|template|framework)\b/i,
  /\b(resume|cv|cover.?letter|personal.?statement)\b/i,
  /\b(headline|title|slogan|tagline|caption)\b/i,
  /\b(translate|localize|adapt)\b.*\b(from|to)\b/i,
  /\b(persuasive|argumentative|descriptive|narrative|expository)\b/i,
  /\b(brainstorm|idea|concept|theme|message)\b/i,
];

export function routeUserIntent(message: string): AgentType {
  const text = message.trim();
  if (!text) return "reasoning";

  let codeScore = 0;
  let researchScore = 0;
  let writingScore = 0;

  for (const p of CODE_PATTERNS) {
    if (p.test(text)) codeScore += 2;
  }
  for (const p of RESEARCH_PATTERNS) {
    if (p.test(text)) researchScore += 1;
  }
  for (const p of WRITING_PATTERNS) {
    if (p.test(text)) writingScore += 1;
  }

  // Bonus: very short questions are likely research/reasoning
  const wordCount = text.split(/\s+/).length;
  if (wordCount < 5) {
    researchScore += 2;
  }

  // Penalty: code patterns dominate writing/research
  if (codeScore > 3) {
    researchScore = Math.floor(researchScore / 2);
    writingScore = Math.floor(writingScore / 2);
  }

  const max = Math.max(codeScore, researchScore, writingScore);
  if (max === 0) return "reasoning";

  if (codeScore === max && codeScore >= 2) return "code";
  if (researchScore === max && researchScore >= 2) return "research";
  if (writingScore === max && writingScore >= 2) return "writing";

  return "reasoning";
}

// For agent info display in the UI
export function getRouteReason(message: string): { agent: AgentType; confidence: string } {
  const agent = routeUserIntent(message);
  if (agent === "reasoning") return { agent, confidence: "default" };
  const scores = { code: 0, research: 0, writing: 0, reasoning: 0 };
  for (const p of CODE_PATTERNS) { if (p.test(message)) scores.code += 2; }
  for (const p of RESEARCH_PATTERNS) { if (p.test(message)) scores.research += 1; }
  for (const p of WRITING_PATTERNS) { if (p.test(message)) scores.writing += 1; }

  const maxScore = Math.max(scores.code, scores.research, scores.writing);
  const confidence = maxScore >= 6 ? "high" : maxScore >= 3 ? "medium" : "low";
  return { agent, confidence };
}
