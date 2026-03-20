export class UpgradeRequiredError extends Error {
  constructor(feature?: string) {
    super(feature ? `Pro plan required for ${feature}` : 'Pro plan required');
    this.name = 'UpgradeRequiredError';
  }
}
