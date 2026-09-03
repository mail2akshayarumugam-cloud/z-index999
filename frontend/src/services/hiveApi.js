import { apiPost } from './api';

export function analyzeMessage({ message, user_id, sender, source }) {
  return apiPost('/api/hive/analyze', {
    message,
    user_id: user_id || 'user-arjun',
    sender: sender || null,
    source: source || 'whatsapp',
  });
}
