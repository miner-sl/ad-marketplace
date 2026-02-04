import { useCallback, useEffect, useState } from 'react'

import sandwatchLottie from '@assets/sandwatch.json'
import {
  Block,
  Icon,
  PageLayout,
  Page,
  StickerPlayer,
  TelegramBackButton,
  TelegramMainButton,
  Text,
  useToast,
} from '@components'
import { useAppNavigation, useInterval } from '@hooks'
import { ROUTES_NAME } from '@routes'
import config from '@config'
// import { AdminChat, useChatActions } from '@store'

// import { findNewChat } from './helpers'
import type {AdminChat} from "@types";
import {addBotToChannelLink} from "@utils";

export const AddBotToChatPage = () => {
  const { appNavigate } = useAppNavigation()

  // const { fetchAdminUserChatsAction, fetchChatAction } = useChatActions()
  const [checkingTries, setCheckingTries] = useState(0)

  // const [currentChats, setCurrentChats] = useState<AdminChat[]>([])
  const [isCheckingNewChat, setIsCheckingNewChat] = useState(false)
  const [isCheckingChatPermissions, setIsCheckingChatPermissions] =
    useState(false)
  const [newChat, setNewChat] = useState<AdminChat | null>(null)

  const { showToast } = useToast()

  const navigateToMainPage = useCallback(() => {
    appNavigate({ path: ROUTES_NAME.MAIN })
  }, [appNavigate])

  const addGatewayBot = useCallback(() => {
    addBotToChannelLink(config.botName)
  }, [])
  //
  // const fetchAdminUserChats = async () => {
  //   try {
  //     const data = await fetchAdminUserChatsAction()
  //     setCurrentChats(data)
  //   } catch (error) {
  //     console.error(error)
  //   }
  // }
  //
  // const poollingNewChat = async () => {
  //   try {
  //     const data = await fetchAdminUserChatsAction()
  //
  //     const noNewChats = data?.length === currentChats?.length
  //     setCheckingTries(checkingTries + 1)
  //     if (noNewChats) return
  //
  //     const newChat = currentChats.length
  //       ? findNewChat(data, currentChats, 'slug')
  //       : data
  //
  //     if (newChat.length) {
  //       setNewChat(newChat[0])
  //       setIsCheckingNewChat(false)
  //       setIsCheckingChatPermissions(true)
  //     }
  //   } catch (error) {
  //     console.error(error)
  //   }
  // }

  const poollingChatPermissions = async (chatSlug: string) => {
    if (!chatSlug) return
    try {
      // const { chat } = await fetchChatAction(chatSlug)
      //
      // if (!chat?.insufficientPrivileges) {
      //   appNavigate({
      //     path: ROUTES_NAME.BOT_ADDED_SUCCESS,
      //     params: { chatSlug },
      //   })
      //   setIsCheckingChatPermissions(false)
      // }
    } catch (error) {
      console.error(error)
    }
  }

  useInterval(
    () => {
      // poollingNewChat()
    },
    1500,
    {
      enabled: isCheckingNewChat,
      immediate: false,
    }
  )

  const resetPolling = useCallback(() => {
    setIsCheckingNewChat(false)
    setIsCheckingChatPermissions(false)
    setNewChat(null)
  }, [])

  useInterval(
    () => {
      if (!newChat) return
      poollingChatPermissions(newChat.slug)
    },
    1500,
    {
      enabled: isCheckingChatPermissions,
      immediate: false,
    }
  )

  useEffect(() => {
    if (checkingTries > 10) {
      resetPolling()
      setCheckingTries(0)
      showToast({
        message: 'Please check if the bot was added to the group or channel',
        type: 'error',
      })
    }
  }, [checkingTries, resetPolling, showToast])

  useEffect(() => {
    // fetchAdminUserChats()
  }, [])

  let Component;

  if (isCheckingNewChat || isCheckingChatPermissions || newChat) {
    const title =
      (isCheckingNewChat &&
        'Checking If the Bot Was Added to Your Group or Channel') ||
      (isCheckingChatPermissions && 'Checking Bot Permissions')
    Component = (
      <>
        <StickerPlayer lottie={sandwatchLottie} />
        <Block margin="top" marginValue={16}>
          <Text type="title" align="center" weight="bold">
            {title}
          </Text>
        </Block>
        <Block margin="top" marginValue={12}>
          <Text type="text" align="center">
            This may take a moment — the check usually doesn't take long
          </Text>
        </Block>
      </>
    )
  } else {
    Component = (
      <>
        <Icon name="gatewayBot" size={112} />
        <Block margin="top" marginValue={16}>
          <Text type="title" align="center" weight="bold">
            Add Ads Bot to The Channel
          </Text>
        </Block>
        <Block margin="top" marginValue={12}>
          <Text align="center" type="text">
            Access bot require admin access to post messages in the channel
          </Text>
        </Block>
      </>
    )
  }

  const handleClick = () => {
    if (isCheckingNewChat || isCheckingChatPermissions) {
      resetPolling()
    } else {
      addGatewayBot()
    }
  }

  return (
    <Page back>
      <PageLayout center>
        <TelegramBackButton onClick={navigateToMainPage} />
        <TelegramMainButton
          text={
            isCheckingNewChat || isCheckingChatPermissions
              ? 'Cancel'
              : 'Add Bot To Channel'
          }
          onClick={handleClick}
        />
        {Component}
      </PageLayout>
    </Page>
  )
}
