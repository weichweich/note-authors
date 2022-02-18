export const slackConfig = {
  parachainStaking: {
    Rewarded: {
      webhook:
        '<WEBHOOK URL>',
        msg: '<!here>',
    },
  },
  democracy: {
    '*': {
      webhook:
        '<WEBHOOK URL>',
      msg: '<!here>'
    },
  },
  parachainSystem: {
    UpgradeAuthorized: {
      webhook:
        '<WEBHOOK URL>',
      msg: ''
    },
    ValidationFunctionStored: {
      webhook:
        '<WEBHOOK URL>',
      msg: ''
    },
  },
}
