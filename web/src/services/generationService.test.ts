import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getInstitutionalPolicies, getPolicyValue, getPoliciesAsRecord } from './generationService';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('generationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getInstitutionalPolicies', () => {
    it('should fetch all active institutional policies', async () => {
      const mockPolicies = [
        { id: '1', policy_key: 'max_teaching_hours', policy_value: '40', description: 'Max teaching hours per week', is_active: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: '2', policy_key: 'min_room_utilization', policy_value: '0.7', description: 'Minimum room utilization', is_active: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase mock requires any type
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: mockPolicies, error: null }),
        }),
      } as any);

      const result = await getInstitutionalPolicies();
      expect(result).toEqual(mockPolicies);
      expect(supabase.from).toHaveBeenCalledWith('institutional_policies');
    });

    it('should return empty array if no policies found', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase mock requires any type
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      } as any);

      const result = await getInstitutionalPolicies();
      expect(result).toEqual([]);
    });

    it('should throw error if query fails', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase mock requires any type
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: new Error('Database error') }),
        }),
      } as any);

      await expect(getInstitutionalPolicies()).rejects.toThrow('Database error');
    });
  });

  describe('getPolicyValue', () => {
    it('should fetch a specific policy value by key', async () => {
      const mockPolicy = { policy_value: '40' };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase mock requires any type
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockPolicy, error: null }),
            }),
          }),
        }),
      } as any);

      const result = await getPolicyValue('max_teaching_hours');
      expect(result).toEqual('40');
    });

    it('should return null if policy not found', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase mock requires any type
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
            }),
          }),
        }),
      } as any);

      const result = await getPolicyValue('nonexistent_policy');
      expect(result).toBeNull();
    });

    it('should throw error if query fails for other reasons', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase mock requires any type
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: new Error('Database error') }),
            }),
          }),
        }),
      } as any);

      await expect(getPolicyValue('max_teaching_hours')).rejects.toThrow('Database error');
    });
  });

  describe('getPoliciesAsRecord', () => {
    it('should fetch policies as a key-value record', async () => {
      const mockPolicies = [
        { id: '1', policy_key: 'max_teaching_hours', policy_value: '40', description: 'Max teaching hours per week', is_active: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: '2', policy_key: 'min_room_utilization', policy_value: '0.7', description: 'Minimum room utilization', is_active: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase mock requires any type
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: mockPolicies, error: null }),
        }),
      } as any);

      const result = await getPoliciesAsRecord();
      expect(result).toEqual({
        max_teaching_hours: '40',
        min_room_utilization: '0.7',
      });
    });

    it('should return empty object if no policies found', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase mock requires any type
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      } as any);

      const result = await getPoliciesAsRecord();
      expect(result).toEqual({});
    });
  });
});
