import cn from 'classnames';
import { useParams } from 'react-router-dom';
import { useRef, useState } from 'react';
import { openTelegramLink } from '@tma.js/sdk-react';
import { type SendTransactionResponse, type TonProofItemReply, useTonWallet } from '@tonconnect/ui-react';

import {
  Block,
  BlockNew,
  Button,
  ChannelLink,
  DealStatusBadge,
  DeclineDealModal,
  Group,
  Icon,
  Image,
  List,
  ListItem,
  ListLinkView,
  Page,
  PageLayout,
  Sheet,
  Spinner,
  TelegramBackButton,
  TelegramMainButton,
  Text,
  useToast,
} from '@components';
import { EditableMessageText } from './EditableMessageText';

import {
  type EnhancedDeal,
  useAcceptDealMutation,
  useDealQuery,
  useDeclineDealMutation,
  useRequestCreativeRevisionMutation,
  useUpdateDealMessageMutation,
} from '@store-new'
import { useAuth } from '@context';

import { transferTonCall } from '@hooks';
import { initializeTonConnect, tonConnectUI } from '../../../common/utils/lazy';
import { requestAPI } from '../../../common/utils/api';
import { confirmActionPopup, hapticFeedback, playConfetti, popupManager } from '@utils';
import { getTONScanUrl } from '../../../common/config';
import type { DealMessage } from '@types';

import styles from './DealDetailsPage.module.scss';


interface DealHeaderProps {
  deal: EnhancedDeal
}

type WalletFormStore = {
  wallet?: string;
  wallet_initState?: string;
  ton_proof?: TonProofItemReply;
};

const DealHeader = ({ deal }: DealHeaderProps) => {
  if (!deal) {
    return undefined;
  }

  return (
    <BlockNew align='center'>
      <BlockNew align="center">
        <Image
          size={112}
          src={null}
          borderRadius={50}
          fallback={deal.channel?.title || `Deal #${deal.id}`}
        />
      </BlockNew>
      <BlockNew margin="top" marginValue={12} row justify="center" align="center" gap={4}>
        <Text type="title" align="center" weight="bold">
          Deal #{deal.id}
        </Text>
        <DealStatusBadge status={deal.status} />
      </BlockNew>
      {deal.formattedMembersCount && (
        <BlockNew margin="top" marginValue={8}>
          <Text type="caption2" color="tertiary" align="center">
            {deal.formattedMembersCount}
          </Text>
        </BlockNew>
      )}
    </BlockNew>
  );
}


export const DealDetailsPage = () => {
  const { id } = useParams<{ id: string }>()
  const dealId = id ? parseInt(id) : 0
  const { user } = useAuth();
  const [formWallet, setFormWallet] = useState<WalletFormStore>({});
  const { data: deal, isLoading } = useDealQuery(dealId, user?.telegramId);
  // const { data: creative } = useDealCreativeQuery(dealId)
  const acceptDealMutation = useAcceptDealMutation();
  const declineDealMutation = useDeclineDealMutation();
  // const approveCreativeMutation = useApproveCreativeMutation()
  const requestRevisionMutation = useRequestCreativeRevisionMutation();
  const updateDealMessageMutation = useUpdateDealMessageMutation();
  // TODO: Uncomment when useDealCreativeQuery is implemented
  // const { data: creative } = useDealCreativeQuery(dealId)
  // const creative: Creative | null = deal?.creative;
  // const submitCreativeMutation = useSubmitCreativeMutation()
  const { showToast } = useToast()
  // const {transferTon, isConnected} = useTonTransfer()
  const [showDeclineModal, setShowDeclineModal] = useState(false)
  const [showRequestChangesSheet, setShowRequestChangesSheet] = useState(false)
  const [requestChangesNotes, setRequestChangesNotes] = useState('')

  const isChannelOwner = deal && deal?.channel_owner_id === user?.id
  const isAdvertiser = deal && user && deal?.advertiser_id === user?.id;
  // const canInteract = isChannelOwner || isAdvertiser
  const canEditMessage = isAdvertiser && (deal?.status === 'negotiating' || deal?.status === 'pending')

  const handleAdvertiserClick = () => {
    const advertiser = deal && typeof deal.advertiser === 'object' && deal.advertiser !== null ? deal.advertiser : null
    if (advertiser) {
      if (advertiser.username) {
        openTelegramLink(`https://t.me/${advertiser.username.replace('@', '')}`)
      } else if (advertiser.telegram_id) {
        // For users without username, use user ID
        openTelegramLink(`https://t.me/user${advertiser.telegram_id}`)
      }
    }
  }

  const tonConnectRef = useRef<boolean>(false);

  const onClickButton = async () => {
    // if (processing()) return;
    // await playConfetti({
    //   emojis: ["🎉"],
    // });
    //
    hapticFeedback("soft");

    const popup = await popupManager.openPopup({
      title: 'Payment',
      message: 'Do you want to pay deal for TON?',
      buttons: [
        {
          id: "ok",
          type: 'destructive',
          text: "Pay",
        },
        {
          id: "cancel",
          type: "cancel",
        },
      ],
    });

    if (!popup.button_id || popup.button_id === "cancel") return;

    // setProcessing(true);


    let boc: string | undefined;

    // const fee = modals.participate.contest?.fee;
    const fee = true;
    if (fee) {
      const result = await handlePayment();

      if (result) {
        boc = result.boc;
      } else {
        // setProcessing(false);
        return;
      }
    }

    const request = await requestAPI(
      `/deal/${dealId}/pay`,
      {
        boc: boc,
        wallet: formWallet.wallet,
      },
      "POST",
      120_000,
    );

    if (request) {
      const { status } = request;

      if (status === "success") {
        hapticFeedback('medium');
        await playConfetti({
          emojis: ["🎉"],
        });

        // batch(() => {
        //   setState("done");
        //   toggleSignal("fetchContest");
        // });

        return;
      }
    }

    showToast({
      type: 'warning',
      message: 'Failed to pay deal. Please try again.',
    });
    // setProcessing(false);
  };


  const handlePayment = async () => {
    // return true;
    if (!deal || !deal.escrow_address) {
      return false;
    }
    // debugger;
    if (!tonConnectUI) {
      tonConnectRef.current = await initializeTonConnect();
      return handlePayment();
    }

    if (tonConnectUI?.connected) {
      await tonConnectUI?.disconnect();
    }

    tonConnectUI?.setConnectRequestParameters({
      state: "loading",
    });

    const request = await requestAPI(
      "/transactions/payload/create",
      undefined,
      "GET",
    );

    if (!request) return;

    const {
      result: { payload },
    } = request;

    tonConnectUI?.setConnectRequestParameters({
      state: "ready",
      value: {
        tonProof: payload,
      },
    });

    await tonConnectUI?.openModal();

    return new Promise<false | SendTransactionResponse>((resolve) => {
      const disposeOnStatusChange = tonConnectUI?.onStatusChange(
        async (wallet) => {
          disposeOnModalStateChange?.();
          disposeOnStatusChange?.();

          setFormWallet((store: WalletFormStore): WalletFormStore => {
            if (wallet) {
              store.wallet = wallet?.account.address;
              store.wallet_initState = wallet.account.walletStateInit;
            }

            if (wallet?.connectItems?.tonProof) {
              store.ton_proof = wallet?.connectItems?.tonProof;
            }
            return store;
          });

          const request = await requestAPI(
            `/transactions/deal/${deal?.id}/create`,
            {
              // description: form.description,
              wallet: formWallet.wallet,
              wallet_initState: formWallet.wallet_initState,
              ton_proof: formWallet.ton_proof
                ? JSON.stringify(formWallet.ton_proof)
                : undefined,
            },
            'POST'
          );

          // const request = await requestAPI(
          //   `/contest/${modals.participate.contest?.slug}/transaction/create`,
          //   {
          //     description: form.description,
          //     wallet: formWallet.wallet,
          //     wallet_initState: formWallet.wallet_initState,
          //     ton_proof: formWallet.ton_proof
          //       ? JSON.stringify(formWallet.ton_proof)
          //       : undefined,
          //   },
          //   "POST",
          // );

          if (request && deal.escrow_address) {
            const {
              result: {
                payload: {
                  // master: payload_master,
                  target: payload_target,
                },
              },
            } = request.data;


            if (tonConnectUI) {
              transferTonCall(
                tonConnectUI,
                deal.escrow_address,
                deal.price_ton,
                payload_target,
                // formWallet.wallet,
                // modals.participate.contest?.fee ?? 0,
                // modals.participate.contest?.fee_wallet ?? ""
              )
                // tonConnectUI
                // ?.sendTransaction({
                //   validUntil: Math.floor(Date.now() / 1000) + 300,
                //   messages: [
                //     // {
                //     //   address:
                //     //     parseTONAddress(
                //     //       modals.participate.contest?.fee_wallet ?? "",
                //     //     ) ?? "",
                //     //   amount: (
                //     //     (1 - (0.01)) *
                //     //     0.01 *
                //     //     1e9
                //     //   ).toString(),
                //     //   payload: payload_target,
                //     // },
                //     {
                //       address: deal?.escrow_address ?? "",
                //       amount: (
                //         0.01 *
                //         0.01 * 1e9
                //       ).toString(),
                //       payload: payload_master,
                //     },
                //   ],
                // })
                .then(resolve)
                .catch((e) => {
                  console.error(e);
                  resolve(false);
                });
            }
          } else {
            showToast({
              type: 'warning',
              // icon: F/aSolidCircleExclamation,
              message: 'failed to send transaction',
              // text: t("errors.fetch"),
            });
          }
        },
      );

      const disposeOnModalStateChange = tonConnectUI?.onModalStateChange(
        (state) => {
          if (state.status === "closed") {
            resolve(false);
          }

          disposeOnModalStateChange?.();
        },
      );
    });
  };


  const handleAcceptDeal = async () => {
    if (!user) return;
    const ok = await confirmActionPopup('Accept Deal', 'Do you want to accept deal?');
    if (!ok) {
      return;
    }
    try {
      hapticFeedback('soft');
      await acceptDealMutation.mutateAsync({
        id: dealId,
        channel_owner_id: user.id,
      })
    } catch (error) {
      console.error('Failed to accept deal:', error)
    }
  };

  const handleDeclineDeal = () => {
    setShowDeclineModal(true)
  }

  const handleConfirmDecline = async (reason?: string) => {
    try {
      if (declineDealMutation.isPending) {
        return
      }

      hapticFeedback('soft');
      setShowDeclineModal(false)
      await declineDealMutation.mutateAsync({ id: dealId, reason });
      showToast({ message: 'Deal declined successfully', type: 'success' });
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : 'Failed to decline deal',
        type: 'warning',
      });
      console.error('Failed to decline deal:', error)
    }
  }

  // const handleApproveCreative = async () => {
  //   try {
  //     await approveCreativeMutation.mutateAsync(dealId)
  //   } catch (error) {
  //     console.error('Failed to approve creative:', error)
  //   }
  // }
  //
  // const handleRequestRevision = async () => {
  //   const notes = prompt('Please provide revision notes:')
  //   if (notes) {
  //     try {
  //       await requestRevisionMutation.mutateAsync({
  //         dealId,
  //         revision_notes: notes,
  //       })
  //     } catch (error) {
  //       console.error('Failed to request revision:', error)
  //     }
  //   }
  // }

  const openRequestChangesSheet = () => {
    if (!deal) return
    setRequestChangesNotes('')
    setShowRequestChangesSheet(true)
  }

  const closeRequestChangesSheet = () => {
    setShowRequestChangesSheet(false)
    setRequestChangesNotes('')
  }

  const handleRequestChangesDone = async () => {
    const notes = requestChangesNotes.trim()
    if (notes.length < 5) {
      return
    }
    const ok = await confirmActionPopup('Draft Deal', 'Do you want to draft deal?')
    if (!ok) return
    hapticFeedback('soft')
    try {
      await requestRevisionMutation.mutateAsync({
        dealId: deal!.id,
        notes,
      })
      showToast({
        type: 'success',
        message: 'Revision request sent successfully',
      })
      closeRequestChangesSheet()
    } catch (error: any) {
      console.error('Failed to request revision:', error)
      showToast({
        type: 'error',
        message: error?.message || 'Failed to request revision',
      })
    }
  }
  //
  // const handlePayDeal = async () => {
  //   if (!deal || !deal.escrow_address) {
  //     showToast({type: 'error', message: 'Escrow address not available'})
  //     return
  //   }
  //
  //   if (!isConnected) {
  //     showToast({
  //       type: 'error',
  //       message: 'Please connect your TON wallet first'
  //     })
  //     return
  //   }
  //
  //   try {
  //     await transferTon(
  //       deal.escrow_address,
  //       deal.price_ton,
  //       `Payment for Deal #${deal.id}`
  //     )
  //     showToast({
  //       type: 'success',
  //       message: 'Transaction sent successfully. Waiting for confirmation...',
  //     })
  //   } catch (error) {
  //     // Error handling is done in the hook
  //     console.error('Payment failed:', error)
  //   }
  // }

  const handleSaveMessage = async (message_text: string) => {
    try {
      if (updateDealMessageMutation.isPending) {
        return;
      }
      await updateDealMessageMutation.mutateAsync({
        dealId,
        message_text,
      })
      showToast({
        type: 'success',
        message: 'Message updated successfully',
      })
    } catch (error: any) {
      console.error('Failed to update message:', error)
      showToast({
        type: 'error',
        message: error?.message || 'Failed to update message',
      })
      throw error
    }
  }

  const isAdvertiserUser = deal && typeof deal.advertiser === 'object' && deal.advertiser !== null
    ? String(deal.advertiser.telegram_id) === String(user?.telegram_id)
    : false
  const showPaymentButton = deal && isAdvertiserUser && deal.status === 'payment_pending' && deal.escrow_address !== undefined;

  const wallet = useTonWallet();
  const channelStats = deal?.channel?.stats;

  if (isLoading || !deal) {
    return (
      <Page back>
        <PageLayout>
          <TelegramBackButton />
          <Spinner size={32} />
        </PageLayout>
      </Page>
    )
  }


  return (
    <Page back>
      <PageLayout>
        <TelegramBackButton />

        <DealHeader deal={deal} />
        {deal.status === 'pending' && ((deal.owner && isChannelOwner)) ? (
          <Block margin="top" marginValue={24}>
            <BlockNew gap={8} row>
              <>
                <ListItem
                  text={
                    <Text type="text" color="accent">
                      Accept
                    </Text>
                  }
                  before={
                    <Icon name="checkmark" size={28} color="accent" />
                  }
                  onClick={handleAcceptDeal}
                  disabled={acceptDealMutation.isPending}
                />
                <ListItem
                  text={
                    <Text type="text" color="danger">
                      Decline
                    </Text>
                  }
                  before={
                    <Icon name="cross" size={28} color="danger" />
                  }
                  onClick={handleDeclineDeal}
                  disabled={declineDealMutation.isPending}
                />
                <ListItem
                  text={
                    <Text type="text">
                      Request Changes
                    </Text>
                  }
                  before={
                    <Icon name="share" size={28} color="accent" />
                  }
                  onClick={openRequestChangesSheet}
                />
              </>
            </BlockNew>
          </Block>
        ) : undefined}

        <Block gap={4} margin="top" marginValue={12}>
          {channelStats && (
            <Block margin="bottom" marginValue={24}>
              <Block paddingValue={16}>
                <Group header="STATISTICS">
                  {channelStats.subscribers_count && (
                    <ListItem
                      padding="6px 16px"
                      text={
                        <Text type="text">
                          👥 {deal.formattedSubscribersCount} subscribers
                        </Text>
                      }
                    />
                  )}
                  {channelStats.average_views && (
                    <ListItem
                      padding="6px 16px"
                      text={
                        <Text type="text">
                          👁️ {deal.formattedAverageViews} average views
                        </Text>
                      }
                    />
                  )}
                  {channelStats.average_reach && (
                    <ListItem
                      padding="6px 16px"
                      text={
                        <Text type="text">
                          📊 {deal.formattedAverageReach} average reach
                        </Text>
                      }
                    />
                  )}
                </Group>
              </Block>
            </Block>
          )}

          {/*{creative && (*/}
          {/*  <Block margin="bottom" marginValue={24}>*/}
          {/*    <Group header="CREATIVE">*/}
          {/*      <ListItem*/}
          {/*        padding="6px 16px"*/}
          {/*        text={*/}
          {/*          <BlockNew row align="center" gap={8}>*/}
          {/*            <Text type="text" weight="medium">*/}
          {/*              Status:*/}
          {/*            </Text>*/}
          {/*            <Text type="text" color="accent">*/}
          {/*              {creative.status}*/}
          {/*            </Text>*/}
          {/*          </BlockNew>*/}
          {/*        }*/}
          {/*      />*/}
          {/*      {creative.revision_notes && (*/}
          {/*        <ListItem*/}
          {/*          padding="6px 16px"*/}
          {/*          text={*/}
          {/*            <BlockNew gap={4}>*/}
          {/*              <Text type="text" weight="medium">*/}
          {/*                Revision Notes:*/}
          {/*              </Text>*/}
          {/*              <Text type="text" color="danger">*/}
          {/*                {creative.revision_notes}*/}
          {/*              </Text>*/}
          {/*            </BlockNew>*/}
          {/*          }*/}
          {/*        />*/}
          {/*      )}*/}
          {/*      {isAdvertiser && creative.status === 'pending' && (*/}
          {/*        <BlockNew row gap={8} paddingValue={16}>*/}
          {/*          <Button*/}
          {/*            type="primary"*/}
          {/*            onClick={handleApproveCreative}*/}
          {/*            disabled={approveCrceativeMutation.isPending}*/}
          {/*          >*/}
          {/*            Approve*/}
          {/*          </Button>*/}
          {/*          <Button*/}
          {/*            type="secondary"*/}
          {/*            onClick={handleRequestRevision}*/}
          {/*            disabled={requestRevisionMutation.isPending}*/}
          {/*          >*/}
          {/*            Request Revision*/}
          {/*          </Button>*/}
          {/*        </BlockNew>*/}
          {/*      )}*/}
          {/*    </Group>*/}
          {/*  </Block>*/}
          {/*)}*/}

          <Block>
            <List header="DEAL INFORMATION">
              {deal.channel?.title && (
                <ListItem
                  text="Channel"
                  after={
                    <BlockNew row align="center" gap={8}>
                      <ChannelLink channel={deal.channel} showLabel={false} textType="text" />
                    </BlockNew>
                  }
                />
              )}
              {deal.postLink && (
                <ListLinkView
                  title="Post Link "
                  value=" View Post"
                  link={deal.postLink}
                  copyText='Link to the channel post copied'
                />
              )}
              <ListItem
                text="Ad Format"
                after={
                  <BlockNew row align="center" gap={8}>
                    <Text type="text" color="accent">
                      {deal.ad_format}
                    </Text>
                  </BlockNew>
                }
              />
              <ListItem
                text="Price"
                after={
                  <BlockNew row align="center" gap={8}>
                    <Text type="text" color="accent">
                      {deal?.price_ton !== undefined ? deal?.price_ton + ' TON' : '-'}
                    </Text>
                  </BlockNew>
                }
              />
              {typeof deal.advertiser === 'object' && deal.advertiser !== null && (
                <ListItem
                  text="Advertiser"
                  after={
                    <BlockNew row align="center" gap={8}>
                      <div onClick={handleAdvertiserClick} className={styles.clickable}>
                        <Text
                          type="text"
                          color="accent"
                        >
                          {deal.advertiserDisplayName}
                        </Text>
                      </div>
                    </BlockNew>
                  }
                />
              )}
              {deal.postLink === null && deal.escrow_address && deal.formattedEscrowAddress && (
                <ListLinkView
                  title="Escrow Address"
                  value={deal.formattedEscrowAddress}
                  link={getTONScanUrl(deal.escrow_address)}
                  copyText='Escrow address copied'
                />
              )}
              {deal.paymentTxLink && deal.payment_tx_hash && (
                <ListLinkView
                  title="Payment Transcation"
                  value="View"
                  link={deal.paymentTxLink}
                  copyText='Escrow address copied'
                />
              )}
              {deal.formattedPostVerificationTime && deal.postLink ? (
                <ListItem
                  text="Post Validation Time"
                  description={<Text type="caption2">Post verification time with automatic payout to channel
                    owner</Text>}
                  after={deal.formattedPostVerificationTime}
                />
              ) : deal.formattedScheduledPostTime && (
                <ListItem
                  text="Scheduled Post Time"
                  after={deal.formattedScheduledPostTime}
                />
              )}
            </List>

            <Block padding="top" paddingValue={16} gap={12}>
              <List header="Post Message">
                {deal.messages && deal.messages.length > 0 && (
                  <EditableMessageText
                    isPending={updateDealMessageMutation.isPending}
                    value={deal.messages[0]?.message_text?.trim() ?? ''}
                    canEdit={!!canEditMessage}
                    onSave={handleSaveMessage}
                  />
                )}
              </List>
              {deal.revisionMessages.length > 0 && (
                <List header="Chanell Owner Messages">
                  {deal.revisionMessages.map((dealMessage: DealMessage) => (
                    dealMessage.message_text ? (
                      <ListItem
                        key={dealMessage.id}
                        text={(
                          <Text type="text">
                            {dealMessage.message_text}
                          </Text>
                        )}
                      />
                    ) : undefined
                  ))}
                </List>
              )}
            </Block>
          </Block>

        </Block>

      </PageLayout>

      {showPaymentButton && (
        <>
          {wallet?.account ? (
            <TelegramMainButton
              text={`Pay ${deal.price_ton} TON`}
              onClick={onClickButton}
              isVisible={true}
            />
          ) : (
            <TelegramMainButton
              text={`Connect Wallet`}
              onClick={onClickButton}
              isVisible={true}
            />
          )}

        </>
      )}

      <DeclineDealModal
        active={showDeclineModal}
        onConfirm={handleConfirmDecline}
        onClose={() => setShowDeclineModal(false)}
      />

      <Sheet opened={showRequestChangesSheet} onClose={closeRequestChangesSheet}>
        <BlockNew gap={12}>
          <BlockNew paddingValue={16}>
            <Block>
              <Text type="text" weight="medium" align="center">
                Request Changes
              </Text>
            </Block>
            <Block margin="top" marginValue={4}>
              <Text type="caption" color="tertiary" align="center">
                Please provide your requested changes (at least 5 characters).
              </Text>
            </Block>
            <Block margin="top" marginValue={16}>
              <textarea
                className={cn(styles.requestChangesNotes, styles.textarea)}
                value={requestChangesNotes}
                onChange={(e) => setRequestChangesNotes(e.target.value)}
                placeholder="Describe the changes you need..."
                rows={4}
                maxLength={500}
              />
            </Block>
          </BlockNew>
          <BlockNew row justify="end" gap={8} paddingValue={16}>
            <Button type="secondary" onClick={closeRequestChangesSheet}>
              Cancel
            </Button>
            <Button
              prefix={requestRevisionMutation.isPending ? <Spinner size={16} /> : undefined}
              disabled={requestChangesNotes.trim().length < 5 || requestRevisionMutation.isPending}
              type="accent"
              onClick={handleRequestChangesDone}
            >
              Done
            </Button>

          </BlockNew>
        </BlockNew>
      </Sheet>
    </Page>
  )
}
