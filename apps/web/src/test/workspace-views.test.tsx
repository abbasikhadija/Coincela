import { fireEvent, render, screen } from '@testing-library/react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { Overview } from '../Overview';
import { RecordDetails } from '../RecordDetails';
import { Landing } from '../Landing';
const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../auth', () => ({ useAuth: () => ({ request, session: { workspace: { name: 'Test studio' } } }) }));
const empty = { invoiceCount: 0, paymentCount: 0, outstandingPence: '0', paymentsToReview: 0, unallocatedPence: '0', next: 'import_invoices', recent: [] };
beforeEach(() => { request.mockReset(); window.location.hash = '#/'; });
it('explains the product and offers real sample downloads and account actions publicly', () => {
  render(<HashRouter><Landing /></HashRouter>); expect(screen.getByRole('heading', { name: 'Every payment accounted for.' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '#/register'); expect(screen.getByRole('link', { name: 'Download sample invoices CSV' })).toHaveAttribute('download'); expect(screen.getByRole('link', { name: 'Download sample payments CSV' })).toHaveAttribute('download');
});
it('guides an empty workspace without presenting meaningless balance cards', async () => {
  request.mockResolvedValue(empty); render(<HashRouter><Overview /></HashRouter>);
  expect(await screen.findByRole('link', { name: 'Import your invoices' })).toHaveAttribute('href', '#/import'); expect(screen.queryByRole('region', { name: 'Current balances' })).not.toBeInTheDocument(); expect(screen.getByRole('list', { name: 'Reconciliation steps' })).toBeInTheDocument();
});
it('shows exact live totals and a contextual payment-import step', async () => {
  request.mockResolvedValue({ ...empty, invoiceCount: 2, outstandingPence: '18446744073709551614', next: 'import_payments' }); render(<HashRouter><Overview /></HashRouter>);
  expect(await screen.findByRole('link', { name: 'Import incoming payments' })).toHaveAttribute('href', '#/import?kind=transactions'); expect(screen.getByText('£184467440737095516.14')).toBeInTheDocument(); expect(screen.getByText('Payments requiring review')).toBeInTheDocument();
});
it('offers overview retry without showing fabricated balances', async () => {
  request.mockRejectedValueOnce(Error('Connection unavailable')).mockResolvedValue(empty); render(<HashRouter><Overview /></HashRouter>); fireEvent.click(await screen.findByRole('button', { name: 'Retry overview' })); expect(await screen.findByRole('link', { name: 'Import your invoices' })).toBeInTheDocument();
});
it('shows invoice balances, status and preserved reversed allocations with links to payment and audit', async () => {
  window.location.hash = '#/invoices/invoice-1';
  request.mockResolvedValue({ record: { id: 'invoice-1', invoice_number: 'INV-1', customer_name: 'Amber', total_pence: '10000', outstanding_pence: '4000', issue_date: '2026-10-01', due_date: '2026-10-31' }, hasMore: false, allocations: [{ id: 'a', operationId: 'op', paymentId: 'payment', invoiceId: 'invoice-1', description: 'Test transfer', amountPence: '4000', createdAt: '2026-10-24T10:00:00Z', reversalId: 'r', reversalOperationId: 'rop', reason: 'Wrong invoice' }] });
  render(<HashRouter><Routes><Route path="/invoices/:id" element={<RecordDetails kind="invoices" />} /></Routes></HashRouter>);
  expect(await screen.findByText('Part paid')).toBeInTheDocument(); expect(screen.getByText('£100.00')).toBeInTheDocument(); expect(screen.getByText('Reversal reason: Wrong invoice')).toBeInTheDocument(); expect(screen.getByRole('link', { name: 'Test transfer' })).toHaveAttribute('href', '#/transactions/payment'); expect(screen.getByRole('link', { name: 'View reversal event' })).toHaveAttribute('href', '#/activity?operation=rop');
});
it('shows a payment error and recovers to honest empty allocation history', async () => {
  window.location.hash = '#/transactions/payment-1'; request.mockRejectedValueOnce(Error('Payment not found')).mockResolvedValue({ record: { id: 'payment-1', description: 'Transfer', amount_pence: '10000', unallocated_pence: '10000', transaction_date: '2026-10-10', requires_duplicate_review: true }, accountName: 'Test account', allocations: [], hasMore: false });
  render(<HashRouter><Routes><Route path="/transactions/:id" element={<RecordDetails kind="transactions" />} /></Routes></HashRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Retry record' })); expect(await screen.findByText('Unallocated')).toBeInTheDocument(); expect(screen.getByText('Test account')).toBeInTheDocument(); expect(screen.getByText(/Possible duplicate/)).toBeInTheDocument(); expect(screen.getByRole('link', { name: 'Review this payment' })).toHaveAttribute('href', '#/review?payment=payment-1');
});
