import { fireEvent, render, screen } from '@testing-library/react';
import { HashRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { ReviewPayments } from '../ReviewPayments';
const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../auth', () => ({ useAuth: () => ({ request }) }));
const payment = { id: 'payment-1', transaction_date: '2026-10-10', description: 'Synthetic payment', amount_pence: '10000', unallocated_pence: '10000', payer_name: 'Synthetic Customer', payment_reference: 'INV-1', requires_duplicate_review: false };
const candidate = { id: 'suggestion-1', suggestedPence: '10000', category: 'ambiguous', reviewStatus: 'pending', evidence: ['The amount equals the outstanding balance.'], warnings: ['Check the customer and reference.'], explanation: 'Only the amount supports this candidate.', invoice: { id: 'invoice-1', invoice_number: 'INV-1', customer_name: 'Synthetic Customer', total_pence: '15000', outstanding_pence: '10000', issue_date: '2026-10-01', due_date: '2026-10-31' } };
const detail = { payment, state: 'current', result: { id: 'run-1', outcome: 'ambiguous', explanation: 'Several invoices could match this payment.', warnings: ['This payment may be a duplicate.'], candidates: [candidate] } };
beforeEach(() => { request.mockReset(); window.location.hash = '#/review'; });
function renderReview() { return render(<HashRouter><ReviewPayments /></HashRouter>); }
it('shows an understandable empty workspace and import action', async () => {
  request.mockResolvedValue({ payments: [], hasMore: false }); renderReview();
  expect(await screen.findByText(/No payments imported yet/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Import payments' })).toBeInTheDocument();
});
it('shows financial amounts, evidence, ambiguity and unconfirmed status without confirmation controls', async () => {
  request.mockImplementation(async (path: string) => path.includes('?page=') ? { payments: [payment], hasMore: false } : detail);
  renderReview(); fireEvent.click(await screen.findByRole('button', { name: /Synthetic Customer/ }));
  expect(await screen.findByRole('heading', { name: 'Ambiguous' })).toBeInTheDocument();
  expect(screen.getByText('Ambiguous · Unconfirmed suggestion')).toBeInTheDocument();
  expect(screen.getByText('The amount equals the outstanding balance.')).toBeInTheDocument();
  expect(screen.getByText('Check the customer and reference.')).toBeInTheDocument();
  expect(screen.getByText('£150.00')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /confirm|allocate/i })).not.toBeInTheDocument();
  expect(window.location.hash).toContain('payment=payment-1');
});
it('hides stale candidates and offers regeneration', async () => {
  window.location.hash = '#/review?payment=payment-1';
  request.mockImplementation(async (path: string, init?: RequestInit) => path.includes('?page=') ? { payments: [payment], hasMore: false } : init?.method === 'POST' ? detail : { payment, state: 'stale', result: null });
  renderReview();
  fireEvent.click(await screen.findByRole('button', { name: 'Regenerate suggestions' }));
  expect(await screen.findByRole('heading', { name: 'Ambiguous' })).toBeInTheDocument();
  expect(request.mock.calls.some(call => call[0] === '/matching/payments/payment-1' && call[1]?.method === 'POST')).toBe(true);
});
it('rejects a suggestion and displays its review status', async () => {
  window.location.hash = '#/review?payment=payment-1'; let rejected = false;
  request.mockImplementation(async (path: string) => {
    if (path.includes('?page=')) return { payments: [payment], hasMore: false };
    if (path.endsWith('/reject')) { rejected = true; return { reviewStatus: 'rejected' }; }
    return { ...detail, result: { ...detail.result, candidates: [{ ...candidate, reviewStatus: rejected ? 'rejected' : 'pending' }] } };
  });
  renderReview(); fireEvent.click(await screen.findByRole('button', { name: 'Reject suggestion for INV-1' }));
  expect(await screen.findByText('Ambiguous · Rejected suggestion')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Reject suggestion for INV-1' })).not.toBeInTheDocument();
});
it('recovers from payment-list network failure', async () => {
  request.mockRejectedValueOnce(Error('Connection unavailable')).mockResolvedValue({ payments: [], hasMore: false });
  renderReview(); fireEvent.click(await screen.findByRole('button', { name: 'Retry payments' }));
  expect(await screen.findByText(/No payments imported yet/)).toBeInTheDocument();
});
it('explains unmatched results and never presents them as allocations', async () => {
  window.location.hash = '#/review?payment=payment-1';
  request.mockImplementation(async (path: string) => path.includes('?page=') ? { payments: [payment], hasMore: false } : { ...detail, result: { ...detail.result, outcome: 'no_match', candidates: [], warnings: [], explanation: 'No supported candidate was found.' } });
  renderReview(); expect(await screen.findByRole('heading', { name: 'No match' })).toBeInTheDocument();
  expect(screen.getByText('No supported candidate was found.')).toBeInTheDocument();
  expect(screen.getByText('Suggestions only — no money has been allocated.')).toBeInTheDocument();
});
