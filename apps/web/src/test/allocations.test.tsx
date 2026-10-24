import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { AllocationForm, amountPence } from '../AllocationForm';
const { request, completed, close } = vi.hoisted(() => ({ request: vi.fn(), completed: vi.fn(), close: vi.fn() }));
vi.mock('../auth', async importOriginal => ({ ...await importOriginal<typeof import('../auth')>(), useAuth: () => ({ request, session: { workspace: { id: 'workspace' } } }) }));
const invoice = { id: 'invoice-1', invoice_number: 'INV-1', customer_name: 'Amber', total_pence: '15000', outstanding_pence: '10000' };
const data = { payment: { id: 'payment-1', amount_pence: '12000', unallocated_pence: '12000', payer_name: 'Amber', payment_reference: 'INV-1', description: 'Test transfer', requires_duplicate_review: true }, invoices: [invoice], hasMore: false };
const receipt = { operationId: 'operation', allocatedPence: '5000', remainingPence: '7000', allocations: [{ invoiceNumber: 'INV-1', customerName: 'Amber', amountPence: '5000', remainingPence: '5000' }] };
beforeEach(() => { sessionStorage.clear(); request.mockReset(); completed.mockReset(); close.mockReset(); });
function show() { return render(<AllocationForm paymentId="payment-1" close={close} completed={completed} seed={{ invoice, suggestedPence: '5000', id: 'suggestion-1' }} />); }
it('uses exact decimal conversion and rejects malformed, zero and overflowing input', () => {
  expect(amountPence('92233720368547758.07')).toBe(9223372036854775807n);
  for (const value of ['0', '-1', '1.001', '01', '1e2', '92233720368547758.08']) expect(amountPence(value)).toBeNull();
});
it('shows consequences and duplicate risk, requires confirmation and clears it after edits', async () => {
  request.mockResolvedValue(data); show();
  expect(await screen.findByText('Possible duplicate: check the bank record before confirming.')).toBeInTheDocument();
  expect(screen.getByText('Invoice remaining after confirmation: £50.00')).toBeInTheDocument();
  expect(screen.getByText('Payment remaining after confirmation: £70.00')).toBeInTheDocument();
  const submit = screen.getByRole('button', { name: 'Confirm allocation' }); expect(submit).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox')); expect(submit).toBeEnabled();
  fireEvent.change(screen.getByLabelText('Amount for INV-1 (GBP)'), { target: { value: '150.00' } });
  expect(submit).toBeDisabled(); expect(screen.getByRole('checkbox')).not.toBeChecked(); expect(screen.getByLabelText('Amount for INV-1 (GBP)')).toHaveAttribute('aria-invalid', 'true');
});
it('sends explicit string pence and suggestion identity only after confirmation, then displays receipt', async () => {
  request.mockImplementation(async (path: string) => path === '/allocations' ? receipt : data); show();
  await screen.findByRole('checkbox'); fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByRole('button', { name: 'Confirm allocation' }));
  expect(await screen.findByRole('heading', { name: 'Allocation confirmed' })).toBeInTheDocument();
  const body = JSON.parse(request.mock.calls.find(call => call[0] === '/allocations')![1].body);
  expect(body).toMatchObject({ confirmed: true, paymentId: 'payment-1', allocations: [{ invoiceId: 'invoice-1', amountPence: '5000', suggestionId: 'suggestion-1' }] });
  expect(body.operationKey).toMatch(/^[a-f0-9-]{36}$/); expect(completed).toHaveBeenCalledOnce();
  expect(sessionStorage.getItem('coincela.allocation.workspace.payment-1')).toBeNull();
});
it('preserves an unknown result across remount and retries exactly the same confirmation', async () => {
  let fail = true;
  request.mockImplementation(async (path: string) => { if (path !== '/allocations') return data; if (fail) throw Error('Connection lost'); return receipt; });
  const view = show(); await screen.findByRole('checkbox'); fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByRole('button', { name: 'Confirm allocation' }));
  await screen.findByRole('button', { name: 'Retry same confirmation' });
  const first = request.mock.calls.find(call => call[0] === '/allocations')![1].body;
  view.unmount(); fail = false; show(); fireEvent.click(await screen.findByRole('button', { name: 'Retry same confirmation' }));
  await screen.findByRole('heading', { name: 'Allocation confirmed' });
  await waitFor(() => expect(request.mock.calls.filter(call => call[0] === '/allocations').map(call => call[1].body)).toEqual([first, first]));
});
