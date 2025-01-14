import { track } from '@amplitude/analytics-browser'
import { PencilIcon } from '@heroicons/react/outline'
import { NextRouter } from 'next/router'

import clsx from 'clsx'
import { Row as rowFor } from 'common/supabase/utils'
import { capitalize, orderBy } from 'lodash'
import { Button } from 'web/components/buttons/button'
import { Col } from 'web/components/layout/col'
import { Row } from 'web/components/layout/row'
import { Subtitle } from '../widgets/lover-subtitle'

export function OpinionScale(props: {
  multiChoiceAnswers: rowFor<'love_answers'>[]
  questions: rowFor<'love_questions'>[]
  isCurrentUser: boolean
  router: NextRouter
}) {
  const { multiChoiceAnswers, questions, isCurrentUser, router } = props
  return (
    <Col className="gap-2">
      <Row className={'w-full items-center justify-between gap-2'}>
        <Subtitle>Opinion Scale</Subtitle>

        {isCurrentUser && multiChoiceAnswers.length > 0 && (
          <Button
            color={'gray-outline'}
            size="xs"
            className={''}
            onClick={() => {
              track('edit love questions')
              router.push('opinion-scale')
            }}
          >
            <PencilIcon className="mr-2 h-4 w-4" />
            Edit
          </Button>
        )}
      </Row>
      {multiChoiceAnswers.length > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {orderBy(multiChoiceAnswers, (a) => a.multiple_choice, 'desc').map(
            (answer) => {
              return (
                <OpinionScaleBlock
                  key={answer.multiple_choice ?? '' + answer.id}
                  answer={answer}
                  questions={questions}
                />
              )
            }
          )}
        </div>
      ) : isCurrentUser ? (
        <Col className="text-ink-600 gap-2 text-sm">
          You have not filled out your opinion scale yet!
          <Button color="indigo" onClick={() => router.push('opinion-scale')}>
            Fill opinion scale
          </Button>
        </Col>
      ) : (
        <div className="text-ink-600 gap-2 text-sm">None yet</div>
      )}
    </Col>
  )
}

function OpinionScaleBlock(props: {
  answer: rowFor<'love_answers'>
  questions: rowFor<'love_questions'>[]
}) {
  const { answer, questions } = props
  const question = questions.find((q) => q.id === answer.question_id)
  const multiChoiceAnswer = answer.multiple_choice
  if (!question) return null
  const options = question.multiple_choice_options as Record<string, number>
  const optionKey = options
    ? Object.keys(options).find((k) => options[k] === multiChoiceAnswer)
    : null

  if (!optionKey || multiChoiceAnswer == null) return null

  return (
    <Col
      className={clsx(
        multiChoiceAnswer == 0
          ? `bg-rose-400  dark:bg-rose-500 `
          : multiChoiceAnswer == 1
          ? `bg-rose-300 dark:bg-rose-400 `
          : multiChoiceAnswer == 2
          ? `bg-stone-400  dark:bg-stone-500`
          : multiChoiceAnswer == 3
          ? `bg-teal-300 dark:bg-teal-200  `
          : `bg-teal-400`,
        'relative rounded bg-opacity-20 px-4 py-1 dark:bg-opacity-30'
      )}
    >
      <div
        className={clsx(
          'text-ink-600 w-full text-xs',
          multiChoiceAnswer == 0
            ? 'text-rose-700 dark:text-rose-300'
            : multiChoiceAnswer == 1
            ? 'text-rose-500 dark:text-rose-300'
            : multiChoiceAnswer == 2
            ? 'text-stone-500 dark:text-stone-400'
            : multiChoiceAnswer == 3
            ? 'text-teal-500 '
            : 'text-teal-600'
        )}
      >
        {capitalize(optionKey)}
      </div>
      {question.question}
    </Col>
  )
}
