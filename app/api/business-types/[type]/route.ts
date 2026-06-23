import { NextRequest } from 'next/server';
import { success, handleError, ApiError } from '@/lib/api-utils';
import { getBusinessConfig, isValidBusinessType } from '@/config/business-types';

// GET /api/business-types/[type] - Config pública completa de um nicho
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params;
    const upper = type?.toUpperCase();

    if (!isValidBusinessType(upper)) {
      throw new ApiError('Nicho inválido', 404);
    }

    return success({ config: getBusinessConfig(upper) });
  } catch (error) {
    return handleError(error);
  }
}
