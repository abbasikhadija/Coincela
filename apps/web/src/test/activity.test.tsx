import { fireEvent, render, screen } from '@testing-library/react';
import { HashRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { Activity } from '../Activity';
const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../auth', () => ({ useAuth: () => ({ request }) }));
const event = { id: 'event', operationId: 'operation', eventType: 'payment_allocated', amountPence: '10000', createdAt: '2026-10-24T10:00:00Z', actorEmail: 'synthetic@example.test' };
const row = { id: 'allocation', operation_id: 'operation', bank_transaction_id: 'payment', invoice_id: 'invoice', amount_pence: '10000', invoice_number: 'INV-1', customer_name: 'Amber', reversal_id: null, reversal_operation_id: null, reversal_reason: null, reversed_at: null, invoice: { total_pence: '10000', outstanding_pence: '0' } };
const detail = { event, payment: { id: 'payment', amount_pence: '10000', unallocated_pence: '0', payer_name: 'Amber', payment_reference: 'INV-1', description: 'Test transfer' }, allocations: [row], timeline: [event] };
beforeEach(() => { request.mockReset(); window.location.hash = '#/activity'; });
function show() { return render(<HashRouter><Activity /></HashRouter>); }
it('explains an empty history and recovers a list failure', async () => {
  request.mockRejectedValueOnce(Error('Connection unavailable')).mockResolvedValue({ events: [], hasMore: false }); show();
  fireEvent.click(await screen.findByRole('button', { name: 'Retry activity' }));
  expect(await screen.findByText(/No financial activity yet/)).toBeInTheDocument(); expect(screen.getByRole('link', { name: 'Review payments' })).toBeInTheDocument();
});
it('shows allocation identity, current amounts, actor and timeline with a separate reversal review', async () => {
  request.mockImplementation(async (path: string) => path.includes('?page=') ? { events: [event], hasMore: false } : detail); show();
  fireEvent.click(await screen.findByRole('button', { name: /Payment allocated · £100.00/ }));
  expect(await screen.findByRole('heading', { name: 'INV-1 · Amber' })).toBeInTheDocument();
  expect(screen.getByText('Active allocation')).toBeInTheDocument(); expect(screen.getByRole('heading', { name: 'Related audit timeline' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Review reversal for INV-1' })).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Confirm reversal' })).not.toBeInTheDocument();
  expect(window.location.hash).toContain('operation=operation');
});
it('keeps reversed allocations visible with reason and original/reversal links', async () => {
  window.location.hash = '#/activity?operation=operation';
  request.mockImplementation(async (path: string) => path.includes('?page=') ? { events: [event], hasMore: false } : { ...detail, allocations: [{ ...row, reversal_id: 'reversal', reversal_operation_id: 'reversal-operation', reversal_reason: 'Wrong invoice', reversed_at: '2026-10-24T11:00:00Z' }] }); show();
  expect(await screen.findByText('Reversed allocation')).toBeInTheDocument(); expect(screen.getByText('Reversal reason: Wrong invoice')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Review reversal for INV-1' })).not.toBeInTheDocument(); expect(screen.getByRole('link', { name: 'View reversal event' })).toBeInTheDocument();
});
