import clsx from 'clsx'
import { AD_PERIOD, AD_REDEEM_REWARD } from 'common/boost'
import { run } from 'common/supabase/utils'
import { User } from 'common/user'
import { filterDefined } from 'common/util/array'
import { sumBy } from 'lodash'
import Link from 'next/link'
import { FeedContractCard } from 'web/components/contract/feed-contract-card'
import { mergePeriodic } from 'web/components/feed/feed-items'
import { Col } from 'web/components/layout/col'
import {
  groupCommentsByContractsAndParents,
  useFeedBets,
} from 'web/hooks/use-additional-feed-items'
import { useUnseenReplyChainCommentsOnContracts } from 'web/hooks/use-comments-supabase'
import { BoostsType } from 'web/hooks/use-feed'
import { FeedTimelineItem } from 'web/hooks/use-feed-timeline'
import { useIsVisible } from 'web/hooks/use-is-visible'
import { db } from 'web/lib/supabase/db'
import { ContractsTable } from '../contract/contracts-table'
import { NewsArticle } from '../news-article'
import { FeedBetsItem } from './feed-bet-item'
import { groupBetsByCreatedTimeAndUserId } from './feed-bets'
import { FeedCommentItem } from './feed-comment-item'

const MAX_BETS_PER_FEED_ITEM = 2
const MAX_PARENT_COMMENTS_PER_FEED_ITEM = 1
export const MIN_BET_AMOUNT = 20

export const FeedTimelineItems = (props: {
  feedTimelineItems: FeedTimelineItem[]
  boosts?: BoostsType
  user: User | null | undefined
}) => {
  const { user, boosts, feedTimelineItems: savedFeedTimelineItems } = props
  const savedFeedComments = filterDefined(
    savedFeedTimelineItems.map((item) => item.comments)
  ).flat()

  const boostedContractItems =
    boosts?.map((boost) => {
      const { market_data, ...rest } = boost
      return { contract: { ...market_data }, ...rest }
    }) ?? []

  const contractIdsWithoutComments = filterDefined(
    savedFeedTimelineItems.map((item) =>
      item.contractId && !item.comments ? item.contractId : null
    )
  ).concat(boostedContractItems.map((c) => c.contract.id))

  const recentComments = useUnseenReplyChainCommentsOnContracts(
    contractIdsWithoutComments,
    user?.id ?? '_'
  )

  const { parentCommentsByContractId, childCommentsByParentCommentId } =
    groupCommentsByContractsAndParents(savedFeedComments.concat(recentComments))

  const recentBets = useFeedBets(user, contractIdsWithoutComments)
  const feedTimelineItems = mergePeriodic(
    savedFeedTimelineItems,
    boostedContractItems,
    AD_PERIOD
  )

  return (
    <Col className="gap-4">
      {feedTimelineItems.map((item) => {
        // Boosted contract
        if (item.contract && ('ad_id' in item || 'contract' in item)) {
          const { contract } = item
          const parentComments = (
            parentCommentsByContractId[contract.id] ?? []
          ).slice(0, MAX_PARENT_COMMENTS_PER_FEED_ITEM)
          const relatedBets = recentBets
            .filter((bet) => bet.contractId === contract.id)
            .slice(0, MAX_BETS_PER_FEED_ITEM)
          const groupedBetsByTime = groupBetsByCreatedTimeAndUserId(
            relatedBets
          ).filter(
            (bets) =>
              sumBy(bets, (bet) => Math.abs(bet.amount)) > MIN_BET_AMOUNT
          )
          const hasRelatedItems =
            parentComments.length > 0 || groupedBetsByTime.length > 0

          let promotedData = undefined
          if ('ad_id' in item) {
            promotedData = {
              adId: item.ad_id,
              reward: AD_REDEEM_REWARD,
            }
          }
          return (
            <FeedItemFrame
              item={undefined}
              key={contract.id + 'feed-timeline-item'}
            >
              <FeedContractCard
                contract={contract}
                promotedData={promotedData}
                trackingPostfix="feed"
                hasItems={hasRelatedItems}
                showReason={true}
                reason={
                  'reasonDescription' in item
                    ? item.reasonDescription
                    : undefined
                }
                item={'ad_id' in item ? undefined : item}
              />
              {parentComments.length > 0 && (
                <FeedCommentItem
                  contract={contract}
                  commentThreads={parentComments.map((parentComment) => ({
                    parentComment,
                    childComments:
                      childCommentsByParentCommentId[parentComment.id] ?? [],
                  }))}
                />
              )}
              {(!parentComments || parentComments.length === 0) &&
                groupedBetsByTime.length > 0 && (
                  <FeedBetsItem
                    contract={contract}
                    groupedBets={groupedBetsByTime}
                  />
                )}
            </FeedItemFrame>
          )
        } else if ('news' in item && item.news) {
          const { news } = item
          return (
            <FeedItemFrame
              item={item}
              key={news.id + 'feed-timeline-item'}
              className="w-full overflow-hidden rounded-2xl"
            >
              <NewsArticle
                author={(news as any)?.author}
                published_time={(news as any)?.published_time}
                {...news}
              />
              {item.contracts && (
                <Col className="bg-canvas-0 px-4 pt-2 pb-3">
                  <span className="text-ink-500 text-sm">Related Markets</span>
                  <ContractsTable
                    contracts={item.contracts}
                    hideHeader={true}
                  />
                </Col>
              )}
            </FeedItemFrame>
          )
        }
      })}
    </Col>
  )
}

export function FeedRelatedItemFrame(props: {
  children: React.ReactNode
  href: string
  className?: string
}) {
  const { children, href, className } = props
  return (
    <Link
      href={href}
      className={clsx(
        'bg-canvas-0 border-canvas-0 hover:border-primary-300 z-10 mb-2 flex flex-col overflow-hidden rounded-2xl rounded-tr-none border',
        className
      )}
    >
      {children}
    </Link>
  )
}

const FeedItemFrame = (props: {
  item: FeedTimelineItem | undefined
  children: React.ReactNode
  className?: string
}) => {
  const { item, children, className } = props
  const maybeVisibleHook =
    item &&
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useIsVisible(
      () =>
        // TODO: should we keep updating them or just do it once?
        run(
          db
            .from('user_feed')
            .update({ seen_time: new Date().toISOString() })
            .eq('id', item.id)
        ),
      true
    )
  return (
    <Col ref={maybeVisibleHook?.ref} className={className}>
      {children}
    </Col>
  )
}
