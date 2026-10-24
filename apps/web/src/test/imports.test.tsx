import { fireEvent, render, screen } from '@testing-library/react';
import { HashRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { ImportCenter, RecordList, displayPence } from '../ImportCenter';
import { ApiError } from '../auth';
const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../auth', async importOriginal => ({ ...await importOriginal<typeof import('../auth')>(), useAuth: () => ({ request }) }));
beforeEach(() => {
  request.mockReset();
  request.mockImplementation(async (path: string) => path === '/bank-accounts' ? { accounts: [] } : { records: [], hasMore: false, page: 1 });
});
it('formats string pence without unsafe Number conversions', () => {
  expect(displayPence('9007199254740993')).toBe('£90071992547409.93');
});
it('makes the first import action and samples available with an empty history', async () => {
  render(<HashRouter><ImportCenter /></HashRouter>);
  expect(await screen.findByText('No imports yet. Start with your invoice CSV above.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Import invoices' })).toBeEnabled();
  expect(screen.getByRole('link', { name: 'Download sample invoices CSV' })).toHaveAttribute('download');
});
it('rejects oversized file selections before uploading', async () => {
  render(<HashRouter><ImportCenter /></HashRouter>);
  const file = new File(['a'.repeat(1024 * 1024 + 1)], 'large.csv', { type: 'text/csv' });
  fireEvent.change(screen.getByLabelText('CSV file'), { target: { files: [file] } });
  fireEvent.submit(screen.getByRole('button', { name: 'Import invoices' }).closest('form')!);
  expect(await screen.findByRole('alert')).toHaveTextContent('The file exceeds 1 MiB');
  expect(request.mock.calls.some(call => call[1]?.method === 'POST')).toBe(false);
});
it('shows server row errors and zero inserts from a rejected import', async () => {
  request.mockImplementation(async (path: string, options?: RequestInit) => {
    if (options?.method === 'POST') throw new ApiError(422, 'Correct the file', { batchId: 'test', status: 'rejected', rowCount: 1, insertedCount: 0, duplicateCount: 0, reviewCount: 0, repeatedFile: false, errors: [{ row: 2, field: 'currency', message: 'Only GBP is supported.' }] });
    return path === '/bank-accounts' ? { accounts: [] } : { records: [], hasMore: false, page: 1 };
  });
  render(<HashRouter><ImportCenter /></HashRouter>);
  fireEvent.change(screen.getByLabelText('CSV file'), { target: { files: [new File(['bad'], 'invalid.csv', { type: 'text/csv' })] } });
  fireEvent.submit(screen.getByRole('button', { name: 'Import invoices' }).closest('form')!);
  expect(await screen.findByRole('heading', { name: 'Correct your file and try again' })).toBeInTheDocument();
  expect(screen.getByText('Row 2 · currency: Only GBP is supported.')).toBeInTheDocument();
});
it('offers recovery when record loading fails', async () => {
  request.mockRejectedValueOnce(Error('Connection unavailable')).mockResolvedValue({ records: [], page: 1, hasMore: false });
  render(<HashRouter><RecordList kind="invoices" /></HashRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('No records yet. Import a CSV to get started.')).toBeInTheDocument();
});
