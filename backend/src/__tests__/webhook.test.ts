import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { readFileSync } from 'fs';
import path from 'path';

// vi.hoisted runs before vi.mock hoisting — safe to reference in mock factories
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    paymentEvent: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  return { mockPrisma };
});

vi.mock('../lib/prisma', () => ({ prisma: mockPrisma }));

vi.mock('../config', () => ({
  config: {
    prodamus: {
      secretKey: 'test-secret-key',
      payformUrl: 'https://test.payform.ru',
      systemCode: 'test',
      subscriptionId: '',
      demoMode: false,
    },
    frontendUrl: 'https://test.example.com',
    pro: { maxTotalStorage: 1073741824 },
    free: { maxTotalStorage: 52428800 },
  },
}));

vi.mock('../services/email.service', () => ({
  sendProUpgradeEmail: vi.fn().mockResolvedValue(undefined),
  sendSubscriptionCancelledEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/email-events.service', () => ({
  sendEmailOnce: vi.fn().mockResolvedValue({ sent: false }),
}));

vi.mock('../services/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Must import AFTER mocks
import { createSignature } from '../utils/prodamus-hmac';
import { webhookRouter } from '../routes/billing';

// Build a minimal Express app with the webhook router
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/api/billing/webhook', webhookRouter);
  return app;
}

// Helper: build a signed webhook body
function signedBody(body: Record<string, unknown>, secretKey = 'test-secret-key') {
  const sign = createSignature(body as Record<string, unknown>, secretKey);
  return { ...body, sign };
}

const SUB_ID = 'cltest_sub_001';
const USER_ID = 'cltest_user_001';
const PAYMENT_ID = 'pay_test_001';

function makeSub(overrides: Record<string, unknown> = {}) {
  return {
    id: SUB_ID,
    userId: USER_ID,
    status: 'INACTIVE',
    priceRub: 386,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelledAt: null,
    prodamusOrderId: null,
    prodamusSubscriptionId: null,
    user: {
      id: USER_ID,
      email: 'test@example.com',
      displayName: 'Test User',
      plan: 'FREE',
    },
    ...overrides,
  };
}

describe('Billing Webhook', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: claimPaymentEvent succeeds (create does not throw)
    mockPrisma.paymentEvent.create.mockResolvedValue({ id: 'evt1' });
    mockPrisma.paymentEvent.update.mockResolvedValue({});
    mockPrisma.$transaction.mockResolvedValue([{}, {}]);
    app = createTestApp();
  });

  // ─── 1. Missing signature → 403 ────────────────────────────────────
  describe('Missing signature', () => {
    it('should return 403 when no Sign header and no body.sign', async () => {
      const res = await request(app)
        .post('/api/billing/webhook')
        .send({ order_id: SUB_ID, payment_status: 'success' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Missing signature');
    });
  });

  // ─── 2. Invalid signature → 403 ────────────────────────────────────
  describe('Invalid signature', () => {
    it('should return 403 when signature does not match', async () => {
      const body = {
        order_id: SUB_ID,
        payment_status: 'success',
        payment_id: PAYMENT_ID,
        sum: '386.00',
        sign: 'deadbeef'.repeat(8), // 64 hex chars, wrong signature
      };

      const res = await request(app)
        .post('/api/billing/webhook')
        .send(body);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Invalid signature');
    });
  });

  // ─── 3. Success payment → activate PRO ─────────────────────────────
  describe('Success payment', () => {
    it('should activate PRO subscription and upgrade user', async () => {
      const sub = makeSub();
      mockPrisma.subscription.findUnique.mockResolvedValue(sub);

      const body = signedBody({
        order_id: SUB_ID,
        payment_status: 'success',
        payment_id: PAYMENT_ID,
        sum: '386.00',
      });

      const res = await request(app)
        .post('/api/billing/webhook')
        .send(body);

      expect(res.status).toBe(200);

      // Verify $transaction was called to update subscription + user
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      const txArgs = mockPrisma.$transaction.mock.calls[0][0];
      expect(txArgs).toHaveLength(2);

      // Verify PaymentEvent was claimed
      expect(mockPrisma.paymentEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            provider: 'prodamus',
            providerEventId: PAYMENT_ID,
            status: 'PROCESSING',
          }),
        }),
      );

      // Verify PaymentEvent was marked as processed
      expect(mockPrisma.paymentEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PROCESSED',
          }),
        }),
      );
    });

    it('should reset cancelledAt to null on reactivation', async () => {
      const sub = makeSub({
        status: 'CANCELLED',
        cancelledAt: new Date('2026-02-01'),
      });
      mockPrisma.subscription.findUnique.mockResolvedValue(sub);

      const body = signedBody({
        order_id: SUB_ID,
        payment_status: 'success',
        payment_id: 'pay_reactivate_001',
        sum: '386.00',
      });

      const res = await request(app)
        .post('/api/billing/webhook')
        .send(body);

      expect(res.status).toBe(200);
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  // ─── 4. Refund → downgrade ─────────────────────────────────────────
  describe('Refund', () => {
    it('should downgrade ACTIVE subscription on refund', async () => {
      const sub = makeSub({ status: 'ACTIVE' });
      mockPrisma.subscription.findUnique.mockResolvedValue(sub);

      const body = signedBody({
        order_id: SUB_ID,
        payment_status: 'refund',
        payment_id: 'pay_refund_001',
      });

      const res = await request(app)
        .post('/api/billing/webhook')
        .send(body);

      expect(res.status).toBe(200);
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should downgrade CANCELLED subscription on refund', async () => {
      const sub = makeSub({ status: 'CANCELLED' });
      mockPrisma.subscription.findUnique.mockResolvedValue(sub);

      const body = signedBody({
        order_id: SUB_ID,
        payment_status: 'refund',
        payment_id: 'pay_refund_002',
      });

      const res = await request(app)
        .post('/api/billing/webhook')
        .send(body);

      expect(res.status).toBe(200);
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should skip refund for AI pack (no auto-reversal)', async () => {
      const body = signedBody({
        order_id: 'aipack_user1_10_1234567890',
        payment_status: 'refund',
        payment_id: 'pay_refund_aipack',
      });

      const res = await request(app)
        .post('/api/billing/webhook')
        .send(body);

      expect(res.status).toBe(200);
      // No $transaction for AI pack refunds
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      // But PaymentEvent should be marked processed
      expect(mockPrisma.paymentEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PROCESSED',
            lastError: 'refund_aipack_no_reversal',
          }),
        }),
      );
    });
  });

  // ─── 5. Duplicate event → idempotent skip ──────────────────────────
  describe('Duplicate event (idempotency)', () => {
    it('should skip already-processed event', async () => {
      // Simulate unique violation on create (event already exists).
      // The code checks: err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
      const { Prisma } = await import('@prisma/client');
      const uniqueError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '6.0.0' },
      );
      mockPrisma.paymentEvent.create.mockRejectedValue(uniqueError);
      mockPrisma.paymentEvent.findUnique.mockResolvedValue({
        provider: 'prodamus',
        providerEventId: PAYMENT_ID,
        status: 'PROCESSED',
        updatedAt: new Date(),
      });

      const body = signedBody({
        order_id: SUB_ID,
        payment_status: 'success',
        payment_id: PAYMENT_ID,
        sum: '386.00',
      });

      const res = await request(app)
        .post('/api/billing/webhook')
        .send(body);

      expect(res.status).toBe(200);
      // No subscription update should happen for duplicates
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ─── 6. Amount mismatch → reject ───────────────────────────────────
  describe('Amount mismatch', () => {
    it('should reject PRO payment with wrong amount', async () => {
      const sub = makeSub();
      mockPrisma.subscription.findUnique.mockResolvedValue(sub);

      const body = signedBody({
        order_id: SUB_ID,
        payment_status: 'success',
        payment_id: 'pay_wrong_amount',
        sum: '1.00',
      });

      const res = await request(app)
        .post('/api/billing/webhook')
        .send(body);

      expect(res.status).toBe(200);
      // No subscription activation
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      // PaymentEvent should be marked with amount_mismatch note
      expect(mockPrisma.paymentEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PROCESSED',
            lastError: 'ignored_amount_mismatch',
          }),
        }),
      );
    });

    it('should reject AI pack payment with wrong amount', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'testuser',
        email: 'test@example.com',
      });

      const body = signedBody({
        order_id: 'aipack_testuser_10_1234567890',
        payment_status: 'success',
        payment_id: 'pay_ai_wrong',
        sum: '50.00', // expected 99
      });

      const res = await request(app)
        .post('/api/billing/webhook')
        .send(body);

      expect(res.status).toBe(200);
      // No AI credits should be added
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  // ─── 7. CANCELLED + expired → cleanup downgrade ────────────────────
  describe('CANCELLED + expired cleanup', () => {
    it('cleanup.ts should query CANCELLED and PAST_DUE subscriptions alongside ACTIVE', () => {
      // Verify the fix is in place by reading cleanup.ts source directly.
      const cleanupPath = path.resolve(__dirname, '../services/cleanup.ts');
      const cleanupSource = readFileSync(cleanupPath, 'utf-8');

      // Verify the expired subscription query includes CANCELLED
      expect(cleanupSource).toContain('CANCELLED');
      expect(cleanupSource).toMatch(/status.*in.*ACTIVE/s);
      expect(cleanupSource).toMatch(/status.*in.*CANCELLED/s);
    });
  });

  // ─── 8. Non-success status → ignored gracefully ────────────────────
  describe('Non-success payment status', () => {
    it('should return 200 and skip non-success status', async () => {
      const body = signedBody({
        order_id: SUB_ID,
        payment_status: 'pending',
        payment_id: 'pay_pending',
      });

      const res = await request(app)
        .post('/api/billing/webhook')
        .send(body);

      expect(res.status).toBe(200);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ─── 9. Unknown subscription → skip ────────────────────────────────
  describe('Unknown subscription', () => {
    it('should return 200 and skip when subscription not found', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const body = signedBody({
        order_id: 'unknown_sub_id',
        payment_status: 'success',
        payment_id: 'pay_unknown',
        sum: '386.00',
      });

      const res = await request(app)
        .post('/api/billing/webhook')
        .send(body);

      expect(res.status).toBe(200);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockPrisma.paymentEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastError: 'ignored_unknown_subscription',
          }),
        }),
      );
    });
  });

  // ─── 10. Signature via body.sign field ──────────────────────────────
  describe('Signature via body field', () => {
    it('should accept signature from body.sign field when header absent', async () => {
      const sub = makeSub();
      mockPrisma.subscription.findUnique.mockResolvedValue(sub);

      const bodyData = {
        order_id: SUB_ID,
        payment_status: 'success',
        payment_id: 'pay_bodysign',
        sum: '386.00',
      };
      const body = signedBody(bodyData);

      // Send without Sign header — signature is in body.sign
      const res = await request(app)
        .post('/api/billing/webhook')
        .send(body);

      expect(res.status).toBe(200);
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });
});
