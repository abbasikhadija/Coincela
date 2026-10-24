import { fireEvent, render, screen } from '@testing-library/react';
import { HashRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { ReversalForm } from '../ReversalForm';
const { request, completed, close } = vi.hoisted(() => ({ request: vi.fn(), completed: vi.fn(), close: vi.fn() }));
vi.mock('../auth', async importOriginal => ({ ...await importOriginal<typeof import('../auth')>(), useAuth: () => ({ request, session: { workspace: { id: 'workspace' } } }) }));
const preview = { allocation: { id: 'allocation', amount_pence: '6000', invoice_number: 'INV-1', customer_name: 'Amber', reversal_id: null }, payment: { description: 'Test transfer', payer_name: 'Amber', payment_reference: 'INV-1', amount_pence: '10000', unallocated_pence: '1000' }, invoice: { total_pence: '10000', outstanding_pence: '4000' } };
const receipt = { operationId: 'operation', restoredPence: '6000', paymentUnallocatedPence: '7000', invoiceOutstandingPence: '10000', reason: 'Wrong invoice selected' };
beforeEach(() => { sessionStorage.clear(); request.mockReset(); completed.mockReset(); close.mockReset(); });
function show() { return render(<HashRouter><ReversalForm allocationId="allocation" close={close} completed={completed} /></HashRouter>); }
it('shows restored balances, keeps confirmation disabled without reason/acknowledgment and resets it on edit', async () => {
  request.mockResolvedValue(preview); show();
  expect(await screen.findByText('Payment unallocated after reversal: £70.00')).toBeInTheDocument(); expect(screen.getByText('Invoice outstanding after reversal: £100.00')).toBeInTheDocument();
  const confirm = screen.getByRole('button', { name: 'Confirm reversal' }); expect(confirm).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Reason for reversal'), { target: { value: 'Wrong invoice' } }); fireEvent.click(screen.getByRole('checkbox')); expect(confirm).toBeEnabled();
  fireEvent.change(screen.getByLabelText('Reason for reversal'), { target: { value: 'Another reason' } }); expect(confirm).toBeDisabled(); expect(screen.getByRole('checkbox')).not.toBeChecked();
});
it('sends only the explicit reversal identity/reason and shows the confirmed outcome', async () => {
  request.mockImplementation(async (path: string) => path === '/reversals' ? receipt : preview); show();
  fireEvent.change(await screen.findByLabelText('Reason for reversal'), { target: { value: ' Wrong invoice selected ' } }); fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByRole('button', { name: 'Confirm reversal' }));
  expect(await screen.findByRole('heading', { name: 'Reversal confirmed' })).toBeInTheDocument();
  const input = JSON.parse(request.mock.calls.find(call => call[0] === '/reversals')![1].body);
  expect(input).toMatchObject({ allocationId: 'allocation', reason: 'Wrong invoice selected', confirmed: true }); expect(input).not.toHaveProperty('amountPence'); expect(completed).toHaveBeenCalledOnce();
});
it('retains uncertain reversal details across remount and retries identically even when already reversed', async () => {
  let failed = true;
  request.mockImplementation(async (path: string) => { if (path !== '/reversals') return failed ? preview : { ...preview, allocation: { ...preview.allocation, reversal_id: 'reversed' } }; if (failed) throw Error('Response lost'); return receipt; });
  const view = show(); fireEvent.change(await screen.findByLabelText('Reason for reversal'), { target: { value: 'Wrong invoice selected' } }); fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByRole('button', { name: 'Confirm reversal' }));
  await screen.findByRole('button', { name: 'Retry same reversal' }); const first = request.mock.calls.find(call => call[0] === '/reversals')![1].body;
  view.unmount(); failed = false; show(); fireEvent.click(await screen.findByRole('button', { name: 'Retry same reversal' }));
  await screen.findByRole('heading', { name: 'Reversal confirmed' }); expect(request.mock.calls.filter(call => call[0] === '/reversals').map(call => call[1].body)).toEqual([first, first]);
});
it('does not offer a second reversal when the allocation is already reversed', async () => {
  request.mockResolvedValue({ ...preview, allocation: { ...preview.allocation, reversal_id: 'reversed' } }); show();
  expect(await screen.findByText(/This allocation has already been reversed/)).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Confirm reversal' })).not.toBeInTheDocument();
});
