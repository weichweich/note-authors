import { text } from 'express'
import got from 'got'

import { slackConfig } from './slackconfig.js'

async function sendNotification({ event, phase }, config) {
  const docStr = '> ' + event.meta.docs.join('\n> ')
  const msg = `🚨 *Blockchain Event* 🚨

${config.msg}

*${event.section}.${event.method}*
${docStr}

*The event contained the following data:*
${JSON.stringify(event.data, null, 2)}
`
  console.log('🏤 \n', msg)

  await got.post(config.webhook, {
    json: {
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: msg
          },
        },
      ],
    },
  })
}

export async function notifySlack(api, chainState, header, signedBlock) {
  const allRecords = await api.query.system.events.at(
    signedBlock.block.header.hash,
  )
  allRecords.forEach((record) => {
    const msgConfigWildcard = (slackConfig[record.event.section] || {})['*']
    const msgConfigSpecific = (slackConfig[record.event.section] || {})[
      record.event.method
    ]

    if (typeof msgConfigSpecific !== 'undefined') {
      sendNotification(record, msgConfigSpecific)
    }
    if (typeof msgConfigWildcard !== 'undefined') {
      sendNotification(record, msgConfigWildcard)
    }
  })
}
