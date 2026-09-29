import test from 'node:test';
import assert from 'node:assert/strict';
import { metricSummary, proposalSummary, reviewStateFor } from './home-inputs.ts';
import type { WeeklyReview } from '../delivery/types.ts';

const ws = 'ws-1';
const section = (over: Partial<WeeklyReview['sections'][number]>): WeeklyReview['sections'][number] => ({ initiativeId: 'i', ownerMemberId: null, revision: 1, headline: '', updates: '', attention: '', decisionNeeded: '', nextMilestone: '', nextStep: '', sourceDigest: 'd', needsRecheck: false, editedByMemberId: null, editedAt: null, aiOriginal: null, ...over });
const review = (week: string, status: 'DRAFT' | 'FINAL', sections: WeeklyReview['sections']): WeeklyReview => ({ id: week, workspaceId: ws, week, status, revision: 1, baselineReviewId: null, input: {} as WeeklyReview['input'], sections, aiDrafts: [], createdAt: '', createdByMemberId: null, finalizedAt: null, finalizedByMemberId: null, finalizedByLabel: null });

test('a Draft reports how many sections still need review and whether the week has started', () => {
  const r = review('2026-W39', 'DRAFT', [section({ initiativeId: 'a', editedByMemberId: 'm' }), section({ initiativeId: 'b' }), section({ initiativeId: 'c', editedByMemberId: 'm', needsRecheck: true })]);
  const out = reviewStateFor({ reviews: [r], workspaceId: ws, week: '2026-W39', now: '2026-09-29T10:00:00Z' });
  assert.equal(out.status, 'DRAFT'); assert.equal(out.pending, 2); assert.equal(out.total, 3); assert.equal(out.started, true); assert.equal(out.next, null);
});

test('a Final knows whether the next week has started and whether it already exists', () => {
  const reviews = [review('2026-W39', 'FINAL', [])];
  const out = reviewStateFor({ reviews, workspaceId: ws, week: '2026-W39', now: '2026-09-29T10:00:00Z' });
  assert.deepEqual(out.next, { week: '2026-W40', started: true, exists: false });
  const later = reviewStateFor({ reviews: [...reviews, review('2026-W40', 'DRAFT', [])], workspaceId: ws, week: '2026-W39', now: '2026-09-29T10:00:00Z' });
  assert.equal(later.next?.exists, true);
});

test('no review is NONE, and another workspace’s review never counts', () => {
  const out = reviewStateFor({ reviews: [{ ...review('2026-W40', 'DRAFT', [section({})]), workspaceId: 'other' }], workspaceId: ws, week: '2026-W40', now: '2026-09-29T10:00:00Z' });
  assert.equal(out.status, 'NONE'); assert.equal(out.total, 0);
  assert.equal(reviewStateFor({ reviews: [], workspaceId: ws, week: '2026-W41', now: '2026-09-29T10:00:00Z' }).started, false);
});

test('proposal summary counts only pending proposals of that initiative and names the source with most of them', () => {
  const out = proposalSummary('i1', {
    proposals: [
      { initiativeId: 'i1', status: 'PENDING', submissionId: 's1' }, { initiativeId: 'i1', status: 'PENDING', submissionId: 's2' }, { initiativeId: 'i1', status: 'PENDING', submissionId: 's2' },
      { initiativeId: 'i1', status: 'CONFIRMED', submissionId: 's1' }, { initiativeId: 'i2', status: 'PENDING', submissionId: 's3' },
    ],
    submissions: [{ id: 's1', title: 'Kick-off notes' }, { id: 's2', title: 'Grooming notes' }],
  });
  assert.deepEqual(out, { initiativeId: 'i1', pending: 3, sourceTitle: 'Grooming notes' });
  assert.deepEqual(proposalSummary('i9', { proposals: [], submissions: [] }), { initiativeId: 'i9', pending: 0, sourceTitle: null });
});

test('metric summary is one row per initiative, zero when nothing is defined', () => {
  assert.deepEqual(metricSummary([{ initiativeId: 'a' }, { initiativeId: 'a' }], ['a', 'b']), [{ initiativeId: 'a', configured: 2 }, { initiativeId: 'b', configured: 0 }]);
});
