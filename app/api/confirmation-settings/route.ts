import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate, isAuthError } from '@/lib/auth';
import { success, handleError, NotFoundError } from '@/lib/api-utils';
import { updateConfirmationSettingsSchema } from '@/lib/validators';
import {
  DEFAULT_LEAD_TIME_HOURS,
  DEFAULT_TEMPLATES,
  normalizeTemplates,
  type ConfirmationSettingsData,
} from '@/lib/confirmations';

// GET /api/confirmation-settings - Retorna a configuracao do fluxo de confirmacao
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    if (!authResult.establishmentId) {
      throw new NotFoundError('Estabelecimento');
    }

    const settings = await prisma.confirmationSettings.findUnique({
      where: { establishmentId: authResult.establishmentId },
    });

    const data: ConfirmationSettingsData = {
      enabled: settings?.enabled ?? false,
      leadTimeHours: settings?.leadTimeHours ?? DEFAULT_LEAD_TIME_HOURS,
      templates: settings ? normalizeTemplates(settings.templates) : { ...DEFAULT_TEMPLATES },
    };

    return success(data);
  } catch (error) {
    return handleError(error);
  }
}

// PUT /api/confirmation-settings - Salva a configuracao do fluxo de confirmacao
export async function PUT(request: NextRequest) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    if (!authResult.establishmentId) {
      throw new NotFoundError('Estabelecimento');
    }

    const body = await request.json();
    const input = updateConfirmationSettingsSchema.parse(body);

    // Carrega config atual para fazer merge dos templates parciais
    const existing = await prisma.confirmationSettings.findUnique({
      where: { establishmentId: authResult.establishmentId },
    });

    const currentTemplates = existing
      ? normalizeTemplates(existing.templates)
      : { ...DEFAULT_TEMPLATES };

    const mergedTemplates = {
      ...currentTemplates,
      ...(input.templates ?? {}),
    };

    const enabled = input.enabled ?? existing?.enabled ?? false;
    const leadTimeHours = input.leadTimeHours ?? existing?.leadTimeHours ?? DEFAULT_LEAD_TIME_HOURS;

    const saved = await prisma.confirmationSettings.upsert({
      where: { establishmentId: authResult.establishmentId },
      create: {
        establishmentId: authResult.establishmentId,
        enabled,
        leadTimeHours,
        templates: mergedTemplates,
      },
      update: {
        enabled,
        leadTimeHours,
        templates: mergedTemplates,
      },
    });

    const data: ConfirmationSettingsData = {
      enabled: saved.enabled,
      leadTimeHours: saved.leadTimeHours,
      templates: normalizeTemplates(saved.templates),
    };

    return success(data);
  } catch (error) {
    return handleError(error);
  }
}
