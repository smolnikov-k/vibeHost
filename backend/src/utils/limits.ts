import { Plan } from '@prisma/client';
import { config } from '../config';

export function getPlanLimits(plan: Plan) {
  return plan === 'PRO' ? config.pro : config.free;
}
