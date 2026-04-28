import { api } from '@/services/api';

export interface BiosCheckResult {
  available: boolean;
  linked_username: string | null;
  is_blacklisted: boolean;
  message: string;
}

export interface UsernameCheckResult {
  available: boolean;
  linked_bios: string | null;
  message: string;
}

export const availabilityService = {
  checkBios: async (biosId: string): Promise<BiosCheckResult> => {
    const response = await api.get<BiosCheckResult>('/check-bios', {
      params: { bios_id: biosId },
    });
    return response.data;
  },

  checkUsername: async (username: string): Promise<UsernameCheckResult> => {
    const response = await api.get<UsernameCheckResult>('/check-username', {
      params: { username },
    });
    return response.data;
  },
};
