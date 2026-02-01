import {
  Block,
  PageLayout,
  Page,
  TelegramBackButton,
  TelegramMainButton,
  Text,
} from '@components'

const webApp = window.Telegram?.WebApp

export function EnvUnsupported() {

  const handleCloseApp = () => {
    webApp?.close()
  }

  return (
    <Page>
      <PageLayout center>
        <TelegramBackButton />
        <TelegramMainButton text="Close" onClick={handleCloseApp} />
        <Block margin="top" marginValue={16}>
          <img
            alt="Telegram sticker"
            src="https://xelene.me/telegram.gif"
            style={{ display: 'block', width: '144px', height: '144px', margin: '0 auto' }}
          />
        </Block>
        <Block margin="top" marginValue={16}>
          <Text type="title" align="center" weight="bold">
            Oops
          </Text>
        </Block>
        <Block margin="top" marginValue={12}>
          <Text type="text" align="center">
            You are using too old Telegram client to run this application
          </Text>
        </Block>
      </PageLayout>
    </Page>
  )
}
