export type CandidateRange = { start: string; end: string };
export type EAContact = { email: string; execName: string };

export type Window = {
  candidateName: string;
  title: string;
  candidateRanges: CandidateRange[];
  eaDirectory: EAContact[];
  id: string;
  createdAt?: string;
};

export type EaRange = { start: string; end: string };

export type EaSubmission = {
  execName: string;
  ranges: EaRange[];
  at: string;
};

export const db = {
  window: null as Window | null,
  submissions: [] as EaSubmission[],
};

export function makeId() {
  return Math.random().toString(36).slice(2,10);
}
