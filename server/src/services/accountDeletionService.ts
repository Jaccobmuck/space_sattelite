import Stripe from 'stripe';
import { deleteProfile, getPendingDeletionProfiles, type Profile } from '../db/index.js';
import { logger } from '../lib/logger.js';

const CANCELLABLE_SUBSCRIPTION_STATUSES = new Set<Stripe.Subscription.Status>([
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'incomplete',
]);

function getStripe(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) {
    return null;
  }

  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
  });
}

export async function cancelBillableSubscriptions(profile: Profile): Promise<void> {
  if (!profile.stripe_customer_id) {
    return;
  }

  const stripe = getStripe();
  if (!stripe) {
    throw new Error('Missing STRIPE_SECRET_KEY for account deletion cleanup');
  }

  const subscriptions = await stripe.subscriptions.list({
    customer: profile.stripe_customer_id,
    status: 'all',
  });

  const subscriptionsToCancel = subscriptions.data.filter((sub) =>
    CANCELLABLE_SUBSCRIPTION_STATUSES.has(sub.status)
  );

  const cancellationResults = await Promise.allSettled(
    subscriptionsToCancel.map(async (sub) => {
      const canceled = await stripe.subscriptions.cancel(sub.id);
      if (canceled.status !== 'canceled') {
        throw new Error(`Subscription ${sub.id} not canceled, status: ${canceled.status}`);
      }
    })
  );

  const failedCancellations = cancellationResults.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected'
  );

  if (failedCancellations.length > 0) {
    throw new Error(
      `Failed to cancel ${failedCancellations.length} of ${subscriptionsToCancel.length} subscriptions`
    );
  }
}

async function processPendingDeletion(profile: Profile): Promise<void> {
  await cancelBillableSubscriptions(profile);

  const deleteResult = await deleteProfile(profile.id);
  if (!deleteResult.success) {
    throw new Error(deleteResult.error || 'Failed to delete profile');
  }
}

export async function processPendingAccountDeletions(): Promise<void> {
  const profiles = await getPendingDeletionProfiles();

  for (const profile of profiles) {
    try {
      await processPendingDeletion(profile);
      logger.info('Processed pending account deletion', {
        userId: profile.id,
      });
    } catch (error) {
      logger.error('Failed to process pending account deletion', {
        userId: profile.id,
        stripeCustomerId: profile.stripe_customer_id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
