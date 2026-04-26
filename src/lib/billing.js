const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Create a subscription for a user.
 * Bug: no idempotency key — double-click can create duplicate subscriptions.
 */
async function createSubscription(customerId, priceId) {
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    expand: ['latest_invoice.payment_intent'],
    // Missing: idempotencyKey option
  });
  return subscription;
}

/**
 * Cancel a subscription immediately.
 */
async function cancelSubscription(subscriptionId) {
  return stripe.subscriptions.cancel(subscriptionId);
}

module.exports = { createSubscription, cancelSubscription };
