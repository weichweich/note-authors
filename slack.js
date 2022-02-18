import got from 'got'

import { slackWebhook, eventMessage } from './slackconfig.js'

function buildMessage(record, msgConfig, chainName, runtimeVersion) {
  const docStr = '> ' + record.event.meta.docs.join('\n> ')
  const message = `
*${record.event.section}.${record.event.method}*
${docStr}

*The event contained the following data:*
${JSON.stringify(record.event.data, null, 2)}
`

  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚨 Blockchain Event 🚨',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: msgConfig,
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: message,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'plain_text',
            text: `Blockchain: '${chainName}' Runtime: '${runtimeVersion}'`,
          },
        ],
      },
    ],
  }
}

async function sendNotification(api, record, config) {
  const msg = buildMessage(
    record,
    config,
    api.runtimeChain.toString(),
    api.runtimeVersion.specVersion.toString(),
  )

  console.log('🏤', JSON.stringify(msg, null, 2))
  await got.post(slackWebhook, {
    json: msg,
  })
}

export async function notifySlack(api, chainState, header, signedBlock) {
  const allRecords = await api.query.system.events.at(
    signedBlock.block.header.hash,
  )
  allRecords.forEach((record) => {
    const msgConfigWildcard = eventMessage[record.event.section]?.['*']
    const msgConfigSpecific =
      eventMessage[record.event.section]?.[record.event.method]

    if (typeof msgConfigSpecific !== 'undefined') {
      sendNotification(api, record, msgConfigSpecific)
    }
    if (typeof msgConfigWildcard !== 'undefined') {
      sendNotification(api, record, msgConfigWildcard)
    }
  })
}
