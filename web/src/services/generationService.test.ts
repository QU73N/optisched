import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSystemRules, getRuleValue, getRulesAsRecord } from './generationService';
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

  describe('getSystemRules', () => {
    it('should fetch all system rules', async () => {
      const mockRules = [
        { id: '1', rule_key: 'max_teaching_hours', rule_value: '40', description: 'Max teaching hours per week', category: 'general', role_overrides: {}, updated_at: '2024-01-01' },
        { id: '2', rule_key: 'min_room_utilization', rule_value: '0.7', description: 'Minimum room utilization', category: 'general', role_overrides: {}, updated_at: '2024-01-01' },
      ];

      const mockSelect = vi.fn().mockResolvedValue({ data: mockRules, error: null });
      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any); // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase mock requires any type

      const result = await getSystemRules();
      expect(result).toEqual(mockRules);
      expect(supabase.from).toHaveBeenCalledWith('system_rules');
    });

    it('should return empty array if no rules found', async () => {
      const mockSelect = vi.fn().mockResolvedValue({ data: null, error: null });
      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any); // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase mock requires any type

      const result = await getSystemRules();
      expect(result).toEqual([]);
    });

    it('should throw error if query fails', async () => {
      const mockSelect = vi.fn().mockResolvedValue({ data: null, error: new Error('Database error') });
      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any); // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase mock requires any type

      await expect(getSystemRules()).rejects.toThrow('Database error');
    });
  });

  describe('getRuleValue', () => {
    it('should fetch a specific rule value by key', async () => {
      const mockRule = { rule_value: '40' };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockRule, error: null }),
          }),
        }),
      } as any); // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase mock requires any type

      const result = await getRuleValue('max_teaching_hours');
      expect(result).toEqual('40');
    });

    it('should return null if rule not found', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
          }),
        }),
      } as any); // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase mock requires any type

      const result = await getRuleValue('nonexistent_rule');
      expect(result).toBeNull();
    });

    it('should throw error if query fails for other reasons', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: new Error('Database error') }),
          }),
        }),
      } as any); // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase mock requires any type

      await expect(getRuleValue('max_teaching_hours')).rejects.toThrow('Database error');
    });
  });

  describe('getRulesAsRecord', () => {
    it('should fetch rules as a key-value record', async () => {
      const mockRules = [
        { id: '1', rule_key: 'max_teaching_hours', rule_value: '40', description: 'Max teaching hours per week', category: 'general', role_overrides: {}, updated_at: '2024-01-01' },
        { id: '2', rule_key: 'min_room_utilization', rule_value: '0.7', description: 'Minimum room utilization', category: 'general', role_overrides: {}, updated_at: '2024-01-01' },
      ];

      const mockSelect = vi.fn().mockResolvedValue({ data: mockRules, error: null });
      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any); // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase mock requires any type

      const result = await getRulesAsRecord();
      expect(result).toEqual({
        max_teaching_hours: '40',
        min_room_utilization: '0.7',
      });
    });

    it('should return empty object if no rules found', async () => {
      const mockSelect = vi.fn().mockResolvedValue({ data: null, error: null });
      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any); // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase mock requires any type

      const result = await getRulesAsRecord();
      expect(result).toEqual({});
    });
  });
});
