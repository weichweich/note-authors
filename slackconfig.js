export const slackWebhook = process.env.SLACK_WEBHOOK

export const eventMessage = {
  democracy: {
    '*': 'Something with democracy happened.',
  },
  parachainSystem: {
    UpgradeAuthorized:
      'The upgrade was authorized and is ready to be scheduled! The upgrade can happen earliest in 1h.',
    ValidationFunctionStored:
      'The upgrade was scheduled and will happen in ~1h',
  },
}
