import { success, handleError } from '@/lib/api-utils';
import { getBusinessTypeOptions } from '@/config/business-types';

// GET /api/business-types - Lista todos os nichos disponíveis (público, estático)
export async function GET() {
  try {
    return success({ businessTypes: getBusinessTypeOptions() });
  } catch (error) {
    return handleError(error);
  }
}
