import { apiPost, apiGet } from './api';

export function evaluateRisk({ user_id, beneficiary_upi, amount, device_id }) {
  return apiPost('/api/risk/evaluate', {
    user_id,
    beneficiary_upi,
    amount,
    device_id: device_id || null,
  });
}

export function getHiveSignals(user_id, hours = 72) {
  return apiGet(`/api/risk/signals/${encodeURIComponent(user_id)}?hours=${hours}`);
}

export function checkUpiSignals(upi_id) {
  return apiGet(`/api/risk/signals/upi/${encodeURIComponent(upi_id)}`);
}
