import { apiPost } from './api';

export function previewTransaction({ user_id, beneficiary_upi, amount, description, device_id }) {
  return apiPost('/api/transactions/preview', {
    user_id,
    beneficiary_upi,
    amount,
    description: description || null,
    device_id: device_id || null,
  });
}

export function commitTransaction({ transaction_id, user_id, override_reason }) {
  return apiPost('/api/transactions/commit', {
    transaction_id,
    user_id,
    override_reason: override_reason || null,
  });
}
